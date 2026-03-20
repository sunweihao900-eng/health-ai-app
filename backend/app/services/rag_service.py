"""
RAG服务（ChromaDB + BAAI/bge-base-zh-v1.5）
- 持久化存储健康科普知识库
- 余弦相似度检索，阈值0.7
- 知识库初始化（从文件导入）
"""
import os
import glob
import logging
from typing import List, Optional
from ..core.config import settings
from ..models.schemas import RAGContext

logger = logging.getLogger(__name__)


class RAGService:
    """ChromaDB RAG服务"""

    def __init__(self):
        self.collection = None
        self.embedding_fn = None
        self._initialized = False

    def initialize(self):
        """延迟初始化（避免启动时因缺少依赖而崩溃）"""
        if self._initialized:
            return
        try:
            import chromadb
            from chromadb.utils import embedding_functions

            client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)

            # 使用中文优化嵌入模型
            self.embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name=settings.EMBEDDING_MODEL
            )

            self.collection = client.get_or_create_collection(
                name=settings.CHROMA_COLLECTION_NAME,
                embedding_function=self.embedding_fn,
                metadata={"hnsw:space": "cosine"},
            )

            self._initialized = True
            logger.info(f"RAG服务初始化成功，知识库文档数: {self.collection.count()}")

        except ImportError as e:
            logger.warning(f"RAG依赖未安装，服务将以降级模式运行: {e}")
        except Exception as e:
            logger.error(f"RAG服务初始化失败: {e}")

    def load_knowledge_base(self, data_dir: Optional[str] = None) -> int:
        """
        从目录加载知识库文档。
        返回成功导入的文档数量。
        """
        if not self._initialized:
            self.initialize()
        if not self._initialized:
            return 0

        data_dir = data_dir or settings.KNOWLEDGE_BASE_DIR
        if not os.path.exists(data_dir):
            logger.warning(f"知识库目录不存在: {data_dir}")
            return 0

        txt_files = glob.glob(os.path.join(data_dir, "*.txt"))
        if not txt_files:
            logger.warning(f"知识库目录下无.txt文件: {data_dir}")
            return 0

        documents = []
        metadatas = []
        ids = []
        existing_ids = set(self.collection.get()["ids"])

        for file_path in txt_files:
            filename = os.path.basename(file_path)
            doc_id_prefix = filename.replace(".txt", "")

            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read().strip()

            # 按段落分块（防止单文档超长）
            chunks = self._split_into_chunks(content, chunk_size=500, overlap=50)

            for i, chunk in enumerate(chunks):
                doc_id = f"{doc_id_prefix}_chunk_{i}"
                if doc_id in existing_ids:
                    continue  # 跳过已存在的文档

                documents.append(chunk)
                metadatas.append({"source": filename, "chunk_index": i})
                ids.append(doc_id)

        if documents:
            self.collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids,
            )
            logger.info(f"知识库导入完成，新增文档块: {len(documents)}")

        return len(documents)

    def retrieve(self, query: str, top_k: Optional[int] = None) -> RAGContext:
        """
        检索与查询最相关的文档片段。
        过滤低于相似度阈值的结果。
        """
        if not self._initialized:
            self.initialize()
        if not self._initialized or self.collection is None:
            return RAGContext()

        try:
            top_k = top_k or settings.RAG_TOP_K
            results = self.collection.query(
                query_texts=[query],
                n_results=min(top_k, max(1, self.collection.count())),
                include=["documents", "metadatas", "distances"],
            )

            documents = []
            sources = []
            scores = []

            for doc, meta, distance in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0],
            ):
                # ChromaDB cosine distance: 0=完全相似, 2=完全不同
                # 转换为相似度分数: similarity = 1 - distance/2
                similarity = 1 - (distance / 2)

                if similarity >= settings.RAG_SIMILARITY_THRESHOLD:
                    documents.append(doc)
                    sources.append(meta.get("source", "unknown"))
                    scores.append(round(similarity, 4))

            return RAGContext(
                documents=documents,
                sources=sources,
                similarity_scores=scores,
            )

        except Exception as e:
            logger.error(f"RAG检索失败: {e}")
            return RAGContext()

    def format_context(self, rag_context: RAGContext) -> Optional[str]:
        """将RAG检索结果格式化为给Claude的上下文字符串"""
        if not rag_context.documents:
            return None

        parts = ["以下是来自健康知识库的相关科普信息，请参考但不要直接照搬：\n"]
        for i, (doc, source) in enumerate(
            zip(rag_context.documents, rag_context.sources), 1
        ):
            parts.append(f"[参考资料{i} - 来源: {source}]\n{doc}")

        return "\n\n".join(parts)

    @staticmethod
    def _split_into_chunks(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        """将长文本分割为重叠片段"""
        if len(text) <= chunk_size:
            return [text]

        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]

            # 尝试在句子边界截断
            last_period = max(
                chunk.rfind("。"),
                chunk.rfind("！"),
                chunk.rfind("？"),
                chunk.rfind("\n"),
            )
            if last_period > chunk_size // 2:
                chunk = chunk[: last_period + 1]
                end = start + last_period + 1

            chunks.append(chunk.strip())
            start = end - overlap

        return [c for c in chunks if c.strip()]


# 单例
rag_service = RAGService()

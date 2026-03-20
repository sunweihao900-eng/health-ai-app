"""
合规过滤器 - 核心安全屏障
1. 紧急症状检测 → 强制引导急救
2. 意图分类 → 拦截诊断/处方请求
3. 输出审查 → 过滤违禁表达
"""
import re
from typing import Tuple
from ..models.schemas import ComplianceCheckResult

# ──────────────────────────────────────────────
# 紧急症状关键词（双重检测：精确词 + 正则）
# ──────────────────────────────────────────────
EMERGENCY_KEYWORDS = [
    # 心血管
    "心梗", "心肌梗死", "心脏骤停", "心跳停止", "剧烈胸痛", "胸口压迫",
    # 脑血管
    "脑卒中", "中风", "突然偏瘫", "突然失语", "口歪眼斜", "脑出血", "脑梗",
    # 呼吸
    "窒息", "呼吸困难", "无法呼吸", "气道堵塞", "溺水",
    # 意识
    "昏迷", "失去意识", "意识丧失", "晕厥不醒",
    # 外伤/失血
    "大量出血", "严重出血", "骨折外露", "内脏外露",
    # 中毒
    "中毒", "服药过量", "农药", "煤气中毒", "一氧化碳", "煤气泄漏", "气体泄漏",
    # 心理危机
    "自杀", "自残", "想死", "不想活", "结束生命",
    # 儿科紧急
    "高热惊厥", "婴儿窒息", "异物卡喉",
]

EMERGENCY_PATTERNS = [
    r"(突然|剧烈).{0,10}(胸痛|头痛|腹痛)",
    r"(无法|不能|停止).{0,5}(呼吸|呼气|吸气)",
    r"(意识|神志).{0,5}(不清|模糊|丧失|消失)",
    r"(大量|不止).{0,5}(出血|流血)",
    r"(自杀|轻生|想死).{0,20}",
    r"(过量|误服|误吞).{0,10}(药|药物|毒)",
]

# ──────────────────────────────────────────────
# 违禁意图关键词（触发 → 直接拒绝并引导就医）
# ──────────────────────────────────────────────
DIAGNOSIS_KEYWORDS = [
    "我得了什么病", "帮我诊断", "确诊", "是不是患有", "是什么病",
    "病因是什么", "得了什么", "判断一下我", "分析我的病",
    "分析一下我的病", "我的病情", "病情分析", "得了高血压", "得了糖尿病",
    "得了什么", "是不是得了",
    "读一下我的报告", "解读报告", "化验单", "看一下检查结果",
    "ct结果", "核磁结果", "b超结果", "血常规异常",
]

PRESCRIPTION_KEYWORDS = [
    "开药", "开处方", "药方", "用什么药", "吃什么药", "服什么药",
    "推荐药物", "推荐什么药", "该用哪种药", "哪种药", "剂量是多少", "用多少毫克",
    "能吃XXX吗", "这个药能吃吗", "买什么药",
    "用药方案", "治疗方案", "怎么治疗", "如何根治",
]

SEVERITY_ASSESSMENT_KEYWORDS = [
    "严不严重", "危不危险", "是否严重", "需不需要手术",
    "能自愈吗", "会不会传染", "会癌变吗", "会不会恶化",
]

# ──────────────────────────────────────────────
# 违禁输出表达（用于输出审查）
# ──────────────────────────────────────────────
FORBIDDEN_OUTPUT_PATTERNS = [
    r"你(患有|得了|确诊为|被诊断为).{0,30}",
    r"建议(服用|使用|注射).{0,20}(mg|毫克|片|粒|支)",
    r"(诊断|病情|症状)表明.{0,30}",
    r"根据(你的|您的)(症状|检查|化验).{0,20}(确定|判断|诊断)",
    r"(处方|开药|用药方案)[：:].{0,100}",
    r"(严重程度|危险等级|风险级别)[：:].{0,50}",
    r"你的?(病情|状况|情况)(属于|是|为).{0,20}(严重|中度|轻度|危险)",
]

EMERGENCY_REDIRECT = """
⚠️ **检测到可能的紧急情况**

请立即采取以下行动：
- **拨打急救电话：120**（全国急救）
- 心理危机热线：**400-161-9995** / **北京：010-82951332**
- 保持冷静，等待救援

**本工具无法处理紧急医疗情况，请立即寻求专业急救帮助。**
"""

DIAGNOSIS_REDIRECT = """
您好，我是健康科普助手，**无法进行疾病诊断或解读医疗报告**。

我可以帮您：
- 了解相关症状的一般科普知识
- 推荐适合就诊的科室
- 整理您想告知医生的症状信息

如需明确诊断，请前往正规医疗机构就诊，由执业医师为您提供专业诊断。

---
*⚠️ 本内容由AI生成，仅供参考，不构成医疗建议。*
"""

PRESCRIPTION_REDIRECT = """
您好，**我无法推荐具体药物或制定用药方案**，这属于处方权限，需由执业医师在充分了解您病情后决定。

自行购药或用药可能带来危险，请：
1. 前往医院门诊，由医生开具处方
2. 或前往正规药店，由执业药师提供用药咨询

我可以为您提供就医科室建议或症状相关科普信息。

---
*⚠️ 本内容由AI生成，仅供参考，不构成医疗建议。*
"""


class ComplianceFilter:
    """合规过滤器：输入检测 + 输出审查"""

    def check_input(self, text: str) -> ComplianceCheckResult:
        """检测用户输入，返回合规检查结果"""
        text_lower = text.lower()

        # 1. 紧急症状检测（最高优先级）
        for keyword in EMERGENCY_KEYWORDS:
            if keyword in text:
                return ComplianceCheckResult(
                    is_emergency=True,
                    emergency_message=EMERGENCY_REDIRECT,
                    intent="emergency",
                )

        for pattern in EMERGENCY_PATTERNS:
            if re.search(pattern, text):
                return ComplianceCheckResult(
                    is_emergency=True,
                    emergency_message=EMERGENCY_REDIRECT,
                    intent="emergency",
                )

        # 2. 诊断意图检测
        for keyword in DIAGNOSIS_KEYWORDS:
            if keyword in text:
                return ComplianceCheckResult(
                    needs_redirect=True,
                    redirect_message=DIAGNOSIS_REDIRECT,
                    intent="diagnosis",
                )

        # 3. 处方意图检测
        for keyword in PRESCRIPTION_KEYWORDS:
            if keyword in text:
                return ComplianceCheckResult(
                    needs_redirect=True,
                    redirect_message=PRESCRIPTION_REDIRECT,
                    intent="prescription",
                )

        # 4. 严重性评估检测
        for keyword in SEVERITY_ASSESSMENT_KEYWORDS:
            if keyword in text:
                return ComplianceCheckResult(
                    needs_redirect=True,
                    redirect_message=DIAGNOSIS_REDIRECT,
                    intent="severity_assessment",
                )

        return ComplianceCheckResult(intent="general")

    def check_output(self, text: str) -> Tuple[str, bool]:
        """
        审查AI输出，过滤违禁表达。
        返回 (cleaned_text, was_modified)
        """
        modified = False
        result = text

        for pattern in FORBIDDEN_OUTPUT_PATTERNS:
            if re.search(pattern, result):
                # 替换违禁表达为安全提示
                result = re.sub(
                    pattern,
                    "[此内容已被合规系统屏蔽，请咨询执业医师]",
                    result,
                )
                modified = True

        return result, modified

    def check_history_for_bypass(self, messages: list) -> bool:
        """
        检测多轮对话中是否存在绕过护栏的尝试。
        如角色扮演引导、忽略限制指令等。
        """
        bypass_patterns = [
            r"假设你是.{0,5}医生", r"扮演医生", r"你是.{0,3}医生",
            r"忽略.{0,5}限制", r"忽略.{0,5}(提示|指令|约束)",
            r"不受限制", r"忘记.{0,8}(提示|指令|限制|约束)",
            r"jailbreak", r"DAN模式", r"开发者模式",
            r"绕过", r"破解", r"解锁",
        ]
        for msg in messages:
            content = msg.get("content", "") if isinstance(msg, dict) else msg.content
            for pattern in bypass_patterns:
                if re.search(pattern, content, re.IGNORECASE):
                    return True
        return False

    def inject_disclaimer(self, text: str) -> str:
        """在AI回复末尾注入强制免责声明"""
        disclaimer = (
            "\n\n---\n"
            "**⚠️ 重要提示（AIGC生成内容）**\n"
            "本回复由人工智能生成，**仅供健康科普参考**，不构成医疗诊断、治疗建议或处方依据。\n"
            "如有健康问题，请及时就诊，由执业医师提供专业诊疗。\n"
            "🤖 *本内容由AI自动生成 | 生成式人工智能服务*"
        )
        # 避免重复注入
        if "本回复由人工智能生成" in text:
            return text
        return text + disclaimer


# 单例
compliance_filter = ComplianceFilter()

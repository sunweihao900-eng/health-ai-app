# 健康AI咨询助手

符合中国医疗AI法规的健康科普与分诊辅助工具。

## 技术栈
- **后端**: FastAPI + Claude API + ChromaDB RAG
- **Web前端**: React + TypeScript + Vite
- **小程序**: 微信小程序
- **部署**: Docker Compose

## 快速启动

### 1. 配置环境变量
```bash
cd backend
cp .env.example .env
# 填写 ANTHROPIC_API_KEY 和 JWT_SECRET_KEY
```

### 2. 启动后端（开发模式）
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. 启动Web前端（开发模式）
```bash
cd frontend-web
npm install
npm run dev
# 访问 http://localhost:3000
```

### 4. Docker Compose一键部署
```bash
# 根目录创建 .env 文件
echo "ANTHROPIC_API_KEY=sk-ant-xxx" > .env
echo "JWT_SECRET_KEY=$(openssl rand -hex 32)" >> .env

docker-compose up -d
# 访问 http://localhost
```

## 合规架构

```
用户输入
  │
  ├─► 紧急症状检测 → (触发) → 强制引导120/心理热线
  │
  ├─► 意图分类 → (诊断/处方请求) → 直接拒绝 + 就医引导
  │
  ├─► PII脱敏 → 手机号/身份证/姓名/地址自动脱敏
  │
  ├─► RAG检索 → ChromaDB健康知识库（相似度≥0.7）
  │
  ├─► Claude生成 → 合规System Prompt约束
  │
  ├─► 输出审查 → 过滤"确诊/处方/评估严重性"等违禁表达
  │
  └─► 注入AIGC免责声明 → 存储脱敏日志
```

## 上线资质清单（MVP必须完成）

- [ ] ICP备案
- [ ] 公安部网络安全备案
- [ ] AIGC算法备案（国家互联网信息办公室）
- [ ] 等保二级评测
- [ ] 知识库内容经执业医师审核
- [ ] 微信小程序医疗健康类目资质
- [ ] 红队测试通过（100条违规问题，命中率≥95%）

## 合规文档

- `docs/compliance/disclaimer.md` — 免责声明
- `docs/compliance/privacy_policy.md` — 隐私政策（PIPL合规）
- `docs/compliance/data_security.md` — 数据安全措施

## ⚠️ 重要声明

本工具定位为**非诊断/非处方**健康科普服务，严禁用于医疗诊断。

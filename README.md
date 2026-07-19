# PollyCar

PollyCar 是一个安全优先、限量开放的城市行程撮合产品。乘客以固定价格发起行程，经审核的非职业豪车车主自主决定是否接受；行程完成后，仅在双方共同同意时开放 72 小时临时对话。

## 当前状态

- 阶段：`阶段 0：产品语义、安全边界与架构决策`
- 交付等级：`尚未实现`
- 技术栈：尚未选择
- 部署目标：尚未选择

当前仓库主要包含产品与工程治理基线，尚无应用运行时。

## 阅读顺序

1. `AGENTS.md`：AI 协作和中文文档硬约束。
2. `ROADMAP.md`：当前阶段、待决策事项和下一任务。
3. `docs/00-product-thesis.md`：产品定位、目标和非目标。
4. `docs/01-semantic-alignment.md`：产品语义、表达规范和禁止边界。
5. `docs/04-domain-model.md`：业务规则、流程和状态机。
6. `docs/02-ai-engineering-governance.md`：唯一真相源和变更协议。
7. `docs/07-delivery-and-operations.md`：交付、隐私、容量、发布与回滚。

## 治理命令

- 文档与治理检查：`./scripts/test/check-doc-governance.ps1`
- 当前预检：`./scripts/test/preflight.ps1 -SkipProjectTests`
- 应用测试、静态检查和构建：技术栈确定后接入。

## 配置

`.env.example` 只用于展示本地配置键，不得写入真实密钥、生产地址或个人数据。

## 发布

进入任何真实用户环境前，必须完成 `docs/RELEASE_CHECKLIST.md`。

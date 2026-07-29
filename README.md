# PollyCar

PollyCar 是一个安全优先、限量开放的城市行程撮合产品。乘客以固定价格发起行程，经审核的非职业豪车车主自主决定是否接受；行程完成后，仅在双方共同同意时开放 72 小时临时对话。

## 当前状态

- 阶段：`生产候选准备`
- 交付等级：`生产级代码与本地验收已完成；禁止生产启用`
- 技术栈：Expo/React Native 用户端、React 运营后台、Node.js/TypeScript Server、PostgreSQL
- 部署目标：本地生产就绪环境可验收；共享预生产与真实生产资源尚未创建

当前仓库包含用户端、运营后台、服务端、供应商中立基础设施契约和治理门禁。真实用户数据、生产认证、真实地图服务端能力、资金能力、共享云资源与生产启用均保持关闭。

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
- 类型检查：`pnpm typecheck`
- 单元测试：`pnpm test`
- 生产候选汇总报告：`pnpm production-candidate:report`
- 共享预生产 IaC 只读计划：`pnpm infra:shared-preproduction:plan`

## 配置

`.env.example` 只用于展示本地配置键，不得写入真实密钥、生产地址或个人数据。

## 发布

进入任何真实用户环境前，必须完成外部供应商、账号、预算、区域、域名、监控、五类批准证据与独立发布评审；当前状态不得解释为已获生产批准。

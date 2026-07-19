# AI 工程治理

## 目的

本项目把产品文档、规范、代码、测试、路线图和交付能力视为同一个产品系统。提示词不能替代可检查的治理规则。

## 治理层次

1. `AGENTS.md`：AI 协作硬约束和变更协议。
2. `ROADMAP.md`：当前阶段、止损线、验收和下一优先级。
3. `docs/README.md`：文档索引和事实归属。
4. `docs/decisions/`：记录高风险决策的背景、权衡、批准和退出条件。
5. `docs/reviews/`：记录决策所需证据、签署和阻断项。
6. 产品与工程文档：解释意图和当前生效规则。
7. `spec/`：成熟后可机器检查的接口、事件和数据契约。
8. 代码、测试、迁移和脚本：实现并证明文档事实。

## 唯一真相源映射

| 事实 | 唯一真相源 | 可执行事实 | 当前验证 |
| --- | --- | --- | --- |
| 产品定位与成功标准 | `docs/00-product-thesis.md` | 验收测试与产品评审 | `./scripts/test/check-doc-governance.ps1` |
| 产品语义、文案和禁止边界 | `docs/01-semantic-alignment.md` | 文案、界面与验收测试 | `./scripts/test/check-doc-governance.ps1` |
| 阶段、止损线和待决策项 | `ROADMAP.md` | 无 | 路线图评审 |
| 高风险决策状态和理由 | `docs/decisions/` | 无 | 决策索引评审 |
| 评审证据和签署 | `docs/reviews/` | 无 | 评审清单 |
| 领域规则、流程和状态机 | `docs/04-domain-model.md` | 领域代码与测试 | 尚未配置 |
| 领域事件 | `docs/08-domain-events.md` | 事件发布、消费与重建测试 | 尚未配置 |
| 状态转换与并发规则 | `docs/09-state-machines.md` | 状态机和并发测试 | 尚未配置 |
| 权限和职责分离 | `docs/10-permission-matrix.md` | 授权中间件与权限测试 | 尚未配置 |
| 数据分类和处理 | `docs/11-data-classification.md` | 字段策略、存储与审计测试 | 尚未配置 |
| 错误模型 | `docs/12-error-model.md`、`spec/api/error-codes.yaml` | API 错误映射与客户端测试 | `./scripts/test/check-api-scenarios.ps1` |
| 验收矩阵 | `docs/13-acceptance-matrix.md`、`spec/tests/eligibility-scenarios.yaml` | 参数化场景测试 | `./scripts/test/check-api-scenarios.ps1` |
| API | `spec/api/openapi.yaml` | 处理器与契约测试 | 尚未配置 |
| 数据结构 | `docs/05-data-schema.md` 与未来迁移 | 迁移与存储代码 | 尚未配置 |
| 验收策略 | `docs/06-validation-plan.md` | 测试与检查脚本 | `./scripts/test/preflight.ps1 -SkipProjectTests` |
| 配置、发布、回滚和运营 | `docs/07-delivery-and-operations.md` | 部署脚本与流水线 | 发布检查表 |

## 变更单元

每个非平凡任务都是一个变更单元，必须检查：

- 范围：改变什么，不改变什么。
- 真相源：哪些文档、规范或迁移定义事实。
- 实现：哪些代码或配置改变。
- 验证：什么测试或检查证明改变正确。
- 路线图：阶段、止损线、验收或下一任务是否改变。
- 交付：配置、可观测性、容量、发布或回滚是否受影响。

## 完成阻断条件

存在以下任一情况时不得宣称完成：

- 文档、规范和实现存在已知冲突。
- 数据结构、迁移和说明存在已知冲突。
- 验证失败，或未运行且未说明原因与残余风险。
- 未检查路线图影响。
- 涉及部署或配置却未检查交付影响。
- 未经路线图解锁就实现支付、权限、隐私、破坏性操作或其他高风险未来能力。
- 新增或修改的项目文档不符合中文硬约束。

## CI 目标

未来的预检入口应依次执行：

1. 文档索引与中文治理检查。
2. 契约和数据规范检查。
3. 类型检查、静态检查和构建。
4. 单元与集成测试。
5. 迁移、种子和恢复验证。
6. 涉及生产的发布准备检查。

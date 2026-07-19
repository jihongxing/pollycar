# 可机器检查的规范

本目录保存用于减少文档、实现和测试漂移的机器可检查规范。中文文档解释业务含义，规范提供稳定标识和可自动验证的结构。

## 当前规范

### 领域规范

| 文件 | 职责 | 文档来源 |
| --- | --- | --- |
| `domain/eligibility-states.yaml` | 弹性资格状态、转换、守卫、并发优先级和错误码 | `docs/09-state-machines.md` |
| `domain/eligibility-events.yaml` | 资格与配额事件、事件信封和敏感等级 | `docs/08-domain-events.md` |
| `domain/quota-policy.yaml` | 基础与弹性滚动配额、占用释放和到期行为 | `docs/04-domain-model.md`、`docs/09-state-machines.md` |
| `domain/adult-eligibility-verification.yaml` | 成年资格验证的四项检查、状态、失败恢复、数据最小化和默认关闭门禁 | `docs/decisions/0010-全用户实名与法定性别披露.md` |

### 安全规范

| 文件 | 职责 | 文档来源 |
| --- | --- | --- |
| `security/roles.yaml` | 角色稳定标识和系统主体 | `docs/10-permission-matrix.md` |
| `security/data-classification.yaml` | L0 至 L4 数据等级和字段映射 | `docs/11-data-classification.md` |
| `security/authorization-rules.yaml` | 默认拒绝、允许动作、职责分离和紧急权限 | `docs/10-permission-matrix.md` |

### API 与验收规范

| 文件 | 职责 | 文档来源 |
| --- | --- | --- |
| `api/error-codes.yaml` | 错误码、HTTP 状态、重试、披露和审计等级 | `docs/12-error-model.md` |
| `api/operation-policies.yaml` | OpenAPI 操作到授权、数据等级、错误码和验收场景的映射 | OpenAPI 及安全规范 |
| `api/openapi.yaml` | 弹性资格最小 API 契约 | `docs/03-api-contract.md` 及相关领域规范 |
| `tests/eligibility-scenarios.yaml` | 资格、支付、配额、权限、数据和并发场景 | `docs/13-acceptance-matrix.md` |

### 生产准备契约

| 文件 | 职责 | 默认状态 |
| --- | --- | --- |
| `data/data-lifecycle.yaml` | 数据保留、删除、冻结和备份清除 | 仅合成数据 |
| `domain/vehicle-review.yaml` | 车辆审核、唯一绑定、复核和撤销 | 真实车辆资料关闭 |
| `experiments/free-flex-trial.yaml` | 免费资格名单、批次、指标和停止规则 | 真实邀请关闭、付费关闭 |
| `payments/zero-money-payment.yaml` | 零金额支付前置、退款语义和孤立支付 | 真实支付关闭 |
| `platform/persistence.yaml` | PostgreSQL、迁移、乐观并发和事务 outbox | 默认内存，本机数据库显式启用 |

### 资金规范

| 文件 | 职责 | 默认状态 |
| --- | --- | --- |
| `finance/ledger.yaml` | 不可变复式账本、数据库不变量、过账入口、余额投影和分阶段实施门禁 | 仅本机 PostgreSQL 与合成资金，默认关闭 |

### 运营后台规范

| 文件 | 职责 | 默认状态 |
| --- | --- | --- |
| `admin/review-task-workflow.yaml` | 审核任务状态、租约、认领和职责分离 | 仅合成任务 |
| `admin/vehicle-review-decisions.yaml` | 补充、批准、拒绝、升级和复核决定 | 生产关闭 |
| `admin/field-disclosure.yaml` | 字段级披露、目的、工单和临时授权 | 默认拒绝 |
| `admin/decision-messages.yaml` | 结构化原因和用户可见文案预览 | 仅合成消息 |
| `tests/admin-review-scenarios.yaml` | 后台并发、权限、审计和数据保护场景 | 生产关闭 |

### 结构 Schema

| 文件 | 验证目标 |
| --- | --- |
| `meta/eligibility-states.schema.json` | 资格状态与转换 |
| `meta/eligibility-events.schema.json` | 领域事件 |
| `meta/quota-policy.schema.json` | 配额策略 |
| `meta/roles.schema.json` | 安全角色 |
| `meta/data-classification.schema.json` | 数据等级和字段 |
| `meta/authorization-rules.schema.json` | 授权规则 |
| `meta/error-codes.schema.json` | 错误码 |
| `meta/acceptance-scenarios.schema.json` | 验收场景 |
| `meta/operation-policies.schema.json` | OpenAPI 操作策略 |
| `meta/ledger.schema.json` | 不可变复式账本 |

## 当前状态

- 所有规范均为 `status: "review"`。
- 所有规范必须声明 `production_enabled: false`。
- 弹性资格免费邀请试验规则已批准，但真实开放条件未完成；规范仍不得作为生产功能启用依据。
- 生产准备契约允许指导生产级代码实现，但真实支付、真实邀请、上海试点和真实数据写入必须保持关闭。

## 验证

运行：

```powershell
./scripts/test/check-domain-specs.ps1
./scripts/test/check-spec-schemas.ps1
./scripts/test/check-api-scenarios.ps1
./scripts/test/check-openapi-policies.ps1
./scripts/test/check-production-contracts.ps1
./scripts/test/check-admin-specs.ps1
```

检查内容包括：

- 状态、转换源和目标均有效。
- 十二份核心 YAML 规范符合对应 JSON Schema；其余生产准备契约另由专项脚本验证。
- 状态转换引用的事件和角色存在。
- 只有 `active` 状态使用弹性配额。
- 基础与弹性策略都包含 24 小时、7 日和 30 日窗口。
- 配额上限保持 `3/10/15` 和 `4/12/18`。
- 角色、授权动作和数据等级引用一致。
- 错误码结构、场景状态、事件、角色和错误引用一致。
- OpenAPI 操作与授权动作、角色、数据等级、错误码和场景一一对应。
- 所有规范禁止生产启用。

该检查已接入 `scripts/test/preflight.ps1`。

## 维护规则

- 文档是中文业务含义的唯一真相源，规范不得自行创造新业务规则。
- 规范变化必须同步更新对应文档和验证脚本。
- Schema 使用 JSON Schema Draft 2020-12；当前零依赖验证器执行项目使用到的核心关键字。
- 标识一经被实现或测试引用，不得直接改名；应提供版本或迁移。
- 不得在规范中写入密钥、真实身份、支付凭据、位置或聊天数据。
- API、事件模式和数据模式后续应引用这些稳定状态、事件、角色和等级标识。

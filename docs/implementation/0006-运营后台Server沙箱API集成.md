# 实施包 0006：运营后台 Server 沙箱 API 集成

## 状态

`已完成`

评审日期：`2026-07-11`

评审结论：

> 产品、安全、隐私和工程范围已收敛，允许在用户再次明确批准后开始代码实现；继续禁止生产启用、真实身份、真实数据和范围外审核决定。

## 背景与问题

实施包 `0005` 已完成首个运营后台合成审核切片，但后台当前使用浏览器进程内的 `SyntheticAdminReviewClient`。这能够验证页面和公开契约，却不能验证以下关键能力：

- 浏览器与 Server 跨进程调用；
- Server 端身份固定、授权和任务所有权校验；
- 两个独立后台会话并发认领；
- HTTP 条件下的幂等、超时和未知结果恢复；
- 统一错误模型、关联 ID 和状态码映射；
- Server 生成的追加式审计查询；
- 前端完全不持有任务真相源。

因此下一步不是扩展批准、拒绝或敏感披露，而是把 `0005` 的五步切片接入真实的内部沙箱 HTTP 边界。

## 实施目标

建立以下跨进程内部沙箱闭环：

```text
Admin 浏览器
→ 公开 AdminReview HTTP Client
→ 内部沙箱 HTTP API
→ 合成身份与授权
→ AdminReviewTaskService
→ 内存任务、车辆审核与审计适配器
→ 统一 HTTP 结果
→ Admin 页面状态
```

完成后应达到：

- 后台不再由浏览器内存决定任务所有权；
- 队列、认领、详情、续约、释放、补充材料和审计均来自 Server；
- 两个浏览器上下文可以验证真实并发冲突；
- 网络结果未知时使用原幂等键查询 Server 结果；
- Server 进程重启只丢弃合成内存状态，不需要迁移或修复；
- 所有真实能力继续关闭。

## 真相源

### 产品和实施

- `docs/implementation/0002-内部生产级沙箱.md`
- `docs/implementation/0004-车辆审核Server应用服务.md`
- `docs/implementation/0005-运营后台首个合成审核切片.md`
- `docs/product/admin/04-车辆审核工作流.md`
- `docs/product/admin/05-敏感数据披露规则.md`
- `docs/product/admin/07-交互与审计要求.md`

### 决策和机器规范

- `docs/decisions/0007-生产应用架构与默认关闭策略.md`
- `docs/decisions/0009-运营后台技术选型.md`
- `spec/admin/review-task-workflow.yaml`
- `spec/admin/field-disclosure.yaml`
- `spec/admin/decision-messages.yaml`
- `spec/tests/admin-review-scenarios.yaml`
- `spec/api/error-codes.yaml`
- `spec/api/operation-policies.yaml`
- `spec/api/openapi.yaml`

### 当前代码边界

- `packages/contracts/src/admin-review.ts`
- `apps/server/src/application/admin-review-task-service.ts`
- `apps/server/src/ports/review-tasks.ts`
- `apps/server/src/sandbox.ts`
- `apps/admin/src/infrastructure/synthetic-admin-review-client.ts`
- `apps/admin/src/application/review-task-context.tsx`

## 明确范围

### Server HTTP 能力

只允许实现：

1. 内部沙箱 HTTP 监听；
2. 健康检查；
3. 固定合成审核员身份认证；
4. 后台任务队列查询；
5. 单任务原子认领；
6. 最小必要详情查询；
7. 当前任务租约续期；
8. 当前任务主动释放；
9. 补充材料文案预览；
10. 要求补充合成材料；
11. 当前任务追加式审计查询；
12. 幂等结果恢复；
13. 统一错误模型、关联 ID、结构化日志、指标和追踪；
14. 仅用于测试的受控时钟或租约推进能力。

### Admin 客户端能力

只允许：

- 新增 `HttpAdminReviewClient`；
- 本地开发允许由 Vite 将同源 `/v1/internal-sandbox` 代理到独立回环 Server；
- 在开发和测试配置中选择 Server 沙箱客户端；
- 保留合成进程内客户端作为组件测试替身；
- 将认领冲突、所有权失效、版本冲突、认证失败、Server 不可用和未知结果映射为现有页面状态；
- 使用原幂等键恢复未知写入结果；
- 在 Server 不可用时明确失败，不回退到浏览器内存成功。

### 数据范围

只允许：

- 内存合成任务；
- 合成车辆审核申请；
- 合成审核员；
- 合成追加式审计；
- `L0` 至 `L2` 的最小必要字段；
- 测试专用固定时间和任务种子。

## 明确不在范围

- 车辆批准；
- 车辆拒绝；
- 升级高级审核；
- 独立复核；
- 安全调查；
- 临时原文披露；
- 安全证据访问；
- 批量认领、批量决定或自动决定；
- 人工重放执行；
- 真实 SSO、真实审核员或真实组织目录；
- Cookie 会话、生产 JWT 或生产令牌供应商；
- 真实用户、真实车辆、真实附件或真实联系方式；
- 生产数据库、缓存、消息队列或对象存储；
- 真实通知；
- 公网暴露、共享测试部署或生产部署；
- 支付、邀请、行程、接单和上海试点；
- 修改 `packages/domain/`。

现有 Server 中即使存在批准、拒绝、升级和复核应用方法，本实施包也不得为其增加 HTTP 路由或后台调用入口。

## 接口设计

### 基础规则

- 基础路径：`/v1/internal-sandbox/admin`；
- 只监听 `127.0.0.1`；
- 默认端口由内部沙箱配置显式给出；
- 缺少内部沙箱开关时不得启动监听；
- 所有接口返回 `Cache-Control: no-store`；
- 所有响应返回 `X-Correlation-Id`；
- 所有写接口要求 `Idempotency-Key`；
- 所有任务写接口要求任务版本；
- 补充材料接口同时要求车辆审核版本；
- 客户端角色、所有者、租约和数据等级参数一律不可信；
- Server 从合成认证上下文确定审核员身份和角色；
- 所有错误使用统一错误模型；
- 不在响应、日志或错误中返回敏感原文。

### 合成身份

首切片只支持预置合成普通审核员：

```text
Authorization: Sandbox synthetic-reviewer-001
```

约束：

- 只在 `internal-sandbox` 环境接受；
- 只允许白名单合成主体；
- 不接受请求体或查询参数覆盖主体和角色；
- 非白名单值返回 `AUTHENTICATION_REQUIRED`；
- 认证上下文必须标记 `synthetic: true`；
- 不将该格式复用于生产身份。

### 接口清单

| 方法 | 路径 | operationId | 用途 |
| --- | --- | --- | --- |
| `GET` | `/v1/internal-sandbox/health` | `getInternalSandboxHealth` | 查询内部沙箱健康状态 |
| `GET` | `/v1/internal-sandbox/admin/review-tasks` | `listAdminReviewTasks` | 查询合成审核队列摘要 |
| `POST` | `/v1/internal-sandbox/admin/review-tasks/{task_id}/claim` | `claimAdminReviewTask` | 原子认领单个任务 |
| `GET` | `/v1/internal-sandbox/admin/review-tasks/{task_id}` | `getAdminReviewTask` | 查询最小必要详情 |
| `POST` | `/v1/internal-sandbox/admin/review-tasks/{task_id}/lease/renew` | `renewAdminReviewTaskLease` | 在允许窗口内续约 |
| `POST` | `/v1/internal-sandbox/admin/review-tasks/{task_id}/release` | `releaseAdminReviewTask` | 使用结构化原因主动释放 |
| `POST` | `/v1/internal-sandbox/admin/review-tasks/{task_id}/material-request-preview` | `previewAdminMaterialRequest` | 生成预批准用户文案 |
| `POST` | `/v1/internal-sandbox/admin/review-tasks/{task_id}/material-request` | `requestAdminVehicleMaterial` | 要求补充合成材料 |
| `GET` | `/v1/internal-sandbox/admin/review-tasks/{task_id}/audit` | `listAdminReviewTaskAudit` | 查询追加式审计摘要 |
| `GET` | `/v1/internal-sandbox/admin/idempotency-results/{idempotency_key}` | `getAdminIdempotencyResult` | 恢复未知写入结果 |

### 队列查询

`GET /internal-sandbox/v1/admin/review-tasks`

返回：

- `AdminReviewTaskSummary[]`；
- 仅包含 `queue_summary` 字段；
- 可包含 `available`、`in_progress`、`waiting_user` 等允许状态；
- 不返回账户原文、联系方式、车牌、保险内容或附件。

首切片不实现：

- 任意排序表达式；
- 任意字段筛选；
- 服务端搜索原文；
- 导出；
- 分页游标持久化。

合成任务数量保持有限；若需要真实分页，必须建立新实施包。

### 原子认领

`POST /internal-sandbox/v1/admin/review-tasks/{task_id}/claim`

请求要求：

- `Idempotency-Key`；
- `expected_task_version`；
- Server 认证上下文中的审核员身份。

成功返回：

- `200`；
- `AdminReviewTaskDetail`；
- 有效 `AdminReviewLease`；
- 新任务版本。

并发失败：

- `409 ADMIN_TASK_ALREADY_CLAIMED`；
- 不泄露其他审核员身份；
- 客户端刷新队列。

### 最小必要详情

`GET /internal-sandbox/v1/admin/review-tasks/{task_id}`

约束：

- 只返回 `review_field`；
- 当前普通审核员必须持有任务，或任务处于允许的只读完成状态；
- 每次查看追加 `task_viewed` 审计；
- 禁止返回严格受限原文和安全证据；
- `Cache-Control: no-store`。

### 租约续期

`POST /internal-sandbox/v1/admin/review-tasks/{task_id}/lease/renew`

请求要求：

- `Idempotency-Key`；
- `expected_task_version`；
- 当前审核员持有未过期租约；
- 当前时间进入到期前 5 分钟窗口。

规则：

- 租约总时长仍为 30 分钟；
- 过早续约返回业务规则错误；
- 过期或所有权变化返回 `ADMIN_TASK_OWNERSHIP_LOST`；
- 续约成功追加审计。

### 主动释放

`POST /internal-sandbox/v1/admin/review-tasks/{task_id}/release`

允许原因：

- `reviewer_unavailable`；
- `wrong_queue`；
- `needs_supervisor`。

规则：

- 原因必填；
- 必须持有有效租约；
- 成功后立即失去写权限；
- 任务回到允许重新认领的状态；
- 追加释放审计。

### 补充材料文案预览

`POST /internal-sandbox/v1/admin/review-tasks/{task_id}/material-request-preview`

允许原因：

- `insurance_expiry_incomplete`；
- `authorization_evidence_incomplete`；
- `synthetic_attachment_invalid`。

规则：

- 必须持有有效租约；
- 只返回批准模板；
- 不接受自由文本；
- 预览结果包含原因、标题、正文和模板版本；
- 预览本身不改变任务或车辆审核状态。

### 要求补充材料

`POST /internal-sandbox/v1/admin/review-tasks/{task_id}/material-request`

请求要求：

- `Idempotency-Key`；
- `reason`；
- `preview_confirmed: true`；
- `preview_template_version`；
- `expected_task_version`；
- `expected_vehicle_review_version`。

成功结果：

- 车辆审核进入等待补充状态；
- 审核任务进入 `waiting_user`；
- 租约释放；
- 任务版本和车辆审核版本同时推进；
- 追加决定审计；
- 返回只读 `AdminReviewTaskDetail`。

禁止：

- 自由文本替代结构化原因；
- 未预览直接提交；
- 客户端传入用户消息正文；
- 租约失效后写入；
- 版本不匹配时覆盖。

### 审计查询

`GET /internal-sandbox/v1/admin/review-tasks/{task_id}/audit`

返回：

- 当前任务的 `AdminReviewAuditEntry[]`；
- 只读、按发生时间升序；
- 包含动作、结果、原因码、主体引用、关联 ID 和时间；
- 不包含敏感请求体、认证令牌或材料原文。

后台不得提供修改、删除或补写审计接口。

### 未知结果恢复

`GET /internal-sandbox/v1/admin/idempotency-results/{idempotency_key}`

规则：

- 只查询当前合成审核员发起的后台写命令；
- 找到结果返回 `200` 和原命令结果；
- 尚未找到返回 `404 IDEMPOTENT_RESULT_NOT_FOUND`；
- 幂等键已用于其他操作返回 `409 CONFLICT_IDEMPOTENCY_KEY_REUSED`；
- 查询不得重新执行命令；
- Admin 在写请求网络中断后先查询，再决定是否允许用户重试同一幂等键。

## 统一错误映射

至少覆盖：

| HTTP | 错误码 | 客户端行为 |
| --- | --- | --- |
| `400` | `VALIDATION_FAILED` | 标记请求或表单错误 |
| `401` | `AUTHENTICATION_REQUIRED` | 退出沙箱工作台 |
| `403` | `AUTHORIZATION_DENIED` | 显示无权限，不重试 |
| `404` | `ADMIN_TASK_NOT_FOUND` | 返回队列并刷新 |
| `404` | `IDEMPOTENT_RESULT_NOT_FOUND` | 保持未知状态，可用原键重试 |
| `409` | `ADMIN_TASK_ALREADY_CLAIMED` | 显示认领冲突并刷新 |
| `409` | `ADMIN_TASK_OWNERSHIP_LOST` | 页面只读并返回队列 |
| `409` | `VERSION_CONFLICT` | 重新读取任务，不覆盖 |
| `409` | `CONFLICT_IDEMPOTENCY_KEY_REUSED` | 阻止重试并记录错误 |
| `422` | `ADMIN_DECISION_REASON_REQUIRED` | 回到补充材料确认 |
| `422` | `ADMIN_LEASE_RENEWAL_TOO_EARLY` | 保持当前租约 |
| `503` | `SERVICE_UNAVAILABLE` | 明确 Server 不可用 |
| `500` | `INTERNAL_UNEXPECTED_ERROR` | 显示关联 ID，不泄露内部信息 |

若错误码尚未存在于 `spec/api/error-codes.yaml`，必须先补充机器规范和检查，再实现路由。

## 状态、幂等与事务边界

### 真相源

- 任务所有权、租约、任务版本和幂等结果只由 Server 保存；
- Admin 本地状态仅用于渲染和进行中交互；
- 刷新页面后必须从 Server 恢复；
- 客户端不得根据本地时间自行宣布租约有效；
- 客户端倒计时只作为提示，写入仍由 Server 判定。

### 幂等

- 每个写操作使用独立幂等键；
- 同一键和同一操作返回原结果；
- 同一键用于不同任务、不同命令或不同请求摘要时拒绝；
- 幂等结果至少保存到当前 Server 沙箱进程结束；
- 首切片不建立持久化幂等仓储。

### 补充材料一致性

要求补充材料必须在一个应用服务编排中完成：

1. 校验身份、角色、所有权和租约；
2. 校验任务版本和车辆审核版本；
3. 校验原因和预览模板版本；
4. 更新车辆审核；
5. 更新审核任务并释放租约；
6. 追加审计；
7. 保存幂等结果；
8. 返回统一结果。

内存适配器必须通过事务或可回滚编排避免任务与车辆审核状态分裂。

## 安全、隐私与合规评审

### 安全结论

`通过，限内部沙箱`

条件：

- 只监听回环地址；
- 只接受预置合成身份；
- 所有权和角色只由 Server 判断；
- 写入需要幂等键和版本；
- 不增加批准、拒绝、升级、复核或敏感披露路由；
- 无生产密钥、真实令牌和公网入口；
- Server 不可用时客户端不得静默回退。

### 隐私结论

`通过，限合成数据`

条件：

- 队列只返回摘要；
- 详情只返回最小审核字段；
- 响应禁止缓存；
- 日志、追踪、指标和错误不含材料原文；
- 审计只保存结构化动作和引用；
- 不接触真实用户或真实车辆数据。

### 合规结论

`不构成生产运营批准`

本实施包只验证内部工程边界，不代表：

- 已批准真实审核员使用；
- 已完成真实身份和内部访问控制；
- 已批准处理真实车辆材料；
- 已批准车辆准入实际决定；
- 已批准共享测试或生产部署。

## 文件边界

### 允许新增

```text
apps/server/src/http/
  internal-sandbox-server.ts
  admin-review-routes.ts
  error-mapper.ts
  request-context.ts
  schemas.ts
apps/server/src/http/*.test.ts
apps/admin/src/infrastructure/http-admin-review-client.ts
apps/admin/src/infrastructure/http-admin-review-client.test.ts
scripts/test/check-admin-sandbox-api.ps1
```

如需要测试辅助，可新增：

```text
packages/test-support/src/admin-review-http.ts
```

### 允许修改

```text
packages/contracts/src/admin-review.ts
packages/contracts/src/index.ts
apps/server/src/application/admin-review-task-service.ts
apps/server/src/application/admin-review-task-service.test.ts
apps/server/src/adapters/memory-review-task-repository.ts
apps/server/src/ports/review-tasks.ts
apps/server/src/sandbox.ts
apps/server/src/config.ts
apps/server/src/config.test.ts
apps/server/src/index.ts
apps/server/package.json
apps/admin/src/application/review-task-context.tsx
apps/admin/src/app/providers.tsx
apps/admin/src/app/shell.tsx
apps/admin/package.json
package.json
pnpm-lock.yaml
spec/api/openapi.yaml
spec/api/operation-policies.yaml
spec/api/error-codes.yaml
spec/tests/admin-review-scenarios.yaml
spec/security/authorization-rules.yaml
scripts/test/check-api-scenarios.ps1
scripts/test/check-openapi-policies.ps1
scripts/test/check-admin-implementation.ps1
scripts/test/preflight.ps1
docs/implementation/0006-运营后台Server沙箱API集成.md
docs/implementation/README.md
ROADMAP.md
```

### 禁止写入

- `apps/app/`；
- `packages/domain/`；
- 支付、资格、行程、聊天或安全证据模块；
- 生产部署和基础设施目录；
- 真实环境配置；
- 密钥、证书、真实令牌或真实数据；
- 范围外运营后台页面和业务决定。

若实现必须修改禁止区域，立即触发停止线。

## 实施顺序

1. 扩展 `AdminReview` HTTP DTO 和统一错误响应；
2. 扩展 OpenAPI、操作策略、错误码和验收场景；
3. 建立 HTTP 请求上下文和合成身份适配；
4. 建立 Server 沙箱组合根和回环监听；
5. 实现队列、认领、详情、租约和释放路由；
6. 实现文案预览、补充材料和审计路由；
7. 实现幂等结果恢复路由；
8. 实现 `HttpAdminReviewClient`；
9. 将 Admin 开发入口切换到 HTTP 客户端；
10. 补齐集成测试、并发测试和浏览器端到端测试；
11. 新增专项治理检查并接入完整预检；
12. 完成验证后更新实施状态和路线图。

不得先改前端为 HTTP 调用，再补 Server 所有权或错误规则。

## 验收矩阵

### 正常场景

- Server 只在显式内部沙箱配置下监听 `127.0.0.1`；
- 合成审核员能通过 HTTP 查询队列；
- 认领后可查询最小必要详情；
- 最后 5 分钟内可续约；
- 可使用结构化原因释放任务；
- 可预览补充材料文案；
- 提交后任务和车辆审核状态一致；
- 可查询 Server 追加式审计；
- 页面刷新后从 Server 恢复状态；
- 明暗主题不影响 API 权限和状态。

### 拒绝场景

- 缺少或伪造合成身份被拒绝；
- 请求体覆盖审核员身份或角色无效；
- 未认领任务不能查询受限详情或提交；
- 非所有者不能续约、释放或要求补充；
- 租约过期后写入被拒绝；
- 过早续约被拒绝；
- 未预览不能提交补充材料；
- 自由文本和未知原因被拒绝；
- 旧任务版本和旧车辆审核版本被拒绝；
- 真实数据标记或禁止字段被拒绝；
- 批准、拒绝、升级和复核路由不存在；
- Server 不可用时 Admin 不回退为本地成功。

### 并发与幂等

- 两个独立 HTTP 会话并发认领只有一个成功；
- 并发写入不会产生双所有者；
- 同一写命令和同一幂等键返回原结果；
- 同一键用于不同命令返回冲突；
- HTTP 响应丢失后可以查询原结果；
- 查询未知结果不会重新执行命令；
- 释放后原所有者立即失去写权限；
- 任务版本和车辆审核版本不会静默覆盖。

### 安全与数据保护

- 监听地址不是 `0.0.0.0`；
- CORS 只允许明确的本地 Admin 开发源；
- 所有响应使用 `no-store`；
- 队列和详情不包含禁止字段；
- 错误响应不包含堆栈、令牌或材料内容；
- 日志、指标和追踪不包含敏感原文；
- 审计不可通过 HTTP 修改或删除；
- 关联 ID 可贯穿请求、日志和审计。

### 可访问性与体验

- Server 不可用、认证失败、认领冲突、所有权失效和未知结果均有明确页面状态；
- 未知结果恢复不要求用户理解幂等术语；
- 错误不只依赖颜色表达；
- 写入期间按钮防重复触发，但 Server 幂等仍为最终保障；
- 页面刷新和浏览器返回不会制造伪所有权；
- 移动窄屏不作为后台主目标，但不得阻断错误恢复操作。

## 自动化测试要求

### 公开契约

- HTTP 请求和响应 DTO 不包含禁止字段；
- 所有写命令包含幂等键和版本；
- 不导出批准、拒绝、升级或复核 HTTP 命令；
- 错误模型包含错误码、消息、关联 ID 和可重试标记。

### Server 单元与集成

- 合成身份认证；
- 回环地址和 feature gate；
- 队列字段过滤；
- 原子并发认领；
- 租约续约窗口；
- 租约过期和所有权失效；
- 主动释放；
- 文案预览；
- 补充材料事务一致性；
- 幂等重复、冲突和恢复；
- 审计追加；
- CORS、`no-store` 和关联 ID；
- 敏感日志拒绝；
- 禁止路由返回 `404`。

### 后台客户端

- HTTP 客户端序列化和错误映射；
- Server 不可用；
- 认证失败；
- 认领冲突；
- 所有权失效；
- 版本冲突；
- 未知结果恢复；
- 不回退进程内成功；
- 页面刷新后重新读取 Server。

### 浏览器端到端

至少验证：

1. 启动 Server 和 Admin；
2. 从沙箱入口进入队列；
3. 认领并查看详情；
4. 第二浏览器上下文认领同一任务失败；
5. 预览并提交补充材料；
6. 审计记录由 Server 返回；
7. 刷新后状态保持一致；
8. 关闭 Server 后页面明确失败；
9. 明暗主题下错误和环境标识可见；
10. 浏览器控制台无未处理错误。

## 验收命令

实施完成时至少运行：

```powershell
pnpm --filter @pollycar/contracts typecheck
pnpm --filter @pollycar/server typecheck
pnpm --filter @pollycar/server test
pnpm --filter @pollycar/admin typecheck
pnpm --filter @pollycar/admin test
pnpm --filter @pollycar/admin build
./scripts/test/check-admin-sandbox-api.ps1
./scripts/test/preflight.ps1
```

并使用 `/browse` 对两个独立浏览器上下文执行端到端 QA。

## 停止线

出现以下任一情况立即停止实施：

1. 需要接入真实 SSO、真实审核员或组织目录；
2. 需要监听非回环地址或进行共享部署；
3. 需要接入生产数据库、缓存、队列或对象存储；
4. 需要处理真实用户、车辆或附件；
5. 需要实现批准、拒绝、升级、复核或安全调查路由；
6. 需要展示临时原文或安全证据；
7. 客户端需要决定角色、所有权、租约或字段披露；
8. Server 无法原子执行任务所有权变更；
9. 补充材料无法保证任务与车辆审核状态一致；
10. 网络失败时必须回退到浏览器内存成功；
11. 需要修改 `packages/domain/`；
12. 需要启用真实通知、支付、邀请、接单或上海试点；
13. 敏感数据进入日志、错误、缓存、快照或测试产物；
14. 需要超出本实施包文件边界。

停止后必须：

- 保留已通过的安全和并发测试；
- 记录触发条件和未完成范围；
- 将本实施包状态改为 `已暂停`；
- 更新 `ROADMAP.md`；
- 重新进行产品、安全、隐私和工程评审；
- 不以临时 mock 或客户端判断绕过阻断。

## 回滚策略

### 后台客户端回滚

- 将开发 Provider 切回 `SyntheticAdminReviewClient`；
- 保留 `HttpAdminReviewClient` 契约测试但关闭运行入口；
- Server 不可用时显示“内部审核工作台暂不可用”；
- 不以静默回退制造成功状态。

### Server 回滚

- 关闭内部沙箱 HTTP feature gate；
- 停止回环监听；
- 保留 `AdminReviewTaskService` 和内存适配器；
- 删除或禁用 `apps/server/src/http/` 不影响应用服务测试；
- 不回滚 `0005` 已通过的后台 UI 和领域服务。

### 数据回滚

- 丢弃当前 Server 进程的合成任务、租约、幂等结果和审计；
- 不执行数据库迁移或数据修复；
- 重启后使用固定合成种子恢复测试初始状态；
- 不为保留演示状态引入持久化。

### 契约回滚

- 已公开 DTO 不直接改名；
- HTTP 专用字段通过向后兼容方式调整；
- 若接口设计失败，关闭路由并保留未启用契约；
- 不把后台 HTTP 字段加入用户 App 契约。

### OpenAPI 回滚

- 沙箱接口使用清晰标签和内部路径；
- 回滚时可将操作标记为未实施，不删除其他 API；
- 操作策略、错误码和验收场景保持同步；
- 禁止将内部沙箱 Server URL 误标为生产地址。

## 发布与生产边界

完成本实施包只代表：

> 运营后台五步合成审核切片能够通过本机回环 HTTP 与 Server 跨进程运行。

不代表：

- 可以进行共享测试部署；
- 可以接入真实审核员；
- 可以处理真实材料；
- 可以做真实车辆决定；
- 可以启用生产监听；
- 可以启用上海试点或任何真实用户能力。

生产启用仍需独立决策、身份与网络安全评审、真实数据影响评估和运营门槛批准。

## 评审结果

| 评审 | 结论 | 条件 |
| --- | --- | --- |
| 产品 | 通过 | 只连接 `0005` 五步切片，不扩展业务决定 |
| 安全 | 通过 | 回环监听、合成身份、Server 所有权、无敏感路由 |
| 隐私 | 通过 | 仅合成数据、最小字段、禁止缓存和敏感日志 |
| 工程 | 通过 | 先契约与测试，HTTP 适配器不侵入 Domain |

当前无阻断项。

## 进入与退出条件

进入 `实施中`：

- 用户再次明确要求开始 API 代码实现；
- 实施人员确认文件边界；
- OpenAPI、错误码和操作策略先于或与路由同一变更单元更新；
- 未触发停止线。

进入 `已完成`：

- 所有接口和错误映射通过自动化测试；
- 两个浏览器上下文并发验收通过；
- Server 停止和未知结果恢复验收通过；
- 专项检查和完整预检通过；
- 产品、安全、隐私和工程确认范围未扩大。

进入 `已暂停`：

- 触发任一停止线；
- 需要真实身份、共享部署或持久化；
- 契约、权限或数据边界需要重新决策。

## 负责人

| 责任 | 负责人 |
| --- | --- |
| 产品范围和错误体验 | 产品负责人 |
| 身份、监听、CORS 和所有权 | 安全负责人 |
| 字段、缓存、日志和审计 | 隐私负责人 |
| OpenAPI、Server HTTP 和事务 | 工程负责人 |
| Admin HTTP 客户端和页面状态 | 客户端负责人 |
| 最终实施验收 | 产品、安全、隐私、工程四方 |

## 变更记录

- `2026-07-11`：创建实施包，完成范围、接口、错误、验收、停止线和回滚评审；结论为 `可实施，尚未开始`。
- `2026-07-11`：用户明确批准完整实现，实施包进入 `实施中`。
- `2026-07-11`：完成回环 HTTP Server、合成身份、十个 OpenAPI 操作、Server 原子任务 API、幂等恢复、Admin HTTP 客户端和同源开发代理。
- `2026-07-11`：Server 18 项测试、Admin 9 项测试、双浏览器标签并发冲突、补充材料、Server 审计、服务中断失败状态、三档响应式 QA 和完整预检通过；实施包进入 `已完成`。

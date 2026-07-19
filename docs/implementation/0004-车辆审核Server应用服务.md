# 实施包 0004：车辆审核 Server 应用服务

## 状态

`已完成`

## 目标

将车辆审核机器规范转化为 Server 应用服务，并通过公开契约向 App 提供稳定的命令和视图边界。

## 已实现

- `VehicleReviewView` 公开读模型；
- 保存车辆草稿；
- 提交审核；
- 要求补充材料；
- 重新提交材料；
- 批准车辆审核；
- 乐观并发版本控制；
- 命令幂等键；
- 审核任务幂等入队；
- 每次状态变化追加审计；
- 结构化日志、指标和追踪；
- 独立车辆审核内存仓储；
- 合成数据限制。

## 状态范围

当前实现闭环：

```text
draft
→ under_review
→ needs_material
→ under_review
→ approved
```

暂停、申诉、撤销和到期仍保留在公开状态类型中，等待后续安全与运营切片实现。

## App 接入

- App 只依赖 `packages/contracts`；
- App 不依赖 `apps/server`；
- 内部沙箱使用 `SyntheticVehicleReviewClient` 实现同一公开契约；
- 页面根据 `VehicleReviewView.status`、`version`、`timeline` 和 `ownerIdentityAvailable` 呈现；
- 后续真实网络接入只替换客户端适配器，不改变页面业务模型。

## 默认关闭

- 不启动 HTTP 监听；
- 不连接生产数据库；
- 不接受真实身份或车辆材料；
- 不启用真实通知、邀请、接单或支付；
- 不批准生产启用。

## 验收

- Contracts 类型检查通过；
- Server 车辆审核服务测试通过；
- App 合成客户端契约测试通过；
- 旧版本写入被拒绝；
- 重复提交保持幂等；
- 审核任务、审计、日志、指标和追踪有验证证据；
- Expo Web 导出和完整预检通过。

## 关联

- `spec/domain/vehicle-review.yaml`
- `packages/contracts/src/vehicle-review.ts`
- `apps/server/src/application/vehicle-review-service.ts`
- `apps/app/src/infrastructure/synthetic-vehicle-review-client.ts`
- `docs/product/slices/0001-车辆准入闭环.md`

## 变更记录

- `2026-07-11`：完成车辆审核 Server 应用服务和 App 公开契约接入。


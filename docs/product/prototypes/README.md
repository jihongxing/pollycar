# 产品设计原型索引

本目录保存可浏览、可评审的产品设计参考，不是正式生产 App 代码。

## 原型

| 原型 | 目的 | 状态 |
| --- | --- | --- |
| `mobility-redesign/index.html` | 默认叫车、车主自主接单、行程、消息和账户主要页面重构候选 | 设计候选 |
| `app-reference/index.html` | 单一用户 App、多身份切换和车辆准入闭环高保真参考 | 已建立 |
| `admin-reference/index.html` | 运营后台整体信息架构、车辆审核和控制状态高保真参考 | 已建立 |
| `admin-stage-one/platform-workbench/index.html` | 阶段一平台工作台、组织观察范围、临时授权与审计反馈 | 已建立 |
| `admin-stage-one/operator-workbench/index.html` | 阶段一固定主体工作台、跨主体拒绝和受控关闭态 | 已建立 |
| `admin-stage-one/operator-directory/index.html` | 阶段一平台范围内运营主体只读名录 | 已建立 |
| `admin-stage-two/operator-360/index.html` | 阶段二运营主体生命周期、城市能力、运力和阻断聚合 | 已建立 |
| `admin-stage-two/onboarding-case/index.html` | 阶段二入驻检查清单、补充要求和独立复核 | 已建立 |
| `admin-stage-two/driver-360/index.html` | 阶段二车主资格、配额、车辆和主运营关系聚合 | 已建立 |
| `admin-stage-two/vehicle-360/index.html` | 阶段二车辆审核、关系、证照和任务聚合 | 已建立 |
| `admin-stage-two/primary-operator-migration/index.html` | 阶段二双方确认、独立复核、未来生效和迁移阻断 | 已建立 |
| `adult-eligibility-flow/index.html` | App 成年资格说明、证件、本人验证、提交、补充材料和结果分步流程 | 设计候选 |
| `admin-adult-eligibility-review/index.html` | 运营后台自动身份核验结果、供应商调用、异常和数据生命周期留痕 | 设计候选 |

## 使用方式

直接在浏览器打开：

```text
docs/product/prototypes/app-reference/index.html
```

原型包含：

- 内部沙箱启动；
- 乘客工作台；
- 身份切换；
- 申请车主身份；
- 车主资料；
- 车辆资料；
- 提交确认；
- 审核中；
- 需要补充材料；
- 审核批准结果；
- 车主工作台。

## 约束

- 原型只使用合成内容。
- 原型不得被解释为真实能力已启用。
- `synthetic_admin_operator_management` 默认关闭，阶段批准前不得据此新增阶段二运行时模块。
- 视觉规则以根目录 `DESIGN.md` 为准。
- 产品、状态、权限和数据规则以对应 `docs/` 与 `spec/` 真相源为准。
- 正式实现必须使用 React Native 与 Expo，不得直接把本 HTML 作为生产 App。

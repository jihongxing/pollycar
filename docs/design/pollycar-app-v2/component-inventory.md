# PollyCar App v2 共享组件目录

## 组件分层

### 基础令牌组件

- `AppText`：统一文字层级、字体、颜色和截断；
- `AppIcon`：统一图标线宽、尺寸和语义；
- `PrimaryAction`：主要行动；
- `SecondaryAction`：可逆次要行动；
- `IconAction`：图标操作；
- `FormField`：输入、错误和辅助说明；
- `StatusBadge`：业务状态，不展示内部枚举；
- `Divider`：语义分隔；
- `FocusRing`：键盘和辅助技术焦点。

### 页面骨架组件

- `AppShell`：统一安全区、顶层环境标识和导航；
- `PageHeader`：标题、返回和顶部操作；
- `MapScene`：地图、路线、位置标记和场景层；
- `BottomSheet`：地图页面任务面板；
- `PageSection`：统一区域间距和标题层级；
- `StickyActionBar`：移动端主要操作区。

### 任务和状态组件

- `TaskSummary`：当前任务上下文；
- `StatusPanel`：加载、等待、失败、恢复和阻断；
- `EmptyState`：没有内容时的下一步；
- `RecoveryAction`：重试、返回或联系支持；
- `ConfirmDialog`：需要确认的不可逆或高后果动作；
- `ProgressState`：多阶段任务进度。

### 出行组件

- `TripContext`：行程对象、时间、地点和参与者；
- `RidePlaceRow`：出发地、目的地和历史地点；
- `VehicleSummary`：车辆摘要；
- `DriverSummary`：车主摘要；
- `PassengerSummary`：乘车人摘要；
- `TripTimeline`：行程阶段；
- `IdentitySwitcher`：乘客／车主身份切换。

### 联系和安全组件

- `MessageBubble`：消息正文和发送状态；
- `MessageComposer`：输入、草稿、发送中和失败重试；
- `ContactPolicyNotice`：联系用途和窗口说明；
- `SafetyEntry`：安全帮助和举报入口；
- `SafetyStatus`：安全冻结、恢复和后续行动。

## 组件约束

1. 组件默认样式必须来自 `tokens.json`；
2. 组件必须定义正常、加载、禁用、失败和恢复状态；
3. 组件必须定义移动端最小触摸尺寸；
4. 组件必须有可访问名称、状态和焦点行为；
5. 业务页面不得直接覆盖组件的颜色、字号和间距；
6. 组件不能为了支持单个页面而增加页面专属变体；
7. 组件的变体必须表达稳定的产品语义，而不是开发方便；
8. 任何新增视觉模式先回到设计源评审。

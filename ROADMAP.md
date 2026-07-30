# 产品路线图

## 当前状态

`允许生产级代码实现；禁止生产启用`

用户端保持一个 App 和一个账户；普通用户默认进入叫车首页，具备资格的用户可进入车主工作模式。运营后台保持独立。所有实现只可使用内部沙箱与合成数据。

```yaml
synthetic_admin_multi_organization: false
synthetic_admin_authentication: false
synthetic_admin_role_access_matrix: false
synthetic_admin_operator_management: false
synthetic_admin_driver_vehicle: false
synthetic_admin_trip_operations: false
synthetic_admin_case_management: false
synthetic_admin_finance_operations: false
synthetic_admin_executive_dashboard: false
synthetic_admin_audit_system: false
synthetic_admin_data_reports: false
synthetic_admin_organization_accounts: false
real_admin_organization_accounts: false
real_admin_finance_operations: false
production_admin_enabled: false
production_enabled: false
synthetic_financial_ledger: false
synthetic_financial_reconciliation: false
synthetic_operator_funds: false
real_payment: false
real_settlement: false
real_withdrawal: false
driver_early_settlement_enabled: false
real_operator_onboarding: false
paid_flex_trial: false
real_user_invitation: false
shanghai_pilot: false
real_data_ingestion: false
external_identity_provider: false
real_identity_verification: false
real_biometric_verification: false
real_driver_liveness_verification: false
real_sms_delivery: false
real_phone_data: false
production_authentication: false
real_map: false
external_map_provider: false
real_device_location: false
background_location: false
real_vehicle_location_stream: false
amap_sdk: false
amap_web_service: false
internal_sandbox: true
```

以上仅表示当前有效启用状态；生产能力的机器事实源、四维生命周期、批准证据和依赖关系以 `spec/platform/feature-gates.yaml` 为准。

## 正在做

目标调整为“发布候选准备”：先建立正式构建、正式应用标识、生产 API、供应商批准和真实数据边界，未完成独立发布评审前继续禁止生产启用。

1. 继续第四阶段前台地图的设备与服务端验收：在 Android 实体设备完成受控底图验证，在 macOS／Xcode 环境完成 iOS 编译与设备验证；取得独立 Server Web Service Key 后再验证搜索、逆地理编码和路线规划。正式应用标识、真实设备定位、后台定位、车辆位置流和生产启用继续关闭。
2. 由实际企业主体完成高德企业认证、技术服务许可、合同和数据处理条款，并回填 Android、iOS、移动 Web 与 Server Key 的批准证据；证据完成前不得启用真实高德调用。
3. 完成已提交高德 Android Key 的外部吊销与轮换，登记正式 Android/iOS 签名、基础镜像 digest、镜像仓库、签名身份和保留策略；仓库已接入失败关闭 CI，但未完成这些外部证据前禁止发布镜像或启用真实地图。

## 随后任务

1. 按决策 `0036` 为腾讯云短信、腾讯云慧眼和阿里云 IDaaS 准备企业账号、隔离测试应用、托管 Secret Reference、合同和数据处理材料，取得六类正式批准后执行供应商沙箱测试。
2. 建立生产密钥系统，创建并绑定 Android 调试／发布、iOS、移动 Web JS API 和 Server Web Service Key，完成泄漏与轮换演练。
3. 批准 Android 发布 SHA1 和生产应用标识；在获得外部批准后启用已完成的 SDK 接入骨架，依次验证底图、POI、逆地理编码和路线规划。
4. 基础地图能力验收通过后，单独评审真实车辆位置、上传频率和后台定位，不与基础 SDK 启用合并批准。
5. 部署长期运行的内部生产级沙箱，保持真实支付、真实短信、真实身份数据、真实邀请、真实地图和上海试点关闭。
6. 执行故障恢复、并发、数据删除、供应商失败、公平性和安全演练。
7. 完成 Android、iOS、屏幕阅读器、慢网、离线和真实设备验收；在设备环境具备前保留浏览器移动视口与 Windows Android 模拟器回归。
8. 汇总除真实支付外的生产启用门槛证据，并形成“是否允许生产启用”的独立评审结论。
9. 按评审中决策 `0023` 完成真实头像阶段一跨职能评审；阿里云上海地域的 OSS、EventBridge、Function Compute、内容安全与 CDN 候选边界已经冻结，仍需关闭隐私影响、合同、数据驻留、恶意文件检测证据、人工复核、保留删除和灰度回滚阻断，未批准前不得进入生产实现。
10. 按决策 `0024` 和评审中决策 `0025` 完成乘客与车主认证重构；腾讯云车辆材料 OCR 的默认关闭适配、字段最小化和平台预审已进入实现，后续补齐真实文件隔离上传、专用测试凭据、外部联调、人工复核队列和生产启用评审。真实用户材料、真实身份数据和生产认证继续关闭。

## 阻断项

1. 真实身份证件和真实人脸数据接入需要法律与隐私影响评估、身份服务供应商、安全方案、数据流、保留期限、删除机制和跨境风险批准。
2. 车主上线活体检测需要完成供应商选择、摄像头与生物特征单独授权、数据驻留、保留删除、误拒与公平性、可访问性、攻击专项、人工恢复和申诉机制评审。
3. 第三方身份服务需要完成采集告知、单独授权、供应商合同、数据处理责任和申诉机制评审。
4. 性别分阶段强制弱展示需要明确公平性指标、停止阈值，并通过歧视、拒单、取消、骚扰和举报差异评审。
5. Android 实体设备和 macOS／iOS 执行环境当前不可用，不能宣称真实设备验收通过。
6. 生产启用、真实用户邀请、上海试点和真实数据写入必须获得单独批准。
7. 真实支付是本阶段唯一明确排除能力，继续保持关闭，不进入上述任务的启用范围。
8. 真实短信发送、真实手机号写入和生产认证必须完成供应商、隐私、安全、反滥用、号码回收与人工恢复评审。
9. 真实高德地图、真实设备定位、后台定位和真实车辆位置流必须完成企业认证、技术服务许可、商用授权、隐私影响评估、密钥管理、数据生命周期和移动端官方 SDK 验收。
9. 高德接入评审已完成，但企业认证、许可购买、合同签署和真实 Key 创建属于企业外部操作；证据回填前不得将“评审完成”解释为“授权完成”。
10. 当前受控环境已持有 Android API Key、移动 Web JS API Key 与安全码，并完成移动 Web 真实底图内部验证；仍未提供 iOS API Key 和 Server Web Service Key，`app.json` 中 Android Package 与 iOS Bundle Identifier 仍为占位标识，Android 实体设备与 macOS／Xcode 验收环境不可用，因此 iOS、服务端地点能力、正式构建和真实设备验收继续阻断，合成地图保持默认回退。
11. 真实头像阶段一已冻结阿里云上海地域供应商候选和三 Bucket 隔离拓扑，但仍缺少隐私影响评估、企业合同与数据处理协议、恶意文件检测时延及失败关闭证据、受控重编码镜像、人工复核、删除证明、容量演练和跨职能签署；当前仅允许内部沙箱合成链路。
12. 腾讯云车辆材料 OCR 已确定驾驶证、行驶证和保险材料接口边界，但仍缺少腾讯云专用测试账号与密钥、数据处理条款、图片处理和保存删除证明、真实文件隔离上传、恶意文件检测、预算熔断及外部联调证据；完成前不得接收真实用户材料或启用生产调用。
13. 共享预生产尚未选择云供应商、独立账号、境内区域、预算、域名和监控存储，产品与生产决策、工程运维、安全、隐私合规和财务五类批准均为未批准；证据回填前资源创建与部署必须失败关闭。
14. 真实账号与认证已选择腾讯云短信、腾讯云慧眼和阿里云 IDaaS，并关闭十项账号策略决策；当前仍有 37 项外部阻断，包括三类企业账号与测试环境、九项供应商凭据／合同／数据处理证据、五项密钥与轮换证据、六类批准及其证据和五类验收证据。完成前不得创建真实认证数据库结构、挂载生产认证路由或接入真实数据。

## 最近已完成

| 事项 | 状态 | 完成日期 | 验证 |
| --- | --- | --- | --- |
| 阶段三供应商候选与账号策略决策 | 已完成 | 2026-07-30 | 选择腾讯云短信、腾讯云慧眼人脸核身和阿里云 IDaaS EIAM 作为供应商测试候选，关闭九项剩余账号策略，形成三类供应商失败关闭测试计划和六类批准登记入口。机器报告保留 70 项安全基线，并将当前剩余外部阻断收敛为 37 项；真实账号、真实数据、供应商调用和生产认证继续关闭。 |
| 阶段三真实账号与认证证据门禁 | 已完成 | 2026-07-30 | 新增十项账号策略决策、三条供应商链路、五项密钥与轮换证据、六类批准和五类验收证据的固定契约、空值模板与只读报告，并补齐运营后台 OIDC 关闭态端口。安全模板稳定输出 `blocked`、70 项阻断和 `realDataUsed=false`；Server 262 项测试与类型检查通过，真实账号、真实数据、认证路由、生产迁移和生产启用继续关闭。 |
| 旧配置入口删除批次七 | 已完成 | 2026-07-30 | 删除 App Demo 的旧 API Base URL 读取、Playwright 的 `POLLYCAR_E2E_*` 端口别名、生产数据库双名称、旧品牌／Admin／高德公开变量兼容痕迹和 `.env.example` 双套能力开关；统一生产数据库为 `POLLYCAR_DATABASE_URL`。新增 44 项废弃变量清单、运行时硬拒绝、源码静态扫描和预检专项门禁，历史名称只保留审计记录。配置包 30 项测试、Contracts 14 项配置治理测试、两包类型检查和批次七专项门禁通过，真实供应商、真实数据和生产能力保持关闭。 |
| 原生构建、EAS、CI 与供应链统一批次六 | 已完成 | 2026-07-30 | 新增共享构建配置校验器，固定 Node 22、pnpm 10.22.0、Java 17、EAS CLI 21.4.0 与 `postgres:17-alpine`，统一接入 App 本地生产发布准备、EAS、GitHub 质量门禁、PostgreSQL 集成测试、Android／iOS 无签名 Release 编译和供应链工作流。生产发布继续要求版本化 `PublicConfig`、正式应用标识、签名模式、高德批准和外部批准；镜像发布继续要求四项真实 digest、仓库、OIDC 签名身份和发布批准，并只签名实际构建 digest。配置包 28 项测试、专项门禁与配置治理检查通过，未发布镜像或启用生产能力。 |
| 供应商、密钥与安全策略统一批次五 | 已完成 | 2026-07-30 | 统一短信、身份、Admin OIDC、腾讯云 OCR 与高德 Server 配置，所有供应商凭据改为托管 Secret Reference；高德与 OCR Adapter 不再接收环境变量密钥名或原始凭据。新增版本化 `authentication.v1`，收口验证码、用户会话、车主活体授权、运营后台锁定与会话策略，并限制 HTTP Body 为 `16 KiB` 至 `2 MiB`。配置、Contracts、Server 专项测试、类型检查和治理门禁通过，真实供应商与生产认证继续关闭。 |
| Server 配置入口统一批次三 | 已完成 | 2026-07-30 | 将沙箱、生产准备、生产认证准备、迁移和 PostgreSQL 集成测试配置统一收口到 `@pollycar/configuration`；Server 全部源码已无直接 `process.env`，PostgreSQL、HTTPS 代理、监控、托管密钥引用、受控供应商 SecretProvider 与 JSON Body Limit 由统一 Profile 派生。配置与 Server 专项测试、类型检查及治理检查通过，真实能力保持关闭。 |
| Admin/App 公开配置统一批次四 | 已完成 | 2026-07-30 | 新增版本化 `public.snapshot`，Admin/App 业务源码各自只通过一个适配器消费白名单 `PublicConfig`；API 地址、Admin 能力、App 展示环境和 Web 地图公开字段统一解析，构建环境会剥离其他 `VITE_*`／`EXPO_PUBLIC_*` 变量并扫描产物阻断 L2/L3、批准引用和旧变量泄漏。配置包、两端专项测试与类型检查通过，真实能力保持关闭。 |
| 本地沙箱网络与能力统一批次二 | 已完成 | 2026-07-30 | 新增 `@pollycar/configuration` 单一 Profile，统一 `4173/4321/8181`、API 地址、CORS、Vite Proxy、Admin／Server 合成能力、启动脚本和 Playwright；三端类型检查、专项测试与沙箱构建通过，真实能力保持关闭。 |
| 统一配置全量审计与契约批次一 | 已完成 | 2026-07-30 | 完成第二轮全量审计，将约 127 个配置形态归并为 26 个配置族、54 个统一键；决策 `0034`、机器规范、六类 Profile、敏感等级、旧名映射、未知变量与原始密钥检查已落盘，现有 Admin、Server、App 运行入口和全部生产能力状态保持不变。 |
| 车主上线前合成人脸活体检测 | 已完成 | 2026-07-30 | 完成服务端随机一至三个动作、五分钟一次性上线授权、账户／设备／登录会话／挑战／策略版本绑定、幂等与并发消费、过期与重放防护、会话边界强制下线，以及 App 相机权限、动作引导、失败恢复和自动上线流程。Contracts、Server、App 单元与 HTTP 专项测试、类型检查和构建通过；浏览器在 390×844 与 375×812 验证权限拒绝、两步随机动作、自动上线、摄像头释放、下线后重新检测，控制台无新增错误。真实供应商、真实人脸数据和生产启用继续关闭。 |

## 随后做

按“正在做”完成后从“待完成”首项顺序推进；只有实际代码闭环发现更高优先级阻断时才调整顺序。

## 明确阻断

- 真实支付、付费弹性资格、真实用户邀请、上海试点和真实数据接入。
- 真实身份、车辆材料、位置、聊天内容、生产数据库和共享部署。
- 车辆保险、经营资质、城市辖区、安全响应、真实资金责任和税务的外部结论。

## 工作方式

- 普通功能直接进入代码和最小测试；不再创建实施包、页面清单、旅程或评审文档。
- 改变公开 API、状态、权限或数据载荷时，只更新对应 `spec/` 与测试。
- 仅高风险、难逆转或需要外部批准的事项进入 `docs/decisions/`；只有此类事项才可能需要实施包。
- 历史设计和实施文档保留作追溯基线，不构成日常更新任务。
- 当前任务完成后，必须从“正在做”移入“最近已完成”，记录状态、完成日期和一句可验证结果；只保留最近十项，超出后删除最旧条目。

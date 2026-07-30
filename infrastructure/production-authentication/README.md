# 真实账号与认证就绪证据

本目录保存阶段三“真实账号与认证”的机器可校验证据契约、安全空值基线和当前进展快照。当前目标只是在共享预生产环境具备供应商测试联调条件，不代表允许接入真实账号、真实身份数据或生产认证流量。

## 安全边界

- 不得在本目录保存真实手机号、身份证件、人脸图像、生物特征、验证码、访问令牌、供应商完整令牌或任何原始密钥值。
- 密钥和供应商凭据只能填写托管 Secret Reference，例如 `vault://` 或 `secret://` 引用。
- 合同、批准和验收材料只填写受控证据引用，不复制材料正文或个人信息。
- `readiness-evidence.example.json` 必须保持为安全空值模板，仅允许 `synthetic_and_provider_test_data_only` 数据范围。
- `readiness-evidence.current.json` 只登记已真实完成的选择、决策、批准和证据；不得预填企业账号、合同、密钥或验收结果。
- 报告为 `ready` 时，只表示允许进入供应商测试环境联调；生产认证、认证路由、生产迁移和真实数据仍固定关闭。

## 生成报告

在仓库根目录运行：

```powershell
pnpm production-authentication:report
```

默认读取：

```text
infrastructure/production-authentication/readiness-evidence.current.json
```

默认输出：

```text
output/production-authentication/readiness.json
```

报告会校验固定版本、共享预生产环境、十项账号策略决策、三条供应商链路、五项密钥与轮换证据、六类批准和五类验收证据。缺项、额外字段、错误环境或无效证据引用均按失败关闭处理。

当前进展快照应稳定输出 37 项剩余阻断。需要重新生成原始 70 项安全基线时运行：

```powershell
pnpm production-authentication:report:baseline
```

基线报告默认输出：

```text
output/production-authentication/readiness-baseline.json
```

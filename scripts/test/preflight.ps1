param(
  [switch]$SkipProjectTests,
  [switch]$FullGovernance
)

$ErrorActionPreference = "Stop"

Write-Host "== 治理检查 =="
& "$PSScriptRoot\check-doc-governance.ps1"

Write-Host "== 生产能力门禁对齐检查 =="
& "$PSScriptRoot\check-feature-gate-alignment.ps1"

Write-Host "== 统一配置治理检查 =="
& "$PSScriptRoot\check-configuration-governance.ps1"
Write-Host "== 批次七旧配置入口删除检查 =="
& "$PSScriptRoot\check-deprecated-configuration-entrypoints.ps1"
Write-Host "== 统一原生构建、EAS、CI 与供应链配置检查 =="
& "$PSScriptRoot\check-build-configuration-boundary.ps1"

Write-Host "== 品牌安全检查 =="
& "$PSScriptRoot\check-brand-safety.ps1"

Write-Host "== 领域与安全规范检查 =="
& "$PSScriptRoot\check-domain-specs.ps1"

Write-Host "== 规范结构检查 =="
& "$PSScriptRoot\check-spec-schemas.ps1"

Write-Host "== 地图与位置规范检查 =="
& "$PSScriptRoot\check-map-location-spec.ps1"

Write-Host "== 错误码与验收场景检查 =="
& "$PSScriptRoot\check-api-scenarios.ps1"

Write-Host "== OpenAPI 操作策略检查 =="
& "$PSScriptRoot\check-openapi-policies.ps1"

if ($FullGovernance) {
  Write-Host "== 生产准备机器契约检查 =="
  & "$PSScriptRoot\check-production-contracts.ps1"

  Write-Host "== 共享预生产架构与审批门禁检查 =="
  & "$PSScriptRoot\check-shared-preproduction-design.ps1"

  Write-Host "== 共享预生产 IaC 只读计划与 apply 门禁检查 =="
  & "$PSScriptRoot\check-shared-preproduction-iac.ps1"

  Write-Host "== 容器供应链本地证据与失败关闭门禁检查 =="
  & "$PSScriptRoot\check-container-supply-chain.ps1"

  Write-Host "== 本地故障演练报告与证据校验检查 =="
  & "$PSScriptRoot\check-operational-drill-evidence.ps1"

  Write-Host "== 生产候选就绪汇总报告检查 =="
  & "$PSScriptRoot\check-production-candidate-readiness.ps1"

  Write-Host "== 真实账号与认证生产接入准备检查 =="
  & "$PSScriptRoot\check-production-authentication-readiness.ps1"
  Write-Host "== 真实账号与认证证据门禁检查 =="
  & "$PSScriptRoot\check-production-authentication-evidence.ps1"

  Write-Host "== 运营后台设计与准入检查 =="
  & "$PSScriptRoot\check-admin-specs.ps1"

  Write-Host "== 运营后台账号认证实施前契约检查 =="
  & "$PSScriptRoot\check-admin-authentication-design.ps1"

  Write-Host "== 运营后台角色权限矩阵实施前契约检查 =="
  & "$PSScriptRoot\check-admin-role-access-matrix-design.ps1"

  Write-Host "== 运营后台产品化高保真方案实施前检查 =="
  & "$PSScriptRoot\check-admin-product-experience-design.ps1"

  Write-Host "== 运营控制台阶段一实施前设计检查 =="
  & "$PSScriptRoot\check-admin-stage-one-design.ps1"

  Write-Host "== 运营控制台阶段一多组织后台底座实施检查 =="
  & "$PSScriptRoot\check-admin-stage-one-implementation.ps1"

  Write-Host "== 运营控制台阶段二实施前设计检查 =="
  & "$PSScriptRoot\check-admin-stage-two-design.ps1"

  Write-Host "== 运营控制台阶段二组织与运力合成内核实施检查 =="
  & "$PSScriptRoot\check-admin-stage-two-implementation.ps1"

  Write-Host "== 运营控制台阶段三实施前设计检查 =="
  & "$PSScriptRoot\check-admin-stage-three-design.ps1"

  Write-Host "== 运营控制台阶段三行程客服安全合成内核实施检查 =="
  & "$PSScriptRoot\check-admin-stage-three-implementation.ps1"

  Write-Host "== 运营控制台阶段四资金运营实施前设计检查 =="
  & "$PSScriptRoot\check-admin-stage-four-design.ps1"

  Write-Host "== 运营控制台阶段四资金运营合成内核实施检查 =="
  & "$PSScriptRoot\check-admin-stage-four-implementation.ps1"

  Write-Host "== 运营控制台阶段五高层驾驶舱实施前设计检查 =="
  & "$PSScriptRoot\check-admin-stage-five-design.ps1"
  Write-Host "== 运营控制台阶段五高层驾驶舱合成内核实施检查 =="
  & "$PSScriptRoot\check-admin-stage-five-implementation.ps1"

  Write-Host "== 运营后台实施检查 =="
  & "$PSScriptRoot\check-admin-implementation.ps1"

  Write-Host "== 运营后台 Server 沙箱 API 检查 =="
  & "$PSScriptRoot\check-admin-sandbox-api.ps1"

  Write-Host "== App E2E 与可访问性实施检查 =="
  & "$PSScriptRoot\check-app-e2e.ps1"

  Write-Host "== Android 与 iOS 真实设备 QA 基础检查 =="
  & "$PSScriptRoot\check-device-qa.ps1"
} else {
  Write-Host "== 严格治理检查 =="
  Write-Host "已跳过历史设计与实施基线检查；高风险、发布或跨应用变更请使用 -FullGovernance。"
}

if (-not $SkipProjectTests) {
  Write-Host "== 项目测试 =="
  Push-Location (Resolve-Path (Join-Path $PSScriptRoot "..\.."))
  try {
    pnpm typecheck
    if ($LASTEXITCODE -ne 0) { throw "项目类型检查失败，退出码: $LASTEXITCODE" }
    pnpm test
    if ($LASTEXITCODE -ne 0) { throw "项目单元测试失败，退出码: $LASTEXITCODE" }
    pnpm test:scenarios
    if ($LASTEXITCODE -ne 0) { throw "项目场景测试失败，退出码: $LASTEXITCODE" }
    pnpm build
    if ($LASTEXITCODE -ne 0) { throw "项目构建失败，退出码: $LASTEXITCODE" }
    & "$PSScriptRoot\check-public-config-boundary.ps1" -RequireBuildOutputs
    if ($FullGovernance) {
      pnpm test:e2e
      if ($LASTEXITCODE -ne 0) { throw "App E2E 与可访问性测试失败，退出码: $LASTEXITCODE" }
    }
  } finally {
    Pop-Location
  }
}

Write-Host "预检完成。"
$global:LASTEXITCODE = 0

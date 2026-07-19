param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("android", "ios")]
  [string]$Platform,
  [Parameter(Mandatory = $true)]
  [string]$ProfileId,
  [Parameter(Mandatory = $true)]
  [ValidateSet("first_time_user", "passenger", "owner", "exception_recovery")]
  [string]$Journey,
  [Parameter(Mandatory = $true)]
  [string]$TesterId,
  [Parameter(Mandatory = $true)]
  [string]$BuildId,
  [ValidateSet("core", "vehicle", "offline")]
  [string]$Flow = "core"
)

$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$matrix = Get-Content -LiteralPath (Join-Path $repo "qa\device-matrix.json") -Raw | ConvertFrom-Json
$profile = $matrix.profiles | Where-Object profileId -eq $ProfileId | Select-Object -First 1
if (-not $profile) {
  throw "未知设备配置: $ProfileId"
}
if ($profile.platform -ne $Platform) {
  throw "设备配置 $ProfileId 不属于 $Platform。"
}

$deviceName = "未识别设备"
$osVersion = "未知版本"

$flowFiles = @{
  core = "qa\maestro\app-core.yaml"
  vehicle = "qa\maestro\vehicle-form.yaml"
  offline = "qa\maestro\offline-recovery.yaml"
}
$flowPath = Join-Path $repo $flowFiles[$Flow]

try {
  if (-not (Get-Command maestro -ErrorAction SilentlyContinue)) {
    throw "未找到 Maestro CLI，无法运行真实设备 QA。"
  }
  if ($Platform -eq "android") {
    if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
      throw "未找到 adb，无法验证 Android 设备连接。"
    }
    $devices = adb devices
    if (($devices | Select-String "`tdevice$").Count -eq 0) {
      throw "没有已连接并授权的 Android 设备或模拟器。"
    }
    $deviceName = (adb shell getprop ro.product.model).Trim()
    $osVersion = (adb shell getprop ro.build.version.release).Trim()
  } elseif ($env:OS -eq "Windows_NT") {
    throw "iOS 真实设备 QA 必须在安装 Xcode 的 macOS 主机运行。"
  }

  Push-Location $repo
  try {
    maestro test $flowPath -e "PLATFORM=$Platform"
    if ($LASTEXITCODE -ne 0) {
      throw "$Platform 设备 QA 失败，退出码: $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }

  & "$PSScriptRoot\record-device-qa.ps1" `
    -ProfileId $ProfileId -Journey $Journey -Flow $Flow -Status passed `
    -TesterId $TesterId -BuildId $BuildId -DeviceName $deviceName -OsVersion $osVersion `
    -Notes "Maestro 自动化流程通过。"
} catch {
  $message = $_.Exception.Message
  $status = if ($message -match "未找到|没有已连接|必须在") { "blocked" } else { "failed" }
  $recordArguments = @{
    ProfileId = $ProfileId
    Journey = $Journey
    Flow = $Flow
    Status = $status
    TesterId = $TesterId
    BuildId = $BuildId
    DeviceName = $deviceName
    OsVersion = $osVersion
    Notes = $message
  }
  if ($status -eq "failed") {
    $recordArguments.IssueSeverity = "P1"
    $recordArguments.IssueCode = "DEVICE_QA_AUTOMATION_FAILED"
  }
  & "$PSScriptRoot\record-device-qa.ps1" @recordArguments
  throw
}

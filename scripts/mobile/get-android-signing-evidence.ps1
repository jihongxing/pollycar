param(
  [string]$KeystorePath = (Join-Path $env:USERPROFILE ".android\debug.keystore"),
  [string]$Alias = "androiddebugkey",
  [string]$StorePassword = "android",
  [string]$KeyPassword = "android",
  [string]$PackageName = "com.pollycar.internal.sandbox"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $KeystorePath)) {
  throw "Android 签名文件不存在: $KeystorePath"
}

$keytool = Get-Command keytool -ErrorAction Stop
$output = & $keytool.Source -list -v `
  -keystore $KeystorePath `
  -alias $Alias `
  -storepass $StorePassword `
  -keypass $KeyPassword 2>&1

if ($LASTEXITCODE -ne 0) {
  throw "无法读取 Android 签名证据"
}

$sha1Line = $output | Select-String -Pattern "SHA1:\s*(?<sha1>[0-9A-F:]+)" | Select-Object -First 1
if (-not $sha1Line) {
  throw "Android 签名证据缺少 SHA1"
}

[pscustomobject]@{
  purpose = "internal-development-build-only"
  package_name = $PackageName
  sha1 = $sha1Line.Matches[0].Groups["sha1"].Value
  keystore_path = (Resolve-Path -LiteralPath $KeystorePath).Path
  production_evidence = $false
} | ConvertTo-Json

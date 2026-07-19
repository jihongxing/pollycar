param(
  [Parameter(Mandatory=$true)]
  [string]$TargetPath,
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$target = Resolve-Path -LiteralPath $TargetPath
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$template = Split-Path -Parent $scriptDir

$copied = @()
$skipped = @()

Get-ChildItem -LiteralPath $template -Recurse -File -Force | Where-Object {
  $_.FullName -notmatch [regex]::Escape("scripts\init-full-product-system.ps1")
} | ForEach-Object {
  $relative = $_.FullName.Substring($template.Length).TrimStart('\','/')
  $dest = Join-Path $target $relative
  $destDir = Split-Path -Parent $dest
  New-Item -ItemType Directory -Force -Path $destDir | Out-Null

  if ((Test-Path -LiteralPath $dest) -and -not $Force) {
    $skipped += $relative
    return
  }

  Copy-Item -LiteralPath $_.FullName -Destination $dest -Force:$Force
  $copied += $relative
}

Write-Host "Full product system template applied to $target"
Write-Host "Copied: $($copied.Count)"
$copied | ForEach-Object { Write-Host "  + $_" }
Write-Host "Skipped existing: $($skipped.Count)"
$skipped | ForEach-Object { Write-Host "  = $_" }

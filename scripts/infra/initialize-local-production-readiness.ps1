param(
  [string]$Root = (Join-Path $PSScriptRoot "..\..\infrastructure\local-production")
)

$ErrorActionPreference = "Stop"

$rootPath = Resolve-Path $Root
$certificates = Join-Path $rootPath "certificates"
$secrets = Join-Path $rootPath "secrets"
$state = Join-Path $rootPath "state"
New-Item -ItemType Directory -Force -Path $certificates, $secrets, $state | Out-Null

$passwordPath = Join-Path $secrets "postgres-password.txt"
if (-not (Test-Path -LiteralPath $passwordPath)) {
  $bytes = New-Object byte[] 24
  $randomNumberGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $randomNumberGenerator.GetBytes($bytes)
  } finally {
    $randomNumberGenerator.Dispose()
  }
  [Convert]::ToBase64String($bytes).Replace("+", "A").Replace("/", "B").Replace("=", "C") |
    Set-Content -LiteralPath $passwordPath -NoNewline
}

$caKey = Join-Path $certificates "postgres-ca.key"
$caCertificate = Join-Path $secrets "postgres-ca.crt"
$postgresKey = Join-Path $secrets "postgres-server.key"
$postgresCertificate = Join-Path $secrets "postgres-server.crt"
$proxyKey = Join-Path $certificates "proxy.key"
$proxyCertificate = Join-Path $certificates "proxy.crt"

if (-not (Test-Path -LiteralPath $caCertificate)) {
  & openssl genrsa -out $caKey 4096
  & openssl req -x509 -new -nodes -key $caKey -sha256 -days 30 -out $caCertificate -subj "/CN=PollyCar Local Production CA"
}

if (-not (Test-Path -LiteralPath $postgresCertificate)) {
  $configuration = Join-Path $secrets "postgres-openssl.cnf"
  @"
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no
[req_distinguished_name]
CN = postgres
[v3_req]
subjectAltName = @alt_names
[alt_names]
DNS.1 = postgres
"@ | Set-Content -LiteralPath $configuration
  $request = Join-Path $secrets "postgres-server.csr"
  & openssl genrsa -out $postgresKey 2048
  & openssl req -new -key $postgresKey -out $request -config $configuration
  & openssl x509 -req -in $request -CA $caCertificate -CAkey $caKey -CAcreateserial -out $postgresCertificate -days 30 -sha256 -extensions v3_req -extfile $configuration
  Remove-Item -LiteralPath $request, $configuration -Force
}

if (-not (Test-Path -LiteralPath $proxyCertificate)) {
  $configuration = Join-Path $certificates "proxy-openssl.cnf"
  @"
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no
[req_distinguished_name]
CN = localhost
[v3_req]
subjectAltName = @alt_names
[alt_names]
DNS.1 = localhost
DNS.2 = api.pollycar.example
"@ | Set-Content -LiteralPath $configuration
  $request = Join-Path $certificates "proxy.csr"
  & openssl genrsa -out $proxyKey 2048
  & openssl req -new -key $proxyKey -out $request -config $configuration
  & openssl x509 -req -in $request -CA $caCertificate -CAkey $caKey -CAcreateserial -out $proxyCertificate -days 30 -sha256 -extensions v3_req -extfile $configuration
  Remove-Item -LiteralPath $request, $configuration -Force
}

Write-Output "本地生产就绪证书和非生产数据库口令已生成：$rootPath"

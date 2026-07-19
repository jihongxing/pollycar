$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$specPath = Join-Path $repo "spec\domain\map-location.yaml"
$schemaPath = Join-Path $repo "spec\meta\map-location.schema.json"
$contractPath = Join-Path $repo "packages\contracts\src\map-location.ts"
$gatesPath = Join-Path $repo "packages\contracts\src\feature-gates.ts"
$documentPath = Join-Path $repo "docs\product\09-地图与位置能力设计.md"
$servicePath = Join-Path $repo "apps\server\src\application\map-location-service.ts"
$providerPath = Join-Path $repo "apps\server\src\adapters\synthetic-map-provider.ts"
$routesPath = Join-Path $repo "apps\server\src\http\map-location-routes.ts"
$appClientPath = Join-Path $repo "apps\app\src\infrastructure\http-map-location-client.ts"
$vehicleLocationPath = Join-Path $repo "apps\server\src\application\vehicle-location-service.ts"
$amapProviderPath = Join-Path $repo "apps\server\src\adapters\amap-web-service-provider.ts"
$nativeModulePath = Join-Path $repo "apps\app\src\native\map-native-module.ts"
$expoPluginPath = Join-Path $repo "apps\app\plugins\with-pollycar-map-module.cjs"
$amapBuildPolicyPath = Join-Path $repo "apps\app\plugins\amap-build-policy.cjs"

foreach ($path in @($specPath, $schemaPath, $contractPath, $gatesPath, $documentPath, $servicePath, $providerPath, $routesPath, $appClientPath, $vehicleLocationPath, $amapProviderPath, $nativeModulePath, $expoPluginPath, $amapBuildPolicyPath)) {
  if (-not (Test-Path -LiteralPath $path)) { throw "地图与位置规范缺少文件: $path" }
}

$spec = Get-Content -LiteralPath $specPath -Raw
$schema = Get-Content -LiteralPath $schemaPath -Raw | ConvertFrom-Json
$contract = Get-Content -LiteralPath $contractPath -Raw
$gates = Get-Content -LiteralPath $gatesPath -Raw
$document = Get-Content -LiteralPath $documentPath -Raw
$service = Get-Content -LiteralPath $servicePath -Raw
$provider = Get-Content -LiteralPath $providerPath -Raw
$routes = Get-Content -LiteralPath $routesPath -Raw
$appClient = Get-Content -LiteralPath $appClientPath -Raw
$vehicleLocation = Get-Content -LiteralPath $vehicleLocationPath -Raw
$amapProvider = Get-Content -LiteralPath $amapProviderPath -Raw
$nativeModule = Get-Content -LiteralPath $nativeModulePath -Raw
$expoPlugin = Get-Content -LiteralPath $expoPluginPath -Raw
$amapBuildPolicy = Get-Content -LiteralPath $amapBuildPolicyPath -Raw

foreach ($required in @(
  'spec_id: "pollycar.domain.map-location"',
  'active: "synthetic"',
  'real_map_enabled: false',
  'external_map_provider_enabled: false',
  'real_device_location_enabled: false',
  'background_location_enabled: false',
  'real_vehicle_location_stream_enabled: false',
  'amap_sdk_enabled: false',
  'amap_web_service_enabled: false',
  'client_web_service_key_forbidden: true'
)) {
  if ($spec -notmatch [regex]::Escape($required)) { throw "地图机器规范缺少: $required" }
}

foreach ($required in @(
  "VehicleLocationService",
  "VEHICLE_LOCATION_TOO_FREQUENT",
  "VEHICLE_LOCATION_STREAM_STOPPED",
  "evidenceHold",
  "purgeExpired",
  "toFixed(5)"
)) {
  if ($vehicleLocation -notmatch [regex]::Escape($required)) { throw "实时车辆位置实现缺少: $required" }
}

foreach ($required in @(
  "AMAP_WEB_SERVICE_DISABLED",
  "POLLYCAR_AMAP_WEB_SERVICE_KEY",
  "SecretProvider"
)) {
  if ($amapProvider -notmatch [regex]::Escape($required)) { throw "高德 Web 服务适配器缺少: $required" }
}

foreach ($required in @(
  "DisabledNativeMapModule",
  "REAL_DEVICE_LOCATION_DISABLED",
  "BACKGROUND_LOCATION_DISABLED",
  "amapSdkEnabled: false"
)) {
  if ($nativeModule -notmatch [regex]::Escape($required)) { throw "Expo 原生地图壳缺少: $required" }
}

if (
  $expoPlugin -notmatch "resolveAmapBuildPolicy" -or
  $amapBuildPolicy -notmatch "AMAP_SDK_PRODUCTION_APPROVAL_REQUIRED"
) {
  throw "高德构建策略未阻止未经批准的 SDK 启用"
}

& "$PSScriptRoot\check-amap-native-integration.ps1"

foreach ($required in @(
  "CoordinateSystem",
  "GeoPoint",
  "MapPlace",
  "PlaceSearchRequest",
  "ReverseGeocodeRequest",
  "RoutePlanningRequest",
  "PlannedRoute",
  "VehicleLocationUpdate",
  "MapCacheMetadata",
  "MapCapabilityGates",
  "MapProvider",
  "CoordinateTransformer"
)) {
  if ($contract -notmatch [regex]::Escape($required)) { throw "地图公开契约缺少: $required" }
}

foreach ($required in @(
  "realMap",
  "externalMapProvider",
  "realDeviceLocation",
  "backgroundLocation",
  "realVehicleLocationStream",
  "amapSdk",
  "amapWebService"
)) {
  if ($gates -notmatch [regex]::Escape($required)) { throw "地图门禁缺少: $required" }
}

foreach ($required in @(
  "150,000",
  "3,000,000",
  "9,000,000",
  "5,000",
  "50,000",
  "500,000",
  "30 元/万次",
  "React Native",
  "Expo",
  "GCJ-02"
)) {
  if ($document -notmatch [regex]::Escape($required)) { throw "地图设计文档缺少官方核验或架构内容: $required" }
}

if ($schema.properties.spec_id.PSObject.Properties["const"].Value -ne "pollycar.domain.map-location") {
  throw "地图 JSON Schema 的 spec_id 不正确"
}

foreach ($required in @(
  "MapLocationService",
  "MAP_SEARCH_RATE_LIMITED",
  "MAP_PROVIDER_TIMEOUT",
  "MAP_QUOTA_DEGRADED",
  "300_000",
  "600_000",
  "60_000"
)) {
  if ($service -notmatch [regex]::Escape($required)) { throw "地图 Server 服务缺少: $required" }
}

foreach ($required in @("SyntheticMapProvider", "StrictCoordinateTransformer", "validateGeoPoint")) {
  if ($provider -notmatch [regex]::Escape($required)) { throw "地图合成适配器缺少: $required" }
}

foreach ($required in @(
  "/v1/internal-sandbox/app/map/places/search",
  "/v1/internal-sandbox/app/map/reverse-geocode",
  "/v1/internal-sandbox/app/map/routes/driving"
)) {
  if ($routes -notmatch [regex]::Escape($required)) { throw "地图 HTTP 路由缺少: $required" }
  if ($appClient -notmatch [regex]::Escape($required)) { throw "App 地图客户端缺少: $required" }
}

Write-Host "地图与位置供应商中立规范及合成实现检查通过。"

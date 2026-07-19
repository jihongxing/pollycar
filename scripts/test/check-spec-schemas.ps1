$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")

function Convert-YamlScalar {
  param([string]$Text)

  $value = $Text.Trim()
  if ($value -eq "") {
    return $null
  }
  if ($value -eq "null" -or $value -eq "~") {
    return $null
  }
  if ($value -eq "true") {
    return $true
  }
  if ($value -eq "false") {
    return $false
  }
  if ($value -match '^-?[0-9]+$') {
    return [long]$value
  }
  if ($value -match '^-?[0-9]+\.[0-9]+$') {
    return [double]::Parse($value, [System.Globalization.CultureInfo]::InvariantCulture)
  }
  if ($value.StartsWith('"') -and $value.EndsWith('"')) {
    return ($value | ConvertFrom-Json)
  }
  if ($value.StartsWith("[") -and $value.EndsWith("]")) {
    $list = New-Object System.Collections.ArrayList
    $inner = $value.Substring(1, $value.Length - 2).Trim()
    if ($inner -ne "") {
      $matches = [regex]::Matches($inner, '"((?:\\.|[^"])*)"')
      $withoutStrings = [regex]::Replace($inner, '"((?:\\.|[^"])*)"', "").Replace(",", "").Trim()
      if ($withoutStrings -ne "") {
        throw "内联数组只允许双引号字符串: $value"
      }
      foreach ($match in $matches) {
        $decoded = ('"' + $match.Groups[1].Value + '"') | ConvertFrom-Json
        [void]$list.Add($decoded)
      }
    }
    Write-Output -NoEnumerate $list
    return
  }

  return $value
}

function ConvertFrom-RestrictedYaml {
  param([string]$Path)

  $rawLines = Get-Content -LiteralPath $Path
  $lines = New-Object System.Collections.Generic.List[object]

  for ($index = 0; $index -lt $rawLines.Count; $index++) {
    $raw = $rawLines[$index]
    if ($raw -match '^\s*$' -or $raw -match '^\s*#') {
      continue
    }
    if ($raw -match "`t") {
      throw "$Path 使用了制表符，YAML 规范只允许空格缩进"
    }

    $indent = $raw.Length - $raw.TrimStart().Length
    if ($indent % 2 -ne 0) {
      throw "$Path 第 $($index + 1) 行缩进必须为 2 的倍数"
    }

    $lines.Add([pscustomobject]@{
      Number = $index + 1
      Indent = $indent
      Text = $raw.Trim()
    })
  }

  function Parse-Block {
    param(
      [System.Collections.Generic.List[object]]$Tokens,
      [ref]$Position,
      [int]$Indent
    )

    if ($Position.Value -ge $Tokens.Count) {
      return $null
    }

    $isArray = $Tokens[$Position.Value].Indent -eq $Indent -and $Tokens[$Position.Value].Text.StartsWith("- ")
    if ($isArray) {
      $array = New-Object System.Collections.ArrayList

      while ($Position.Value -lt $Tokens.Count) {
        $token = $Tokens[$Position.Value]
        if ($token.Indent -lt $Indent) {
          break
        }
        if ($token.Indent -ne $Indent -or -not $token.Text.StartsWith("- ")) {
          throw "$Path 第 $($token.Number) 行数组结构无效"
        }

        $itemText = $token.Text.Substring(2).Trim()
        if ($itemText -eq "") {
          $Position.Value++
          $item = Parse-Block $Tokens $Position ($Indent + 2)
          [void]$array.Add($item)
          continue
        }

        if ($itemText -match '^([^:]+):\s*(.*)$') {
          $item = [ordered]@{}
          $key = $matches[1].Trim()
          $rest = $matches[2]
          if ($rest -eq "") {
            $Position.Value++
            if ($Position.Value -lt $Tokens.Count -and $Tokens[$Position.Value].Indent -gt $Indent) {
              $item[$key] = Parse-Block $Tokens $Position ($Indent + 2)
            } else {
              $item[$key] = $null
            }
          } else {
            $item[$key] = Convert-YamlScalar $rest
            $Position.Value++
          }

          while ($Position.Value -lt $Tokens.Count) {
            $child = $Tokens[$Position.Value]
            if ($child.Indent -le $Indent) {
              break
            }
            if ($child.Indent -ne ($Indent + 2) -or $child.Text.StartsWith("- ")) {
              throw "$Path 第 $($child.Number) 行对象结构无效"
            }
            if ($child.Text -notmatch '^([^:]+):\s*(.*)$') {
              throw "$Path 第 $($child.Number) 行缺少键值分隔符"
            }

            $childKey = $matches[1].Trim()
            $childRest = $matches[2]
            if ($childRest -eq "") {
              $Position.Value++
              if ($Position.Value -lt $Tokens.Count -and $Tokens[$Position.Value].Indent -gt $child.Indent) {
                $item[$childKey] = Parse-Block $Tokens $Position ($child.Indent + 2)
              } else {
                $item[$childKey] = $null
              }
            } else {
              $item[$childKey] = Convert-YamlScalar $childRest
              $Position.Value++
            }
          }

          [void]$array.Add([pscustomobject]$item)
          continue
        }

        [void]$array.Add((Convert-YamlScalar $itemText))
        $Position.Value++
      }

      return @($array)
    }

    $object = [ordered]@{}
    while ($Position.Value -lt $Tokens.Count) {
      $token = $Tokens[$Position.Value]
      if ($token.Indent -lt $Indent) {
        break
      }
      if ($token.Indent -ne $Indent -or $token.Text.StartsWith("- ")) {
        throw "$Path 第 $($token.Number) 行对象结构无效"
      }
      if ($token.Text -notmatch '^([^:]+):\s*(.*)$') {
        throw "$Path 第 $($token.Number) 行缺少键值分隔符"
      }

      $key = $matches[1].Trim()
      $rest = $matches[2]
      if ($rest -eq "") {
        $Position.Value++
        if ($Position.Value -lt $Tokens.Count -and $Tokens[$Position.Value].Indent -gt $Indent) {
          $object[$key] = Parse-Block $Tokens $Position ($Indent + 2)
        } else {
          $object[$key] = $null
        }
      } else {
        $object[$key] = Convert-YamlScalar $rest
        $Position.Value++
      }
    }

    return [pscustomobject]$object
  }

  $position = 0
  $document = Parse-Block $lines ([ref]$position) 0
  if ($position -ne $lines.Count) {
    throw "$Path 未完整解析，停在第 $($lines[$position].Number) 行"
  }

  return $document
}

function Resolve-LocalSchemaReference {
  param(
    [object]$RootSchema,
    [string]$Reference
  )

  if (-not $Reference.StartsWith("#/")) {
    throw "只支持本地 JSON Schema 引用: $Reference"
  }

  $current = $RootSchema
  $segments = $Reference.Substring(2).Split("/")
  foreach ($segment in $segments) {
    $decoded = $segment.Replace("~1", "/").Replace("~0", "~")
    $property = $current.PSObject.Properties[$decoded]
    if ($null -eq $property) {
      throw "无法解析 JSON Schema 引用: $Reference"
    }
    $current = $property.Value
  }

  return $current
}

function Get-JsonValueType {
  param([object]$Value)

  if ($null -eq $Value) { return "null" }
  if ($Value -is [bool]) { return "boolean" }
  if ($Value -is [string]) { return "string" }
  if ($Value -is [byte] -or $Value -is [int16] -or $Value -is [int32] -or $Value -is [int64] -or $Value -is [uint16] -or $Value -is [uint32] -or $Value -is [uint64]) { return "integer" }
  if ($Value -is [single] -or $Value -is [double] -or $Value -is [decimal]) { return "number" }
  if ($Value -is [System.Collections.ArrayList] -or $Value -is [System.Array]) { return "array" }
  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string]) -and -not ($Value -is [pscustomobject]) -and -not ($Value -is [System.Collections.IDictionary])) { return "array" }
  return "object"
}

function Test-SchemaNode {
  param(
    [object]$Value,
    [object]$Schema,
    [object]$RootSchema,
    [string]$InstancePath,
    [System.Collections.Generic.List[string]]$Errors
  )

  if ($null -ne $Schema.'$ref') {
    $resolved = Resolve-LocalSchemaReference $RootSchema $Schema.'$ref'
    Test-SchemaNode $Value $resolved $RootSchema $InstancePath $Errors
    return
  }

  if ($null -ne $Schema.const) {
    $expectedJson = $Schema.const | ConvertTo-Json -Compress -Depth 20
    $actualJson = $Value | ConvertTo-Json -Compress -Depth 20
    if ($expectedJson -ne $actualJson) {
      $Errors.Add("$InstancePath 必须等于 $expectedJson")
    }
  }

  if ($null -ne $Schema.enum) {
    $allowed = @($Schema.enum)
    if ($allowed -notcontains $Value) {
      $Errors.Add("$InstancePath 不在允许枚举中")
    }
  }

  $allowedTypes = @()
  if ($null -ne $Schema.type) {
    if ($Schema.type -is [string]) {
      $allowedTypes = @($Schema.type)
    } else {
      $allowedTypes = @($Schema.type)
    }

    $actualType = Get-JsonValueType $Value
    if ($allowedTypes -notcontains $actualType -and -not ($actualType -eq "integer" -and $allowedTypes -contains "number")) {
      $Errors.Add("$InstancePath 类型应为 $($allowedTypes -join '|')，实际为 $actualType")
      return
    }
  }

  $valueType = Get-JsonValueType $Value

  if ($valueType -eq "object") {
    $properties = @{}
    if ($null -ne $Schema.properties) {
      foreach ($property in $Schema.properties.PSObject.Properties) {
        $properties[$property.Name] = $property.Value
      }
    }

    if ($null -ne $Schema.required) {
      foreach ($required in @($Schema.required)) {
        if ($null -eq $Value.PSObject.Properties[$required]) {
          $Errors.Add("$InstancePath 缺少必填字段 $required")
        }
      }
    }

    if ($Schema.additionalProperties -eq $false) {
      foreach ($property in $Value.PSObject.Properties) {
        if (-not $properties.ContainsKey($property.Name)) {
          $Errors.Add("$InstancePath 包含未允许字段 $($property.Name)")
        }
      }
    }

    foreach ($propertyName in $properties.Keys) {
      $instanceProperty = $Value.PSObject.Properties[$propertyName]
      if ($null -ne $instanceProperty) {
        Test-SchemaNode $instanceProperty.Value $properties[$propertyName] $RootSchema "$InstancePath/$propertyName" $Errors
      }
    }
  }

  if ($valueType -eq "array") {
    $items = @($Value)
    if ($null -ne $Schema.minItems -and $items.Count -lt [int]$Schema.minItems) {
      $Errors.Add("$InstancePath 项目数量少于 $($Schema.minItems)")
    }
    if ($null -ne $Schema.maxItems -and $items.Count -gt [int]$Schema.maxItems) {
      $Errors.Add("$InstancePath 项目数量多于 $($Schema.maxItems)")
    }
    if ($Schema.uniqueItems -eq $true) {
      $serialized = @($items | ForEach-Object { $_ | ConvertTo-Json -Compress -Depth 30 })
      if (($serialized | Sort-Object -Unique).Count -ne $serialized.Count) {
        $Errors.Add("$InstancePath 包含重复项目")
      }
    }
    if ($null -ne $Schema.items) {
      for ($index = 0; $index -lt $items.Count; $index++) {
        Test-SchemaNode $items[$index] $Schema.items $RootSchema "$InstancePath/$index" $Errors
      }
    }
  }

  if ($valueType -eq "string") {
    if ($null -ne $Schema.minLength -and $Value.Length -lt [int]$Schema.minLength) {
      $Errors.Add("$InstancePath 字符串长度不足")
    }
    if ($null -ne $Schema.pattern -and $Value -notmatch $Schema.pattern) {
      $Errors.Add("$InstancePath 不符合格式 $($Schema.pattern)")
    }
  }

  if ($valueType -eq "integer" -or $valueType -eq "number") {
    if ($null -ne $Schema.minimum -and $Value -lt $Schema.minimum) {
      $Errors.Add("$InstancePath 小于最小值 $($Schema.minimum)")
    }
    if ($null -ne $Schema.maximum -and $Value -gt $Schema.maximum) {
      $Errors.Add("$InstancePath 大于最大值 $($Schema.maximum)")
    }
  }
}

$validations = @(
  @{ Spec = "spec\domain\eligibility-states.yaml"; Schema = "spec\meta\eligibility-states.schema.json" },
  @{ Spec = "spec\domain\eligibility-events.yaml"; Schema = "spec\meta\eligibility-events.schema.json" },
  @{ Spec = "spec\domain\quota-policy.yaml"; Schema = "spec\meta\quota-policy.schema.json" },
  @{ Spec = "spec\domain\goodwill-cancellation-policy.yaml"; Schema = "spec\meta\goodwill-cancellation-policy.schema.json" },
  @{ Spec = "spec\finance\ledger.yaml"; Schema = "spec\meta\ledger.schema.json" },
  @{ Spec = "spec\finance\reconciliation.yaml"; Schema = "spec\meta\reconciliation.schema.json" },
  @{ Spec = "spec\finance\operator-funds.yaml"; Schema = "spec\meta\operator-funds.schema.json" },
  @{ Spec = "spec\admin\authentication-session.yaml"; Schema = "spec\meta\authentication-session.schema.json" },
  @{ Spec = "spec\admin\role-access-matrix.yaml"; Schema = "spec\meta\role-access-matrix.schema.json" },
  @{ Spec = "spec\admin\admin-product-experience.yaml"; Schema = "spec\meta\admin-product-experience.schema.json" },
  @{ Spec = "spec\admin\operator-management.yaml"; Schema = "spec\meta\operator-management.schema.json" },
  @{ Spec = "spec\admin\trip-case-management.yaml"; Schema = "spec\meta\trip-case-management.schema.json" },
  @{ Spec = "spec\admin\finance-operations.yaml"; Schema = "spec\meta\finance-operations.schema.json" },
  @{ Spec = "spec\admin\executive-dashboard.yaml"; Schema = "spec\meta\executive-dashboard.schema.json" },
  @{ Spec = "spec\security\roles.yaml"; Schema = "spec\meta\roles.schema.json" },
  @{ Spec = "spec\security\data-classification.yaml"; Schema = "spec\meta\data-classification.schema.json" },
  @{ Spec = "spec\security\authorization-rules.yaml"; Schema = "spec\meta\authorization-rules.schema.json" },
  @{ Spec = "spec\api\error-codes.yaml"; Schema = "spec\meta\error-codes.schema.json" },
  @{ Spec = "spec\tests\eligibility-scenarios.yaml"; Schema = "spec\meta\acceptance-scenarios.schema.json" },
  @{ Spec = "spec\tests\mobility-scenarios.yaml"; Schema = "spec\meta\mobility-scenarios.schema.json" },
  @{ Spec = "spec\tests\admin-authentication-scenarios.yaml"; Schema = "spec\meta\admin-authentication-scenarios.schema.json" },
  @{ Spec = "spec\tests\admin-role-access-matrix-scenarios.yaml"; Schema = "spec\meta\admin-role-access-matrix-scenarios.schema.json" },
  @{ Spec = "spec\tests\admin-product-experience-scenarios.yaml"; Schema = "spec\meta\admin-product-experience-scenarios.schema.json" },
  @{ Spec = "spec\tests\admin-operator-management-scenarios.yaml"; Schema = "spec\meta\admin-operator-management-scenarios.schema.json" },
  @{ Spec = "spec\tests\admin-trip-case-management-scenarios.yaml"; Schema = "spec\meta\admin-trip-case-management-scenarios.schema.json" },
  @{ Spec = "spec\tests\admin-finance-operations-scenarios.yaml"; Schema = "spec\meta\admin-finance-operations-scenarios.schema.json" },
  @{ Spec = "spec\tests\admin-executive-dashboard-scenarios.yaml"; Schema = "spec\meta\admin-executive-dashboard-scenarios.schema.json" },
  @{ Spec = "spec\api\operation-policies.yaml"; Schema = "spec\meta\operation-policies.schema.json" }
)

$allErrors = New-Object System.Collections.Generic.List[string]

foreach ($validation in $validations) {
  $specPath = Join-Path $repo $validation.Spec
  $schemaPath = Join-Path $repo $validation.Schema

  if (-not (Test-Path -LiteralPath $specPath)) {
    $allErrors.Add("缺少规范文件 $($validation.Spec)")
    continue
  }
  if (-not (Test-Path -LiteralPath $schemaPath)) {
    $allErrors.Add("缺少 Schema 文件 $($validation.Schema)")
    continue
  }

  try {
    $document = ConvertFrom-RestrictedYaml $specPath
    $schema = Get-Content -LiteralPath $schemaPath -Raw | ConvertFrom-Json
    $schemaErrors = New-Object System.Collections.Generic.List[string]
    Test-SchemaNode $document $schema $schema '$' $schemaErrors

    if ($schemaErrors.Count -gt 0) {
      foreach ($schemaError in $schemaErrors) {
        $allErrors.Add("$($validation.Spec): $schemaError")
      }
    } else {
      Write-Host "结构验证通过: $($validation.Spec)"
    }
  } catch {
    $allErrors.Add("$($validation.Spec): $($_.Exception.Message)")
  }
}

if ($allErrors.Count -gt 0) {
  throw "规范结构验证失败:`n- $($allErrors -join "`n- ")"
}

Write-Host "$($validations.Count) 份 YAML 规范的 JSON Schema 结构验证通过。"

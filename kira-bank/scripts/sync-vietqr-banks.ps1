[CmdletBinding()]
param(
    [string]$ApiUrl = 'https://api.vietqr.io/v2/banks',
    [string]$MomoApiUrl = 'https://payment.momo.vn/v2/gateway/api/bankcodes',
    [string]$ContainerName = 'kira-mysql',
    [string]$Database = 'kira_bank',
    [string]$DbUser = 'root',
    [string]$OutputSql,
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'

function ConvertTo-SqlString {
    param([AllowNull()][object]$Value)

    if ($null -eq $Value) {
        return 'NULL'
    }

    $normalized = ([string]$Value -replace '\s+', ' ').Trim()
    if ([string]::IsNullOrWhiteSpace($normalized)) {
        return 'NULL'
    }

    return "'" + $normalized.Replace("'", "''") + "'"
}

function Invoke-Utf8Json {
    param([Parameter(Mandatory)][string]$Uri)

    Add-Type -AssemblyName System.Net.Http
    $client = [Net.Http.HttpClient]::new()
    $client.Timeout = [TimeSpan]::FromSeconds(30)
    try {
        $bytes = $client.GetByteArrayAsync($Uri).GetAwaiter().GetResult()
        $json = [Text.UTF8Encoding]::new($false).GetString($bytes)
        return $json | ConvertFrom-Json
    }
    finally {
        $client.Dispose()
    }
}

function Get-DatabasePassword {
    if (-not [string]::IsNullOrWhiteSpace($env:DB_PASSWORD)) {
        return $env:DB_PASSWORD
    }

    $securePassword = Read-Host 'Database password' -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function New-UpsertSql {
    param(
        [Parameter(Mandatory)][object[]]$Banks,
        [Parameter(Mandatory)][object[]]$MomoBanks
    )

    $rows = foreach ($bank in ($Banks | Sort-Object { [long]$_.id })) {
        $shortName = if (-not [string]::IsNullOrWhiteSpace([string]$bank.shortName)) {
            $bank.shortName
        }
        else {
            $bank.short_name
        }

        $transferSupported = if ([int]$bank.transferSupported -eq 1) { 1 } else { 0 }
        $lookupSupported = if ([int]$bank.lookupSupported -eq 1) { 1 } else { 0 }

        '  ({0}, {1}, {2}, {3}, {4}, {5}, {6}, {7}, {8}, TRUE)' -f @(
            [long]$bank.id,
            (ConvertTo-SqlString $bank.code),
            (ConvertTo-SqlString $bank.name),
            (ConvertTo-SqlString $shortName),
            (ConvertTo-SqlString $bank.logo),
            (ConvertTo-SqlString $bank.bin),
            (ConvertTo-SqlString $bank.swift_code),
            $transferSupported,
            $lookupSupported
        )
    }

    $values = $rows -join ",`n"
    $momoRows = foreach ($bank in ($MomoBanks | Sort-Object code)) {
        '  SELECT {0} AS code, {1} AS name, {2} AS short_name, {3} AS logo_url, {4} AS bin, {5} AS transfer_supported' -f @(
            (ConvertTo-SqlString $bank.code),
            (ConvertTo-SqlString $bank.name),
            (ConvertTo-SqlString $bank.shortName),
            (ConvertTo-SqlString $bank.bankLogoUrl),
            (ConvertTo-SqlString $bank.bin),
            $(if ($bank.isDisburse) { 1 } else { 0 })
        )
    }
    $momoValues = $momoRows -join "`n  UNION ALL`n"

    return @"
SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO banks (
  vietqr_id,
  code,
  name,
  short_name,
  logo_url,
  bin,
  swift_code,
  transfer_supported,
  lookup_supported,
  active
)
VALUES
$values
ON DUPLICATE KEY UPDATE
  version = IF(
    NOT (
      vietqr_id <=> VALUES(vietqr_id)
      AND name <=> VALUES(name)
      AND short_name <=> VALUES(short_name)
      AND logo_url <=> VALUES(logo_url)
      AND bin <=> VALUES(bin)
      AND swift_code <=> VALUES(swift_code)
      AND transfer_supported <=> VALUES(transfer_supported)
      AND lookup_supported <=> VALUES(lookup_supported)
      AND active <=> VALUES(active)
    ),
    version + 1,
    version
  ),
  vietqr_id = VALUES(vietqr_id),
  name = VALUES(name),
  short_name = VALUES(short_name),
  logo_url = VALUES(logo_url),
  bin = VALUES(bin),
  swift_code = VALUES(swift_code),
  transfer_supported = VALUES(transfer_supported),
  lookup_supported = VALUES(lookup_supported),
  active = VALUES(active);

INSERT INTO banks (
  code,
  name,
  short_name,
  logo_url,
  bin,
  transfer_supported,
  lookup_supported,
  active
)
SELECT
  COALESCE(existing.code, source.code),
  COALESCE(existing.name, source.name),
  COALESCE(existing.short_name, source.short_name),
  source.logo_url,
  COALESCE(existing.bin, source.bin),
  COALESCE(existing.transfer_supported, source.transfer_supported),
  COALESCE(existing.lookup_supported, FALSE),
  COALESCE(existing.active, TRUE)
FROM (
$momoValues
) source
LEFT JOIN banks existing ON existing.bin = source.bin
ON DUPLICATE KEY UPDATE
  version = IF(NOT (banks.logo_url <=> VALUES(logo_url)), banks.version + 1, banks.version),
  logo_url = VALUES(logo_url);

COMMIT;
"@
}

Write-Host "Fetching VietQR banks from $ApiUrl ..."
$response = Invoke-RestMethod -Uri $ApiUrl -Method Get -TimeoutSec 30
if ([string]$response.code -ne '00') {
    throw "VietQR returned code '$($response.code)': $($response.desc)"
}

$banks = @($response.data)
if ($banks.Count -eq 0) {
    throw 'VietQR returned an empty bank list.'
}

foreach ($bank in $banks) {
    $shortName = if (-not [string]::IsNullOrWhiteSpace([string]$bank.shortName)) {
        $bank.shortName
    }
    else {
        $bank.short_name
    }

    $missingRequiredValue = [long]$bank.id -le 0 -or
        [string]::IsNullOrWhiteSpace([string]$bank.code) -or
        [string]::IsNullOrWhiteSpace([string]$bank.name) -or
        [string]::IsNullOrWhiteSpace([string]$shortName) -or
        [string]::IsNullOrWhiteSpace([string]$bank.bin)
    if ($missingRequiredValue) {
        throw "VietQR bank id '$($bank.id)' is missing a required id, code, name, short name, or BIN."
    }
}

$duplicateCodes = @($banks | Group-Object code | Where-Object Count -gt 1)
$duplicateIds = @($banks | Group-Object id | Where-Object Count -gt 1)
if ($duplicateCodes.Count -gt 0 -or $duplicateIds.Count -gt 0) {
    throw 'VietQR returned duplicate bank codes or ids.'
}

Write-Host "Fetching MoMo banks from $MomoApiUrl ..."
$momoResponse = Invoke-Utf8Json -Uri $MomoApiUrl
$momoBanks = @(
    foreach ($property in $momoResponse.PSObject.Properties) {
        [pscustomobject]@{
            code = $property.Name
            bin = [string]$property.Value.bin
            shortName = [string]$property.Value.shortName
            name = [string]$property.Value.name
            bankLogoUrl = [string]$property.Value.bankLogoUrl
            isDisburse = [bool]$property.Value.isDisburse
        }
    }
)

if ($momoBanks.Count -eq 0) {
    throw 'MoMo returned an empty bank list.'
}

foreach ($bank in $momoBanks) {
    $missingRequiredValue = [string]::IsNullOrWhiteSpace([string]$bank.code) -or
        [string]::IsNullOrWhiteSpace([string]$bank.name) -or
        [string]::IsNullOrWhiteSpace([string]$bank.shortName) -or
        [string]::IsNullOrWhiteSpace([string]$bank.bankLogoUrl) -or
        [string]::IsNullOrWhiteSpace([string]$bank.bin)
    if ($missingRequiredValue) {
        throw "MoMo bank '$($bank.code)' is missing a required code, name, short name, logo URL, or BIN."
    }
}

$duplicateMomoCodes = @($momoBanks | Group-Object code | Where-Object Count -gt 1)
$duplicateMomoBins = @($momoBanks | Group-Object bin | Where-Object Count -gt 1)
if ($duplicateMomoCodes.Count -gt 0 -or $duplicateMomoBins.Count -gt 0) {
    throw 'MoMo returned duplicate bank codes or BINs.'
}

$sql = New-UpsertSql -Banks $banks -MomoBanks $momoBanks
if (-not [string]::IsNullOrWhiteSpace($OutputSql)) {
    $outputPath = [IO.Path]::GetFullPath($OutputSql)
    $outputDirectory = Split-Path -Parent $outputPath
    if (-not [string]::IsNullOrWhiteSpace($outputDirectory)) {
        New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
    }
    [IO.File]::WriteAllText($outputPath, $sql, [Text.UTF8Encoding]::new($false))
    Write-Host "Generated $($banks.Count) VietQR and $($momoBanks.Count) MoMo bank rows in $outputPath"
}

if (-not $Apply) {
    if ([string]::IsNullOrWhiteSpace($OutputSql)) {
        $sql
    }
    Write-Host 'Dry run complete. Use -Apply to write to MySQL.'
    return
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker CLI was not found.'
}

$runningContainer = & docker ps --filter "name=^/$ContainerName$" --format '{{.Names}}'
if ($LASTEXITCODE -ne 0 -or $runningContainer -ne $ContainerName) {
    throw "MySQL container '$ContainerName' is not running."
}

$password = Get-DatabasePassword
$migrationQuery = "SELECT COUNT(*) FROM flyway_schema_history WHERE version = '3' AND success = 1;"
$migrationCount = & docker exec -e "MYSQL_PWD=$password" $ContainerName mysql `
    --default-character-set=utf8mb4 `
    --skip-column-names `
    --silent `
    "--user=$DbUser" `
    "--database=$Database" `
    "--execute=$migrationQuery"
if ($LASTEXITCODE -ne 0 -or [int]$migrationCount -ne 1) {
    throw 'Flyway migration V3 is not applied. Restart the backend before running the manual sync.'
}

$previousOutputEncoding = $OutputEncoding
try {
    $OutputEncoding = [Text.UTF8Encoding]::new($false)
    $sql | & docker exec -i -e "MYSQL_PWD=$password" $ContainerName mysql `
        --default-character-set=utf8mb4 "--user=$DbUser" "--database=$Database"
    if ($LASTEXITCODE -ne 0) {
        throw "MySQL sync failed with exit code $LASTEXITCODE."
    }
}
finally {
    $OutputEncoding = $previousOutputEncoding
    $password = $null
}

Write-Host "Synchronized $($banks.Count) VietQR and $($momoBanks.Count) MoMo bank rows into $Database."

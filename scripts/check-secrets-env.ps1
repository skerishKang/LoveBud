# Check fixture env vars
param()

$envFile = ".secrets/lovebud-runtime.env"
if (-not (Test-Path $envFile)) {
    Write-Host "File exists: NO"
    exit 1
}

Write-Host "File exists: YES"

$lines = Get-Content $envFile
$hasDbUrl = $false
$hasOwnerId = $false
$hasExecute = $false
$lineCount = 0

foreach ($line in $lines) {
    $lineCount++
    if ($line -match "^LOVEBUD_FIXTURE_DB_URL=") { $hasDbUrl = $true }
    if ($line -match "^LOVEBUD_FIXTURE_OWNER_ID=") { $hasOwnerId = $true }
    if ($line -match "^LOVEBUD_FIXTURE_EXECUTE=true") { $hasExecute = $true }
}

Write-Host ("Lines: " + $lineCount)
Write-Host ("LOVEBUD_FIXTURE_DB_URL: " + $(if ($hasDbUrl) { "PRESENT" } else { "MISSING" }))
Write-Host ("LOVEBUD_FIXTURE_OWNER_ID: " + $(if ($hasOwnerId) { "PRESENT" } else { "MISSING" }))
Write-Host ("LOVEBUD_FIXTURE_EXECUTE=true: " + $(if ($hasExecute) { "SET" } else { "NOT SET" }))

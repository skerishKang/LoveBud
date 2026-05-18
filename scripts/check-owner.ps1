# Check if owner_id format is needed
$envFile = ".secrets/lovebud-runtime.env"
$lines = Get-Content $envFile

$pattern = "FIXTURE_OWNER_ID|OWNER_ID|FIREBASE_UID|UID|owner_id"
$hasOwnerId = $false

foreach ($line in $lines) {
    if ($line -match "(LOVEBUD_FIXTURE_OWNER_ID|FIXTURE_OWNER_ID|FIREBASE_UID|UUID_OWNER|ADMIN_UID|QA_OWNER_ID)=") {
        Write-Host ("Found: " + ($line -replace "=.*", "=PRESENT"))
        $hasOwnerId = $true
    }
}

if (-not $hasOwnerId) {
    Write-Host "OWNER_ID: MISSING in secrets file"
    Write-Host "Need to provide LOVEBUD_FIXTURE_OWNER_ID (Firebase UID of owner)"
}

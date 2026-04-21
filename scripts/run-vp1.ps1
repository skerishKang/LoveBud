if (-not $env:NETLIFY_DATABASE_URL -and -not $env:DATABASE_URL) {
    Write-Error "NETLIFY_DATABASE_URL 또는 DATABASE_URL 환경변수가 필요합니다."
    Write-Host '예: $env:NETLIFY_DATABASE_URL="postgresql://..."; node scripts\verify-phase1.js'
    exit 1
}

if (-not $env:NETLIFY_DATABASE_URL -and $env:DATABASE_URL) {
    $env:NETLIFY_DATABASE_URL = $env:DATABASE_URL
}

if (-not $env:DATABASE_URL -and $env:NETLIFY_DATABASE_URL) {
    $env:DATABASE_URL = $env:NETLIFY_DATABASE_URL
}

cd "G:\다른 컴퓨터\내 컴퓨터\LoveBud"
node scripts\verify-phase1.js
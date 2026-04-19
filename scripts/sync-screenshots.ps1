# LoveBud 테스트 스크린샷 정리 스크립트
# 사용법: .\scripts\sync-screenshots.ps1 -TestId "bts-newuser-test-2026-04-19-0825"

param (
    [Parameter(Mandatory=$true)]
    [string]$TestId,
    
    [string]$BrainDir = "C:\Users\limone\.gemini\antigravity\brain\1f240922-f74a-4d32-b5d2-18196caaaad5",
    
    [int]$Count = 20
)

$TempDir = Join-Path $BrainDir ".tempmediaStorage"
$DestDir = "g:\Ddrive\BatangD\task\workdiary\LoveBud\docs\test-scenarios\results\$TestId\screenshots"

if (-not (Test-Path $DestDir)) {
    New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
    Write-Host "디렉토리 생성됨: $DestDir" -ForegroundColor Cyan
}

Write-Host "임시 저장소에서 최신 $Count 개의 스크린샷을 가져오는 중..." -ForegroundColor Yellow

$Files = Get-ChildItem -Path $TempDir -Filter *.png | Sort-Object LastWriteTime -Descending | Select-Object -First $Count

$i = 1
foreach ($File in ($Files | Sort-Object LastWriteTime)) {
    $NewName = "step-$($i.ToString('00')).png"
    $TargetPath = Join-Path $DestDir $NewName
    
    Copy-Item $File.FullName -Destination $TargetPath -Force
    Write-Host "복사됨: $($File.Name) -> $NewName"
    $i++
}

Write-Host "`n정리 완료! $TestId 폴더에서 확인하세요." -ForegroundColor Green

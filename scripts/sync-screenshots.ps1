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

Write-Host "Brain 루트 및 임시 저장소에서 최신 $Count 개의 스크린샷을 가져오는 중..." -ForegroundColor Yellow

# 루트와 .tempmediaStorage 모두에서 검색
$Files = Get-ChildItem -Path $BrainDir, $TempDir -Filter *.png -ErrorAction SilentlyContinue | 
         Where-Object { $_.Name -like "step*" } |
         Sort-Object LastWriteTime -Descending | 
         Select-Object -First $Count

if ($null -eq $Files -or $Files.Count -eq 0) {
    Write-Error "오류: 복사할 스크린샷을 찾지 못했습니다! 필터(step*)와 디렉토리($BrainDir)를 확인하세요."
    exit 1
}

Write-Host "발견된 파일: $($Files.Count)개" -ForegroundColor Cyan

$i = 1
foreach ($File in ($Files | Sort-Object LastWriteTime)) {
    $NewName = "step-$($i.ToString('00')).png"
    $TargetPath = Join-Path $DestDir $NewName
    
    try {
        Copy-Item $File.FullName -Destination $TargetPath -Force -ErrorAction Stop
        Write-Host "   [OK] $($File.Name) -> $NewName"
    } catch {
        Write-Error "   [Fail] $($File.Name) 복사 실패: $_"
    }
    $i++
}

Write-Host "`n정리 완료! $TestId 폴더($DestDir)에서 $(($i-1))장의 이미지를 확인하세요." -ForegroundColor Green

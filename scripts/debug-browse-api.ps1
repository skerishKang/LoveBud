# LoveBud 둘러보기 API 디버깅 스크립트 (PowerShell)
# 사용법: .\debug-browse-api.ps1 [-Domain "https://lovebud.netlify.app"]

param(
    [string]$Domain = "https://lovebud.netlify.app"
)

function Get-FallbackValue {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [object[]]$Values
    )

    foreach ($value in $Values) {
        if ($null -ne $value -and "$value" -ne "") {
            return $value
        }
    }
    return $null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputDir = "debug-logs"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

Write-Host "=== LoveBud Browse API 디버깅 ===" -ForegroundColor Cyan
Write-Host "도메인: $Domain"
Write-Host "시간: $timestamp"
Write-Host ""

# 1. 공개 트리 확인
Write-Host "[1/4] 공개 트리 API 호출..." -ForegroundColor Yellow
$treesUrl = "$Domain/api/community/trees"
$treesFile = "$outputDir\trees_$timestamp.json"
$trees = $null

try {
    $treesRaw = Invoke-RestMethod -Uri $treesUrl -Method GET
    $treesRaw | ConvertTo-Json -Depth 10 | Tee-Object -FilePath $treesFile | Write-Host
    $trees = Get-Content $treesFile | ConvertFrom-Json
    $treeCount = @($trees).Count
    Write-Host "→ 트리 수: $treeCount" -ForegroundColor Green
} catch {
    Write-Host "→ 오류: $_" -ForegroundColor Red
}
Write-Host ""

# 2. 공개 메모리 확인
Write-Host "[2/4] 공개 메모리 API 호출..." -ForegroundColor Yellow
$memoriesUrl = "$Domain/api/community/memories"
$memoriesFile = "$outputDir\memories_$timestamp.json"
$memories = $null

try {
    $memoriesRaw = Invoke-RestMethod -Uri $memoriesUrl -Method GET
    $memoriesRaw | ConvertTo-Json -Depth 10 | Tee-Object -FilePath $memoriesFile | Write-Host
    $memories = Get-Content $memoriesFile | ConvertFrom-Json
    $memoryCount = @($memories).Count
    Write-Host "→ 메모리 수: $memoryCount" -ForegroundColor Green
} catch {
    Write-Host "→ 오류: $_" -ForegroundColor Red
}
Write-Host ""

# 3. 트리 요약
Write-Host "[3/4] 트리 요약..." -ForegroundColor Yellow
if ($trees) {
    @($trees) | ForEach-Object {
        $id = Get-FallbackValue $_.id $_.data.id
        $title = Get-FallbackValue $_.title $_.data.title
        $visibility = Get-FallbackValue $_.visibility $_.data.visibility
        Write-Host "  - $id : $title (visibility: $visibility)"
    }
}
Write-Host ""

# 4. 메모리 요약 및 매칭 분석
Write-Host "[4/4] 메모리 요약 및 매칭 분석..." -ForegroundColor Yellow
if ($memories) {
    @($memories) |
        Group-Object -Property {
            Get-FallbackValue $_.treeId $_.tree_id $_.data.treeId $_.data.tree_id
        } |
        ForEach-Object {
            $treeId = $_.Name
            $count = $_.Count
            $tree = @($trees) | Where-Object {
                (Get-FallbackValue $_.id $_.data.id) -eq $treeId
            } | Select-Object -First 1
            $treeTitle = if ($tree) {
                Get-FallbackValue $tree.title $tree.data.title
            } else {
                "Unknown"
            }
            Write-Host "  - $treeId ($treeTitle): $count개 메모리"
        }
}
Write-Host ""

# 5. 고립 메모리 확인 (treeId가 trees에 없는 메모리)
if ($trees -and $memories) {
    Write-Host "=== 고립 메모리 확인 ===" -ForegroundColor Cyan

    $treeIds = @($trees) | ForEach-Object {
        Get-FallbackValue $_.id $_.data.id
    }

    $orphanMemories = @($memories) | Where-Object {
        $mtid = Get-FallbackValue $_.treeId $_.tree_id $_.data.treeId $_.data.tree_id
        $treeIds -notcontains $mtid
    }

    if ($orphanMemories.Count -gt 0) {
        Write-Host "주의: $($orphanMemories.Count)개 메모리가 존재하지 않는 treeId를 참조" -ForegroundColor Red
        $orphanMemories | ForEach-Object {
            $mid = Get-FallbackValue $_.id $_.data.id
            $mtid = Get-FallbackValue $_.treeId $_.tree_id $_.data.treeId $_.data.tree_id
            Write-Host "  - 메모리 $mid → treeId $mtid (없음)" -ForegroundColor Red
        }
    } else {
        Write-Host "모든 메모리가 유효한 treeId를 참조함" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=== 로그 저장 위치 ===" -ForegroundColor Cyan
Write-Host "트리: $treesFile"
Write-Host "메모리: $memoriesFile"
Write-Host ""
Write-Host "디버깅 완료." -ForegroundColor Green

# LoveBud Screenshot Sync Script
# Usage: .\scripts\sync-screenshots.ps1 -TestId "bts-newuser-test-2026-04-19-0824"

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
    Write-Host "Directory created: $DestDir" -ForegroundColor Cyan
}

Write-Host "Scanning Brain root and .tempmediaStorage for screenshots..." -ForegroundColor Yellow

# Patterns to find: 01_home, 02_login, 03_tree, 04_node, 05_final, step*
$Patterns = @("01_home*", "02_login*", "03_tree*", "04_node*", "05_final*", "step*")
$Files = @()

foreach ($Pattern in $Patterns) {
    $Matched = Get-ChildItem -Path $BrainDir, $TempDir -Filter $Pattern -ErrorAction SilentlyContinue
    if ($Matched) {
        $Files += $Matched
    }
}

# Remove duplicates (if any files are found in both dirs)
$Files = $Files | Sort-Object FullName -Unique | Sort-Object LastWriteTime -Descending | Select-Object -First $Count

if ($null -eq $Files -or $Files.Count -eq 0) {
    Write-Error "Error: No screenshots found! Check patterns or directory: $BrainDir"
    exit 1
}

Write-Host "Found $($Files.Count) files. Syncing..." -ForegroundColor Cyan

foreach ($File in ($Files | Sort-Object LastWriteTime)) {
    # Map pattern back to standard name
    $NewName = $File.Name
    if ($File.Name -like "01_home*") { $NewName = "01-home.png" }
    elseif ($File.Name -like "02_login*") { $NewName = "02-login.png" }
    elseif ($File.Name -like "03_tree*") { $NewName = "03-tree.png" }
    elseif ($File.Name -like "04_node*") {
        # Check if it is node 1, 2, 3, 4
        if ($File.Name -match "node1") { $NewName = "04-node1.png" }
        elseif ($File.Name -match "node2") { $NewName = "04-node2.png" }
        elseif ($File.Name -match "node3") { $NewName = "04-node3.png" }
        elseif ($File.Name -match "node4") { $NewName = "04-node4.png" }
        else { $NewName = $File.Name.Replace("_", "-").Split("_")[0] + ".png" }
    }
    elseif ($File.Name -like "05_final*") { $NewName = "05-final.png" }
    elseif ($File.Name -like "step*") { $NewName = $File.Name.Replace("_", "-").Split("_")[0] + ".png" }
    
    $TargetPath = Join-Path $DestDir $NewName
    
    try {
        Copy-Item $File.FullName -Destination $TargetPath -Force -ErrorAction Stop
        Write-Host "   [OK] $($File.Name) -> $NewName"
    } catch {
        Write-Error "   [Fail] Failed to copy $($File.Name): $_"
    }
}

Write-Host "`nSync Complete! Check images in results/$TestId/screenshots" -ForegroundColor Green

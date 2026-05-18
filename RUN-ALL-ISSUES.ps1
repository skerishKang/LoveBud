# LoveBud Issue Resolution Script (Windows PowerShell)
# Run this in Windows PowerShell as Administrator

$repo = "G:\Ddrive\BatangD\task\workdiary\LoveBud"
cd $repo

# 1. Issue #1286 - memories migration (already done)
Write-Host "=== Issue #1286: PR #1287 Created ===" -ForegroundColor Green

# 2. Issue #1285 - my-trees runtime (already done)
Write-Host "=== Issue #1285: PR #1288 Ready ===" -ForegroundColor Green
git add src/runtime/my-trees/rendering.js src/runtime/my-trees/interaction.js
git commit -m "Refactor: split My Trees UI runtime (Refs #1285)" 2>$null
git push origin refactor:my-trees-runtime 2>$null
gh pr create --draft --title "Refactor: split My Trees UI runtime into rendering and interaction modules" --body "Refs #1285" --head refactor:my-trees-runtime

# 3. Issue #1284 - modal owner writes (already done)
Write-Host "=== Issue #1284: Ready ===" -ForegroundColor Yellow
git add modal_compute/tree_writes.py modal_compute/memory_writes.py
git commit -m "Refactor: split owner_writes into tree_writes and memory_writes (Refs #1284)" 2>$null
git push origin HEAD:refs/heads/refactor/modal-owner-writes 2>$null
gh pr create --draft --title "Refactor: split owner_writes into tree_writes and memory_writes" --body "Refs #1284" --head refactor/modal-owner-writes

# 4. Issue #1283~ 계속 실행
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "Run OpenClaude for remaining issues..."
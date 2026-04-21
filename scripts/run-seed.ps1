# Requires NETLIFY_DATABASE_URL or DATABASE_URL to be set in the shell.
$env:SEED_STAGE = "phase1"
Set-Location "G:\다른 컴퓨터\내 컴퓨터\LoveBud"
node scripts/seed-public-trees.js
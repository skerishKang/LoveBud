REM Requires NETLIFY_DATABASE_URL or DATABASE_URL to be set before running.
@echo off
if not defined NETLIFY_DATABASE_URL if defined DATABASE_URL set NETLIFY_DATABASE_URL=%DATABASE_URL%
cd /d G:\다른 컴퓨터\내 컴퓨터\LoveBud
set SEED_STAGE=phase2
node scripts\seed-public-trees.js
@echo off
cd /d G:\다른 컴퓨터\내 컴퓨터\LoveBud
set SEED_STAGE=phase2
set NETLIFY_DATABASE_URL=postgresql://neondb_owner:REDACTED@ep-little-poetry-a1vjyiim-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
node scripts\seed-public-trees.js
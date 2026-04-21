@echo off
cd /d G:\다른 컴퓨터\내 컴퓨터\LoveBud

if "%NETLIFY_DATABASE_URL%"=="" if "%DATABASE_URL%"=="" (
  echo [ERROR] NETLIFY_DATABASE_URL 또는 DATABASE_URL 환경변수가 필요합니다.
  echo [HINT] set NETLIFY_DATABASE_URL=postgresql://...
  exit /b 1
)

if "%NETLIFY_DATABASE_URL%"=="" set NETLIFY_DATABASE_URL=%DATABASE_URL%

node -e "const {Pool} = require('pg'); const pool = new Pool({connectionString: process.env.NETLIFY_DATABASE_URL, ssl: {rejectUnauthorized: false}}); (async () => { const c = await pool.connect(); const r = await c.query('SELECT id, name, node_count FROM trees WHERE is_public = true ORDER BY created_at ASC'); console.log('=== All Public Trees ==='); r.rows.forEach((row, i) => { console.log(i+1 + '. ' + row.id + ' | ' + row.name + ' | ' + row.node_count + ' nodes'); }); await c.release(); await pool.end(); })();"
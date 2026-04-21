REM Requires NETLIFY_DATABASE_URL or DATABASE_URL to be set before running.
@echo off
cd /d G:\다른 컴퓨터\내 컴퓨터\LoveBud

if "%NETLIFY_DATABASE_URL%"=="" if "%DATABASE_URL%"=="" (
  echo [ERROR] NETLIFY_DATABASE_URL 또는 DATABASE_URL 환경변수가 필요합니다.
  echo [HINT] set NETLIFY_DATABASE_URL=postgresql://...
  exit /b 1
)

if "%NETLIFY_DATABASE_URL%"=="" set NETLIFY_DATABASE_URL=%DATABASE_URL%

node scripts\verify-db.js

@echo off
setlocal
cd /d "%~dp0.."

set msg=%~1
if "%msg%"=="" set msg=local snapshot

echo [Fossil] Adding/Removing files from checkout...
fossil addremove

echo [Fossil] Committing changes...
fossil commit -m "%msg%"

echo.
echo [Fossil] Done.

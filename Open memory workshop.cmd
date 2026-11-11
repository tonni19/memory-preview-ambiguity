@echo off
setlocal
cd /d "%~dp0"
"%~dp0runtime\node.exe" "%~dp0launch.mjs" workshop
if errorlevel 1 pause

@echo off
setlocal
cd /d "%~dp0"
"%~dp0runtime\node.exe" "%~dp0launch.mjs" survey
if errorlevel 1 pause

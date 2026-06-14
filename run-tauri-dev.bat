@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules call npm install || goto :err
call npm run check || goto :err
call npm run tauri:dev || goto :err
exit /b 0
:err
echo Dev run failed.
pause
exit /b 1

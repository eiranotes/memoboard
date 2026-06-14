@echo off
setlocal
cd /d "%~dp0"

node -v || goto :err
call npm -v || goto :err
rustc --version || goto :err
cargo --version || goto :err
call npm run check || goto :err
if exist "src-tauri\Cargo.lock" (
  findstr /C:"name = \"brotli\"" "src-tauri\Cargo.lock" >nul
  if not errorlevel 1 (
    echo Removing stale Cargo.lock containing brotli.
    del /F /Q "src-tauri\Cargo.lock"
  )
)
call npm run tauri:build || goto :err
if not exist dist mkdir dist
if exist "src-tauri\target\release\memoboard.exe" copy /Y "src-tauri\target\release\memoboard.exe" "dist\Memoboard-Tauri-1.0.0.exe" >nul
if exist "dist\Memoboard-Tauri-1.0.0.exe" echo Output: dist\Memoboard-Tauri-1.0.0.exe
pause
exit /b 0
:err
echo Build failed.
pause
exit /b 1

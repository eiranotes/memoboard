@echo off
setlocal
cd /d "%~dp0"

echo [1/7] Checking Node.js and npm...
node -v || goto :node_error
call npm -v || goto :node_error

echo.
echo [2/7] Checking Rust toolchain...
rustc --version || goto :rust_error
cargo --version || goto :rust_error

echo.
echo [3/7] Installing npm dependencies if needed...
if not exist node_modules (
  call npm install || goto :npm_error
) else (
  echo node_modules already exists. Skipping npm install.
)

echo.
echo [4/7] Running renderer/static audit...
call npm run check || goto :check_error

echo.
echo [5/6] Checking stale Rust lockfile...
if exist "src-tauri\Cargo.lock" (
  findstr /C:"name = \"brotli\"" "src-tauri\Cargo.lock" >nul
  if not errorlevel 1 (
    echo Removing stale Cargo.lock containing brotli.
    del /F /Q "src-tauri\Cargo.lock"
  )
)

echo.
echo [6/7] Building Tauri release executable...
call npm run tauri:build || goto :build_error

echo.
echo [7/7] Copying release executable...
if not exist dist mkdir dist
if exist "src-tauri\target\release\memoboard.exe" (
  copy /Y "src-tauri\target\release\memoboard.exe" "dist\Memoboard-Tauri-1.0.0.exe" >nul
  echo Output: dist\Memoboard-Tauri-1.0.0.exe
) else (
  echo Could not find src-tauri\target\release\memoboard.exe
  echo Check src-tauri\target\release manually.
  goto :build_error
)

echo.
echo Done.
pause
exit /b 0

:node_error
echo Node.js/npm check failed.
pause
exit /b 1

:rust_error
echo Rust toolchain not found.
echo Install Rust from https://rustup.rs/ and install Microsoft C++ Build Tools.
pause
exit /b 1

:npm_error
echo npm install failed.
pause
exit /b 1

:check_error
echo Static check failed.
pause
exit /b 1

:build_error
echo Tauri build failed.
pause
exit /b 1

$process = Get-Process -Name Memoboard-1.0.1 -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($process) {
    $hwnd = $process.MainWindowHandle
    python D:\AI\repository\Memoboard\scratch\click_relative.py $hwnd
} else {
    Write-Output "Memoboard-1.0.1 process with MainWindowHandle not found."
}

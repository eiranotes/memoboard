Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$signature = @"
[DllImport("user32.dll")]
public static extern bool SetForegroundWindow(IntPtr hWnd);
[DllImport("user32.dll")]
public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);
[DllImport("user32.dll")]
public static extern bool SetCursorPos(int X, int Y);
[DllImport("user32.dll")]
public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
[DllImport("user32.dll")]
public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
"@
$User32 = Add-Type -MemberDefinition $signature -Name "User32MouseTab" -PassThru

$MOUSEEVENTF_LEFTDOWN = 0x0002
$MOUSEEVENTF_LEFTUP = 0x0004
$HWND_TOPMOST = [IntPtr](-1)
$HWND_NOTOPMOST = [IntPtr](-2)
$SWP_SHOWWINDOW = 0x0040

$process = Get-Process -Name Memoboard-1.0.1 -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($process) {
    $hwnd = $process.MainWindowHandle
    $User32::ShowWindow($hwnd, 1) | Out-Null
    # Ensure window is exactly at 100, 100 and size 1280, 820
    $User32::SetWindowPos($hwnd, $HWND_TOPMOST, 100, 100, 1280, 820, $SWP_SHOWWINDOW) | Out-Null
    $User32::SetForegroundWindow($hwnd) | Out-Null
    Start-Sleep -Milliseconds 800
    
    # We want to click "사용법" tab.
    # If Left is 100 and Top is 100:
    # Let's try X = 410, Y = 125.
    $User32::SetCursorPos(410, 125)
    Start-Sleep -Milliseconds 200
    $User32::mouse_event($MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 50
    $User32::mouse_event($MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 1000
    
    # Let's release topmost
    $User32::SetWindowPos($hwnd, $HWND_NOTOPMOST, 100, 100, 1280, 820, 0) | Out-Null
    Start-Sleep -Milliseconds 500
} else {
    Write-Output "Process not found."
}

# Capture screen
$Screen = [System.Windows.Forms.SystemInformation]::VirtualScreen
$Width = $Screen.Width
$Height = $Screen.Height
$Left = $Screen.Left
$Top = $Screen.Top

$Bitmap = New-Object System.Drawing.Bitmap $Width, $Height
$Graphic = [System.Drawing.Graphics]::FromImage($Bitmap)
$Graphic.CopyFromScreen($Left, $Top, 0, 0, $Bitmap.Size)

$OutPath = "D:\AI\repository\Memoboard\scratch\screenshot.png"
$Bitmap.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)

$Graphic.Dispose()
$Bitmap.Dispose()
Write-Output "Screenshot saved to $OutPath"

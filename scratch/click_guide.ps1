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
$User32 = Add-Type -MemberDefinition $signature -Name "User32Mouse" -PassThru

# mouse_event flags
$MOUSEEVENTF_LEFTDOWN = 0x0002
$MOUSEEVENTF_LEFTUP = 0x0004
$HWND_TOPMOST = [IntPtr](-1)
$HWND_NOTOPMOST = [IntPtr](-2)
$SWP_SHOWWINDOW = 0x0040

$process = Get-Process -Name Memoboard-1.0.1 -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($process) {
    $hwnd = $process.MainWindowHandle
    $User32::ShowWindow($hwnd, 1) | Out-Null
    $User32::SetWindowPos($hwnd, $HWND_TOPMOST, 100, 100, 1280, 820, $SWP_SHOWWINDOW) | Out-Null
    $User32::SetForegroundWindow($hwnd) | Out-Null
    Start-Sleep -Milliseconds 800
    
    # Click inside window (X=300, Y=300) to ensure web view focus
    $User32::SetCursorPos(300, 300)
    Start-Sleep -Milliseconds 100
    $User32::mouse_event($MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 50
    $User32::mouse_event($MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 500
    
    # Send Shift+Tab 20 times to reset focus to the first navigation item (☰ menuBtn)
    for ($i=0; $i -lt 20; $i++) {
        [System.Windows.Forms.SendKeys]::SendWait("+{TAB}")
        Start-Sleep -Milliseconds 50
    }
    Start-Sleep -Milliseconds 500
    
    # Tab and Space 5 times sequentially to select Menu -> Memo -> Calendar -> Settings -> Guide
    for ($j=0; $j -lt 5; $j++) {
        [System.Windows.Forms.SendKeys]::SendWait("{TAB}")
        Start-Sleep -Milliseconds 200
        [System.Windows.Forms.SendKeys]::SendWait(" ")
        Start-Sleep -Milliseconds 500
        Write-Output "Tab & Space step $($j+1) executed"
    }
    
    # Release topmost
    $User32::SetWindowPos($hwnd, $HWND_NOTOPMOST, 100, 100, 1280, 820, 0) | Out-Null
    Start-Sleep -Milliseconds 1000
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

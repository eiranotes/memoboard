Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$signature = @"
[DllImport("user32.dll")]
public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
[DllImport("user32.dll")]
public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
"@
$User32 = Add-Type -MemberDefinition $signature -Name "User32Move" -PassThru

# HWND Constants
$HWND_TOPMOST = [IntPtr](-1)
$HWND_NOTOPMOST = [IntPtr](-2)
$SWP_SHOWWINDOW = 0x0040

$process = Get-Process -Name memoboard, Memoboard-1.0.1 -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1

if ($process) {
    $hwnd = $process.MainWindowHandle
    # Show normal (1)
    $User32::ShowWindow($hwnd, 1)
    
    # Move to (100, 100), size (1280, 820) and set topmost
    $User32::SetWindowPos($hwnd, $HWND_TOPMOST, 100, 100, 1280, 820, $SWP_SHOWWINDOW)
    
    Start-Sleep -Milliseconds 1500
    Write-Output "Memoboard window (HWND: $hwnd) moved to (100, 100) and set to TOPMOST."
} else {
    Write-Output "Memoboard process not found."
}

# Capture Screen
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

# Revert topmost
if ($process) {
    # Keep the moved position (100, 100) but release topmost
    $User32::SetWindowPos($hwnd, $HWND_NOTOPMOST, 100, 100, 1280, 820, 0)
    Write-Output "Memoboard window topmost released."
}

Write-Output "Screenshot saved to $OutPath"

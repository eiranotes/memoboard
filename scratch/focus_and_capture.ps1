Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Win32 APIs to show/focus window
$signature = @"
[DllImport("user32.dll")]
public static extern bool SetForegroundWindow(IntPtr hWnd);
[DllImport("user32.dll")]
public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
"@
$User32 = Add-Type -MemberDefinition $signature -Name "User32Window" -PassThru

# Find Memoboard process
$process = Get-Process -Name memoboard -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1

if ($process) {
    $hwnd = $process.MainWindowHandle
    # Show normal (nCmdShow = 1)
    $User32::ShowWindow($hwnd, 1)
    # Set foreground
    $User32::SetForegroundWindow($hwnd)
    
    # Wait for rendering
    Start-Sleep -Milliseconds 500
    Write-Output "Memoboard window (HWND: $hwnd) brought to front."
} else {
    Write-Output "Memoboard process with active window not found."
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

Write-Output "Screenshot saved to $OutPath"

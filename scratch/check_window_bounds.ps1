Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$signature = @"
[DllImport("user32.dll")]
[return: MarshalAs(UnmanagedType.Bool)]
public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

public struct RECT
{
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
}
"@
# Avoid redeclaring class if already defined
try {
    Add-Type -MemberDefinition $signature -Namespace "Win32" -Name "Helper" -ErrorAction Stop
} catch {}

$process = Get-Process -Name memoboard, Memoboard-1.0.1 -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1

if ($process) {
    $rect = New-Object Win32.Helper+RECT
    if ([Win32.Helper]::GetWindowRect($process.MainWindowHandle, [ref]$rect)) {
        $width = $rect.Right - $rect.Left
        $height = $rect.Bottom - $rect.Top
        Write-Output "HWND: $($process.MainWindowHandle)"
        Write-Output "Bounds: Left=$($rect.Left), Top=$($rect.Top), Right=$($rect.Right), Bottom=$($rect.Bottom)"
        Write-Output "Size: Width=$width, Height=$height"
    } else {
        Write-Output "GetWindowRect failed."
    }
} else {
    Write-Output "Memoboard process with active window not found."
}

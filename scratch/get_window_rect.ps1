$signature = @"
[System.Runtime.InteropServices.DllImport("user32.dll")]
[return: System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.Bool)]
public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

public struct RECT
{
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
}
"@

$User32 = Add-Type -MemberDefinition $signature -Name "User32Rect" -PassThru

$process = Get-Process -Name memoboard, Memoboard-1.0.1 -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1

if ($process) {
    $rect = New-Object User32Rect+RECT
    if ($User32::GetWindowRect($process.MainWindowHandle, [ref]$rect)) {
        $width = $rect.Right - $rect.Left
        $height = $rect.Bottom - $rect.Top
        Write-Output "Left: $($rect.Left), Top: $($rect.Top), Right: $($rect.Right), Bottom: $($rect.Bottom)"
        Write-Output "Width: $width, Height: $height"
    } else {
        Write-Output "Failed to get window rect."
    }
} else {
    Write-Output "Process not found."
}

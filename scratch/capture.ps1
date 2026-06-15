Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

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

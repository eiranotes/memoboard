Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.SystemInformation]::VirtualScreen
Write-Output "VirtualScreen: Left=$($screen.Left), Top=$($screen.Top), Width=$($screen.Width), Height=$($screen.Height)"

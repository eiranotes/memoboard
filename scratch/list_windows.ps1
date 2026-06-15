Get-Process | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object Name, Id, MainWindowTitle, MainWindowHandle | Format-Table -AutoSize

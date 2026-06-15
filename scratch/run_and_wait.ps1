$p = Start-Process -FilePath "D:\AI\repository\Memoboard\dist\Memoboard-1.0.1.exe" -NoNewWindow -PassThru -Wait
Write-Output "Exit Code: $($p.ExitCode)"

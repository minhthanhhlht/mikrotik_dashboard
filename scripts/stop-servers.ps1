# Dừng mọi process node đang chạy (mock-router / server / vite)
# Cách dùng:  powershell -File scripts/stop-servers.ps1
Write-Host '=== Stopping node processes ==='
Get-Process -Name node -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host ("Killing PID {0}" -f $_.Id)
  Stop-Process -Id $_.Id -Force
}
Write-Host 'Done.'
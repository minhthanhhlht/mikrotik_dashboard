# Chạy backend tạm (port 3002) với router GIẢ offline để test trạng thái mất kết nối
$ErrorActionPreference = 'SilentlyContinue'
$backend = 'd:\mikrotik\wifi_hostpost_web\backend'
$cmd = 'cmd.exe'
$arg = '/c set MTIK_HOST=127.0.0.1&& set MTIK_PORT=9&& set MTIK_USER=admin&& set MTIK_PASS=x&& set PORT=3002&& node server.js'
Start-Process -FilePath $cmd -ArgumentList $arg -WorkingDirectory $backend -WindowStyle Hidden
Start-Sleep -Seconds 4
Write-Host 'offline-test backend started on :3002'
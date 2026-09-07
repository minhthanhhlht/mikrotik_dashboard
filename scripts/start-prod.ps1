# Khởi động backend production (serve cả UI dist + API REST tại 1 port 3000)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$backend = Join-Path $root 'backend'
$log = Join-Path $backend 'server.log'
$err = Join-Path $backend 'server.err.log'

Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory $backend `
  -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $err
Write-Host 'Started production backend. UI + API: http://localhost:3000'
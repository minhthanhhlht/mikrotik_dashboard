# Khởi động backend proxy + Vite (kết nối router thật trong backend/.env)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

function Start-Node($name, $script) {
  $log = Join-Path $backend ($name + '.log')
  $err = Join-Path $backend ($name + '.err.log')
  Start-Process -FilePath 'node' -ArgumentList $script -WorkingDirectory $backend `
    -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $err
  Write-Host "Started $name -> $script (log: $log)"
}

Write-Host '=== Starting backend proxy (router that) + vite ==='
Start-Node 'server' 'server.js'

$vlog = Join-Path $frontend 'vite.log'
$verr = Join-Path $frontend 'vite.err.log'
Start-Process -FilePath 'npm.cmd' -ArgumentList '--prefix','frontend','run','dev' `
  -WorkingDirectory $root -WindowStyle Hidden `
  -RedirectStandardOutput $vlog -RedirectStandardError $verr
Write-Host 'Started vite'

Write-Host 'Done. UI: http://localhost:5173'
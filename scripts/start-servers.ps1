# Dùng để chạy nhanh mock + backend + vite khi TEST (không qua npm/concurrently)
# Cách dùng:  powershell -File scripts/start-servers.ps1
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

Write-Host '=== Starting MikroTik mock + backend proxy + vite ==='
Start-Node 'mock'   'mock-router.js'
Start-Node 'server' 'server.js'

$vlog = Join-Path $frontend 'vite.log'
$verr = Join-Path $frontend 'vite.err.log'
Start-Process -FilePath 'npm.cmd' -ArgumentList '--prefix','frontend','run','dev' `
  -WorkingDirectory $root -WindowStyle Hidden `
  -RedirectStandardOutput $vlog -RedirectStandardError $verr
Write-Host 'Started vite -> npm --prefix frontend run dev (log: vite.log)'

Write-Host 'Done. Backend: http://localhost:3000/api/health | UI: http://localhost:5173'
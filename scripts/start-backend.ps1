# Chạy backend server.js (như start-prod.ps1) — dùng để test nhanh
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$backend = Join-Path $root 'backend'
$log = Join-Path $backend 'server.log'
$err = Join-Path $backend 'server.err.log'

Remove-Item $log, $err -ErrorAction SilentlyContinue

$p = Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory $backend `
  -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $err -PassThru
Start-Sleep -Seconds 3
if ($p.HasExited) {
  Write-Host 'PROCESS_EXITED. Logs:'
  Get-Content $log -ErrorAction SilentlyContinue
  Get-Content $err -ErrorAction SilentlyContinue
} else {
  Write-Host ("OK PID=" + $p.Id)
}
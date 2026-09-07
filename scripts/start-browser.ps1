# Tìm trình duyệt Chrome/Edge và khởi động với remote debugging port 9222
$candidates = @(
  "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)

$found = ""
foreach ($p in $candidates) {
  if (Test-Path $p) { $found = $p; break }
}

if ($found -eq "") {
  Write-Host "NO_BROWSER_FOUND"
  exit 1
}
Write-Host "FOUND: $found"

# Khởi động trình duyệt với remote debugging
$profile = Join-Path $env:TEMP "chrome-debug-profile"
Start-Process -FilePath $found -ArgumentList "--remote-debugging-port=9222","--user-data-dir=$profile","about:blank" -WindowStyle Maximized
Write-Host "STARTED with remote debugging on port 9222"
# Chrome headless: dump DOM để kiểm tra React mount (thay cho MCP browser)
$ErrorActionPreference = 'SilentlyContinue'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$out = 'd:\mikrotik\wifi_hostpost_web\scripts\dom-dump.html'

& $chrome --headless=new --disable-gpu --no-first-run `
  --user-data-dir="$env:TEMP\chrome-headless-check" `
  --dump-dom --virtual-time-budget=7000 `
  'http://localhost:3000' 2>$null | Out-File -Encoding utf8 $out

$dom = Get-Content -Raw $out
Write-Host ("DOM size: " + $dom.Length)
Write-Host ('Has login form: ' + $dom.Contains('login-username'))
Write-Host ('Has "Hotspot Admin": ' + $dom.Contains('Hotspot Admin'))
Write-Host ('Has button Dang nhap: ' + $dom.Contains('login'))
Write-Host '---- first 500 ----'
Write-Host $dom.Substring(0, [Math]::Min(500, $dom.Length))
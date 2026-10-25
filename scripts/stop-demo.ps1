# Arrête uniquement ce que demo-ngrok.ps1 a lancé (API, site, tunnel Chhal). Ne touche à aucun autre processus ngrok.
$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root ".demo-pids.json"
if (-not (Test-Path $pidFile)) { Write-Host "Rien à arrêter : aucun processus enregistré par demo-ngrok."; exit 0 }
$ids = Get-Content $pidFile -Raw | ConvertFrom-Json
foreach ($name in "ngrok", "web", "api") {
  $id = $ids.$name
  if ($id) {
    & taskkill /T /F /PID $id 2>$null | Out-Null
    Write-Host "Arrêté : $name (pid $id)"
  }
}
Remove-Item $pidFile -Force

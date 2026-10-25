# Lance Chhal (API + web) et l'expose en HTTPS par ngrok pour l'iPhone. Un seul double-clic : scripts\demo-ngrok.cmd
# Ne touche JAMAIS à un autre tunnel ngrok (ex. ERP AI) : voir la section « tunnel » plus bas.
param([switch]$Rebuild)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$pidFile = Join-Path $root ".demo-pids.json"
$started = @{}
function Save-Pids { $started | ConvertTo-Json | Set-Content -Path $pidFile -Encoding ascii }

function Test-Port([int]$p) { return [bool](Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue) }
function Get-Text([string]$url) {
  try { return (Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 4).Content } catch { return "" }
}
function Wait-For([scriptblock]$cond, [int]$secs, [string]$what) {
  $end = (Get-Date).AddSeconds($secs)
  while ((Get-Date) -lt $end) { if (& $cond) { return } Start-Sleep -Milliseconds 700 }
  throw "Délai dépassé : $what"
}

if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
  throw "ngrok est introuvable. Installez-le avec : winget install Ngrok.Ngrok"
}

# 1. Jeton administrateur aléatoire (fichier ignoré par git)
$envFile = Join-Path $root ".env.ngrok"
if (-not (Test-Path $envFile)) {
  $bytes = New-Object byte[] 24
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $tok = [Convert]::ToBase64String($bytes).Replace("+", "-").Replace("/", "_").TrimEnd("=")
  Set-Content -Path $envFile -Value "ADMIN_TOKEN=$tok" -Encoding ascii
}
$adminToken = ((Get-Content $envFile | Where-Object { $_ -like "ADMIN_TOKEN=*" } | Select-Object -First 1) -replace "^ADMIN_TOKEN=", "")

# 2. API (3001) et web (3000) : on réutilise Chhal s'il tourne déjà, on refuse si le port sert autre chose.
$apiUp = Test-Port 3001
if ($apiUp -and ((Get-Text "http://localhost:3001/enseignes") -notmatch '"slug"')) {
  throw "Le port 3001 est occupé par un autre service que l'API Chhal : je n'y touche pas."
}
$webUp = Test-Port 3000
if ($webUp -and ((Get-Text "http://localhost:3000/fr") -notmatch "Chhal")) {
  throw "Le port 3000 est occupé par un autre service que le web Chhal : je n'y touche pas."
}

if (-not $apiUp) {
  Write-Host "Démarrage de l'API…"
  $env:ADMIN_TOKEN = $adminToken; $env:ALLOW_TEST_DATA = "1"; $env:TRUST_PROXY = "1"; $env:PORT = "3001"
  $p = Start-Process -WindowStyle Hidden -PassThru -FilePath "cmd.exe" -WorkingDirectory (Join-Path $root "apps\api") `
    -ArgumentList "/c", "corepack pnpm exec tsx src/server.ts > ..\..\.api.log 2>&1"
  $started["api"] = $p.Id
  Save-Pids
  Wait-For { (Get-Text "http://localhost:3001/health") -match "ok" } 60 "démarrage de l'API"
}

if (-not $webUp) {
  $web = Join-Path $root "apps\web"
  if ($Rebuild -or -not (Test-Path (Join-Path $web ".next\BUILD_ID"))) {
    Write-Host "Construction du site (une minute)…"
    Push-Location $web
    & corepack pnpm exec next build
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "La construction du site a échoué." }
    Pop-Location
  }
  Write-Host "Démarrage du site…"
  $p = Start-Process -WindowStyle Hidden -PassThru -FilePath "cmd.exe" -WorkingDirectory $web `
    -ArgumentList "/c", "corepack pnpm exec next start -p 3000 > ..\..\.web.log 2>&1"
  $started["web"] = $p.Id
  Save-Pids
  Wait-For { (Get-Text "http://localhost:3000/fr") -match "Chhal" } 60 "démarrage du site"
}

# 3. Tunnel. Règle : un tunnel ngrok déjà actif n'est jamais arrêté ni réutilisé.
#    - ngrok-chhal.yml présent (2e compte ngrok gratuit) : agent séparé, port d'inspection 4051, aucun conflit.
#    - sinon, aucun agent actif : on utilise la configuration ngrok habituelle.
#    - sinon : on s'arrête avec des explications.
$chhalCfg = Join-Path $root "ngrok-chhal.yml"
$inspect = "http://127.0.0.1:4040/api/tunnels"
$ngrokArgs = @("http", "3000", "--log", "stdout")
if ((Test-Path $chhalCfg) -and ((Get-Content $chhalCfg -Raw) -match "authtoken")) {
  $ngrokArgs = @("http", "3000", "--config", $chhalCfg, "--web-addr", "127.0.0.1:4051", "--log", "stdout")
  $inspect = "http://127.0.0.1:4051/api/tunnels"
} else {
  $other = Get-Text "http://127.0.0.1:4040/api/tunnels"
  if ($other -match "public_url") {
    Write-Host ""
    Write-Host "Un tunnel ngrok est déjà actif (un autre projet) : je ne l'arrête pas et je ne le partage pas." -ForegroundColor Yellow
    Write-Host "Pour utiliser un tunnel séparé pour Chhal, avec un 2e compte ngrok gratuit :"
    Write-Host "  1. Créez le 2e compte sur https://dashboard.ngrok.com et copiez son authtoken."
    Write-Host "  2. Lancez : ngrok config add-authtoken VOTRE_TOKEN --config ngrok-chhal.yml"
    Write-Host "  3. Relancez ce script."
    Write-Host "Chhal tourne déjà en local : http://localhost:3000/fr (et sur le Wi-Fi : voir ipconfig)."
    exit 2
  }
}

Write-Host "Démarrage du tunnel…"
$log = Join-Path $root ".ngrok.log"
$np = Start-Process -WindowStyle Hidden -PassThru -FilePath "ngrok" -ArgumentList $ngrokArgs -RedirectStandardOutput $log -RedirectStandardError (Join-Path $root ".ngrok.err")
$started["ngrok"] = $np.Id
Save-Pids
$url = $null
$end = (Get-Date).AddSeconds(25)
while ((Get-Date) -lt $end -and -not $url) {
  Start-Sleep -Milliseconds 800
  $txt = Get-Text $inspect
  if ($txt -match '"public_url":"(https://[^"]+)"') { $url = $Matches[1] }
  if (Test-Path $log) {
    $err = Select-String -Path $log -Pattern "ERR_NGROK_\d+" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($err) { break }
  }
}
if (-not $url) {
  Write-Host "Le tunnel n'a pas démarré. Détail : $($err.Line)" -ForegroundColor Red
  exit 3
}

$full = "$url/fr"
Set-Clipboard -Value $full
Write-Host ""
Write-Host "Ouvrez sur l'iPhone (Safari) :  $full" -ForegroundColor Green
Write-Host "(adresse copiée dans le presse-papiers ; pour l'arabe /ar, pour l'anglais /en)"
Write-Host "Mode hors ligne : ouvrez le site une fois avec du réseau, puis « Partager > Sur l'écran d'accueil »."
Write-Host "Pour tout arrêter : scripts\stop-demo.cmd"

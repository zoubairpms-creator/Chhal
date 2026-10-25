# Enregistre l'authtoken du 2e compte ngrok dans ngrok-chhal.yml (fichier local, ignoré par git).
# Le token est saisi ICI, masqué, sur votre machine : ne le collez jamais dans une conversation.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) { throw "ngrok est introuvable. Installez-le avec : winget install Ngrok.Ngrok" }

Write-Host "Collez l'authtoken du 2e compte ngrok (page « Your Authtoken »), puis Entrée. La saisie est masquée."
$secure = Read-Host -AsSecureString "Authtoken"
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }

if ([string]::IsNullOrWhiteSpace($token)) { throw "Aucun token saisi." }
if ($token -like "cr_*") { throw "Ceci est un identifiant (cr_...), pas l'authtoken. Récupérez la valeur de l'authtoken sur le tableau de bord." }

& ngrok config add-authtoken $token --config (Join-Path $root "ngrok-chhal.yml")
$token = $null
if ($LASTEXITCODE -ne 0) { throw "ngrok a refusé le token." }

& ngrok config check --config (Join-Path $root "ngrok-chhal.yml")
Write-Host ""
Write-Host "Terminé. Révoquez tout token que vous avez collé ailleurs (chat, notes). Lancez ensuite scripts\demo-ngrok.cmd" -ForegroundColor Green

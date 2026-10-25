@echo off
cd /d "%~dp0"
if not exist ".env" (
  echo Fichier .env absent. Configurer l'environnement avant de lancer Chhal.
  exit /b 1
)
node apps\api\node_modules\tsx\dist\cli.mjs --env-file=.env apps\api\src\server.ts

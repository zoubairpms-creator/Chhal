@echo off
rem Double-cliquez : saisie masquee de l'authtoken du 2e compte ngrok (jamais dans une conversation).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-ngrok-chhal.ps1"
echo.
pause

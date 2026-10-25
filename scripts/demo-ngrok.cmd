@echo off
rem Double-cliquez pour lancer Chhal et obtenir l'adresse HTTPS pour l'iPhone.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0demo-ngrok.ps1" %*
echo.
pause

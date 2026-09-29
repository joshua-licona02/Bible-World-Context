@echo off
rem Opens the app at http://localhost:5510 instead of as a file.
rem Ollama rejects pages opened as files (Origin: null) but accepts localhost, so the AI features work this way.
rem Close the "Bible World Context server" window to stop the app.

cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install it from https://www.python.org/downloads/ and try again.
  pause
  exit /b 1
)

start "Bible World Context server" /min python -m http.server 5510 --bind 127.0.0.1
timeout /t 1 /nobreak >nul
start "" http://localhost:5510/

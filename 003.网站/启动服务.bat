@echo off
title Pack Counting Assistant - Server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   ERROR: Node.js was not found in PATH.
  echo   Please install Node.js from https://nodejs.org and try again.
  echo.
  pause
  exit /b 1
)

node server.js --open

echo.
echo   Server stopped. Press any key to close this window.
pause >nul

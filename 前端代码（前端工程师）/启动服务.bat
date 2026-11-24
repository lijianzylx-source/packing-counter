@echo off
title Pack Counting Assistant - Frontend
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

REM If port 5174 is already listening, the server is already running.
netstat -ano | findstr ":5174" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo Port 5174 already in use - server already running.
  echo Opening http://localhost:5174 ...
  start "" "http://localhost:5174"
  exit /b 0
)

start "" "http://localhost:5174"
node server.js 5174

echo.
echo   Server stopped. Press any key to close this window.
pause >nul

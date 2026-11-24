@echo off
title Pack Counting Assistant - Server
cd /d "%~dp0"

REM Skip if port 5173 is already listening (avoid double start at login)
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo Port 5173 already in use - server is already running.
  exit /b 0
)

set "NODE_EXE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE_EXE%" (
  where node >nul 2>nul
  if errorlevel 1 (
    echo ERROR: Node.js not found. Install it from https://nodejs.org
    exit /b 1
  )
  set "NODE_EXE=node"
)

start "Pack Counting Assistant" /min "%NODE_EXE%" server.js 5173
exit /b 0

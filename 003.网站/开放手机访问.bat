@echo off
REM Open TCP 5173 (account API) and 5174 (frontend) for inbound LAN access.
REM Right-click this file and choose "Run as administrator" (以管理员身份运行).
title Open ports 5173 / 5174 for phone access

echo.
echo  Adding Windows Firewall rules for the pack-counting app...
echo.

REM 1) port-based rules (work no matter which node.exe path is used)
netsh advfirewall firewall delete rule name="Pack Counter API 5173" >nul 2>nul
netsh advfirewall firewall add rule name="Pack Counter API 5173" dir=in action=allow protocol=TCP localport=5173 remoteip=localsubnet,localloopback profile=any

netsh advfirewall firewall delete rule name="Pack Counter Web 5174" >nul 2>nul
netsh advfirewall firewall add rule name="Pack Counter Web 5174" dir=in action=allow protocol=TCP localport=5174 remoteip=localsubnet,localloopback profile=any

REM 2) program-based rule for node.exe (covers instances started by the scheduled task)
netsh advfirewall firewall delete rule name="Pack Counter Server node" >nul 2>nul
netsh advfirewall firewall add rule name="Pack Counter Server node" dir=in action=allow program="C:\Program Files\nodejs\node.exe" profile=any

echo.
echo  ---- Result ----
netsh advfirewall firewall show rule name="Pack Counter API 5173" | findstr /C:"Rule Name" /C:"Enabled" /C:"已启用" /C:"LocalPort" /C:"本地端口" /C:"Action" /C:"操作"
netsh advfirewall firewall show rule name="Pack Counter Web 5174" | findstr /C:"Rule Name" /C:"Enabled" /C:"已启用" /C:"LocalPort" /C:"本地端口" /C:"Action" /C:"操作"
netsh advfirewall firewall show rule name="Pack Counter Server node" | findstr /C:"Rule Name" /C:"Enabled" /C:"已启用" /C:"Action" /C:"操作"

echo.
echo  ---- Open on your phone (same Wi-Fi) ----
powershell -NoProfile -Command "$ip=(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -like '*WLAN*' -or $_.InterfaceAlias -like '*Wi-Fi*' } | Select-Object -First 1 -ExpandProperty IPAddress); if (-not $ip) { $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1 -ExpandProperty IPAddress) }; if ($ip) { Write-Host ('  Site:  http://' + $ip + ':5174'); Write-Host ('  API:   http://' + $ip + ':5173'); Write-Host ''; Write-Host '  (the page auto-detects the API address - no manual setting needed)' }"

echo.
echo  Press any key to close.
pause >nul

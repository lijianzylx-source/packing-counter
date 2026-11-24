@echo off
REM Show the addresses you can open in a browser (PC and phone on the same Wi-Fi).
title Pack Counting Assistant - Access addresses

echo.
echo   Open on this PC:
echo     http://localhost:5173
echo.
echo   Open on your phone (same Wi-Fi):
powershell -NoProfile -Command "$ip=(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1 -ExpandProperty IPAddress); if ($ip) { Write-Host ('     http://' + $ip + ':5173'); Set-Clipboard ('http://' + $ip + ':5173'); Write-Host '     (copied to clipboard)' } else { Write-Host '     No LAN address found - check the Wi-Fi connection.' }"
echo.
echo   Server status:
powershell -NoProfile -Command "$c=Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue; if ($c) { Write-Host ('     Running (PID ' + $c[0].OwningProcess + ')') } else { Write-Host '     NOT running - start it with the .bat files in this folder' }"
echo.
pause

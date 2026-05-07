@echo off
title PaginaAuto - Inyector de errores de prueba
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0test-errores.ps1"
echo.
echo (Si la ventana se cerro antes, ejecuta este .bat desde una ventana cmd para ver el error)
pause

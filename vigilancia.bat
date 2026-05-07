@echo off
setlocal
title PaginaAuto - Panel de Vigilancia
cd /d "%~dp0"

echo ============================================================
echo  PAGINAAUTO - Panel de Vigilancia
echo ============================================================
echo.

REM --- Localizar Google Chrome ---
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if defined CHROME (
    echo [i] Chrome detectado: %CHROME%
) else (
    echo [!] Chrome no encontrado, se usara el navegador por defecto.
)

echo.
echo [1/4] Comprobando backend Node en http://localhost:4000 ...
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:4000/health' -UseBasicParsing -TimeoutSec 2 ^| Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1

if errorlevel 1 (
    echo     [!] Backend no responde. Lanzando backend Node...
    if exist "backend\package.json" (
        start "PaginaAuto Backend :4000" cmd /k "cd /d %~dp0backend && npm run dev"
    ) else (
        echo     [X] No se encontro backend\package.json
    )
) else (
    echo     [OK] Backend en linea.
)

echo.
echo [2/4] Comprobando pipeline IA (main.py) en http://localhost:8000 ...
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:8000/' -UseBasicParsing -TimeoutSec 2 ^| Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1

if errorlevel 1 (
    echo     [!] main.py no responde. Intentando lanzar...
    if exist "..\Pagina automatizacion\main.py" (
        start "PaginaAuto IA :8000" cmd /k "cd /d %~dp0..\Pagina automatizacion && python main.py"
    ) else (
        echo     [i] main.py no encontrado, omitiendo.
    )
) else (
    echo     [OK] Pipeline IA en linea.
)

echo.
echo [3/4] Comprobando sitio de pruebas avantservice en http://localhost:5500 ...
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:5500/' -UseBasicParsing -TimeoutSec 2 ^| Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1

if errorlevel 1 (
    if exist "..\avantservice\index.html" (
        echo     [!] No responde. Lanzando servidor estatico de avantservice...
        start "AvantService :5500" cmd /k "cd /d %~dp0..\avantservice && python -m http.server 5500"
    ) else (
        echo     [i] No hay carpeta avantservice, se omitira.
    )
) else (
    echo     [OK] Sitio de pruebas en linea.
)

echo.
echo [4/4] Esperando 5s para que arranquen los servicios...
timeout /t 5 /nobreak >nul

echo.
echo Abriendo Panel de Vigilancia + sitio de pruebas en Chrome...

set "PANEL=http://localhost:4000/panel"
set "DEMO=http://localhost:5500/"

if defined CHROME (
    start "" "%CHROME%" --new-window "%PANEL%"
    timeout /t 1 /nobreak >nul
    start "" "%CHROME%" "%DEMO%"
) else (
    start "" "%PANEL%"
    start "" "%DEMO%"
)

echo.
echo ============================================================
echo  Panel abierto. Ya puedes provocar errores en la web demo
echo  y verlos en directo en el panel de vigilancia.
echo.
echo  Truco rapido para forzar un error desde la consola (F12):
echo     fetch('http://no-existe.local').catch(()=>{});
echo     throw new Error('prueba manual');
echo ============================================================
echo.
pause
endlocal

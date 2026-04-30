@echo off
chcp 65001 >nul
title Auto-Fix - todolisto
setlocal

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "PIPELINE=%ROOT%..\Pagina automatizacion"
set "AVANT=%ROOT%..\avantservice"

echo ================================================
echo   Auto-Fix - arrancando todos los servicios
echo ================================================
echo.

REM --- 1) Dependencias backend ---
if not exist "%BACKEND%\node_modules" (
  echo [backend] instalando dependencias...
  pushd "%BACKEND%" && call npm install && popd
)

REM --- 2) .env + init DB ---
if not exist "%BACKEND%\.env" (
  echo [backend] copiando .env y creando DB...
  copy /Y "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
  pushd "%BACKEND%" && call npm run init-db && popd
)

REM --- 3) Pipeline IA (FastAPI, main.py) en :8000 ---
if exist "%PIPELINE%\main.py" (
  echo [pipeline] lanzando main.py en :8000
  start "Auto-Fix - Pipeline IA (python)" cmd /k "cd /d ""%PIPELINE%"" && python main.py"
) else (
  echo [pipeline] AVISO: no se encontro main.py en %PIPELINE%
)

REM --- 4) Backend Node en :4000 ---
echo [backend]  lanzando Node API en :4000
start "Auto-Fix - Backend (Node)" cmd /k "cd /d ""%BACKEND%"" && npm run dev"

REM --- 5) Sitio avantservice (estatico) en :5500 ---
if exist "%AVANT%\index.html" (
  echo [avantservice] sirviendo en :5500
  start "AVANTSERVICE - Sitio (python http)" cmd /k "cd /d ""%AVANT%"" && python -m http.server 5500"
) else (
  echo [avantservice] AVISO: no se encontro %AVANT%\index.html
)

REM --- Abrir navegadores ---
timeout /t 5 /nobreak >nul
start "" "http://127.0.0.1:8000/"
start "" "http://localhost:5500/"

echo.
echo ================================================
echo  Todo listo:
echo    Dashboard    : http://127.0.0.1:8000/
echo    avantservice : http://localhost:5500/
echo    Backend      : http://localhost:4000/health
echo    Pipeline     : http://localhost:8000/health
echo ================================================
echo (WAMP encendido para MySQL)
echo.
pause
endlocal

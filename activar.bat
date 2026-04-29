@echo off
chcp 65001 >nul
title PAGINAAUTO - Activador
setlocal

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "PIPELINE=%ROOT%..\Pagina automatizacion"

echo ================================================
echo   PAGINAAUTO - arrancando todos los servicios
echo ================================================
echo.

REM --- 1) Instalar dependencias si faltan ---
if not exist "%BACKEND%\node_modules" (
  echo [backend] instalando dependencias...
  pushd "%BACKEND%" && call npm install && popd
)

REM --- 2) Inicializar DB si no existe .env ---
if not exist "%BACKEND%\.env" (
  echo [backend] copiando .env y creando DB...
  copy /Y "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
  pushd "%BACKEND%" && call npm run init-db && popd
)

REM --- 3) Pipeline IA (FastAPI, main.py) ---
if exist "%PIPELINE%\main.py" (
  echo [pipeline] lanzando main.py en :8000
  start "PAGINAAUTO - Pipeline IA (python)" cmd /k "cd /d ""%PIPELINE%"" && python main.py"
) else (
  echo [pipeline] AVISO: no se encontro main.py en %PIPELINE%
)

REM --- 4) Backend Node ---
echo [backend]  lanzando Node API en :4000
start "PAGINAAUTO - Backend (Node)" cmd /k "cd /d ""%BACKEND%"" && npm run dev"

echo.
echo Todo lanzado. Cierra las ventanas para detener cada servicio.
echo   Backend  : http://localhost:4000/health
echo   Pipeline : http://localhost:8000/health
endlocal

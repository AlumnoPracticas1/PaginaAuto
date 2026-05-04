@echo off
chcp 65001 >nul
title PaginaAuto - todolisto
setlocal

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "PIPELINE=%ROOT%..\Pagina automatizacion"
set "AVANT=%ROOT%..\avantservice"

echo ================================================
echo   PaginaAuto - arrancando todos los servicios
echo ================================================
echo.

REM --- 1) Dependencias backend ---
if not exist "%BACKEND%\node_modules" (
  echo [backend]  instalando dependencias...
  pushd "%BACKEND%" && call npm install && popd
)

REM --- 2) Dependencias frontend ---
if not exist "%FRONTEND%\node_modules" (
  echo [frontend] instalando dependencias...
  pushd "%FRONTEND%" && call npm install && popd
)

REM --- 3) .env + init DB ---
if not exist "%BACKEND%\.env" (
  echo [backend]  copiando .env y creando DB...
  if exist "%BACKEND%\.env.example" copy /Y "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
  pushd "%BACKEND%" && call npm run init-db && popd
)

REM --- 4) Pipeline IA (FastAPI, main.py) en :8000 ---
if exist "%PIPELINE%\main.py" (
  echo [pipeline] lanzando main.py en :8000
  start "PaginaAuto - Pipeline IA (python)" cmd /k "cd /d ""%PIPELINE%"" && python main.py"
) else (
  echo [pipeline] AVISO: no se encontro main.py en %PIPELINE%
)

REM --- 5) Backend Node en :4000 ---
echo [backend]  lanzando Node API en :4000
start "PaginaAuto - Backend (Node :4000)" cmd /k "cd /d ""%BACKEND%"" && npm run dev"

REM --- 6) Frontend Vite en :5173 ---
echo [frontend] lanzando Vite en :5173
start "PaginaAuto - Frontend (Vite :5173)" cmd /k "cd /d ""%FRONTEND%"" && npm run dev"

REM --- 7) Sitio avantservice (estatico) en :5500 (opcional) ---
if exist "%AVANT%\index.html" (
  echo [avantservice] sirviendo en :5500
  start "AVANTSERVICE - Sitio (python http :5500)" cmd /k "cd /d ""%AVANT%"" && python -m http.server 5500"
) else (
  echo [avantservice] (no se encontro %AVANT%\index.html, se omite)
)

REM --- Esperar a que el frontend este listo ---
echo.
echo Esperando a que los servicios arranquen...
timeout /t 8 /nobreak >nul

REM --- Abrir navegadores ---
start "" "http://localhost:5173/"
start "" "http://127.0.0.1:8000/"
if exist "%AVANT%\index.html" start "" "http://localhost:5500/"

echo.
echo ================================================
echo  Todo listo:
echo    Dashboard nuevo (React) : http://localhost:5173/
echo    Backend API             : http://localhost:4000/health
echo    Pipeline IA             : http://localhost:8000/
echo    avantservice (cliente)  : http://localhost:5500/
echo ================================================
echo (recuerda: WAMP encendido para MySQL)
echo.
echo Pulsa cualquier tecla para cerrar esta ventana
echo (los servicios seguiran en sus propias ventanas).
pause >nul
endlocal

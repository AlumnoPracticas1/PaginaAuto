@echo off
setlocal
title PaginaAuto - Migracion BD (anadir columna extra)
cd /d "%~dp0backend"

echo ============================================================
echo  PAGINAAUTO - Migracion BD
echo  Anade la columna 'extra' a la tabla previews para guardar
echo  la URL del cliente y demas metadatos.
echo ============================================================
echo.

if not exist "node_modules" (
    echo [1/2] Instalando dependencias del backend...
    call npm install
    if errorlevel 1 (
        echo.
        echo [X] Fallo npm install. Revisa el error de arriba.
        pause
        exit /b 1
    )
) else (
    echo [1/2] Dependencias OK.
)

echo.
echo [2/2] Ejecutando init-db (crea DB si falta + migra columna extra)...
echo.
call npm run init-db

if errorlevel 1 (
    echo.
    echo [X] La migracion fallo. Comprueba:
    echo     - WAMP encendido (MySQL en :3306)
    echo     - backend\.env con credenciales correctas
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  [OK] Migracion completada. Ya puedes abrir vigilancia.bat
echo ============================================================
echo.
pause
endlocal

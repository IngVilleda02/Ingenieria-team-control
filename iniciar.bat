@echo off
chcp 65001 >nul
title Ingenieria Team Control
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  No se encontro Node.js. Instala la version LTS desde https://nodejs.org y vuelve a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias por primera vez, puede tardar unos minutos...
  call npm install || goto :error
)

if not exist .next\BUILD_ID (
  echo Preparando la aplicacion...
  call npm run build || goto :error
)

echo.
echo  Ingenieria Team Control se abre en http://localhost:3000
echo  Tus datos se guardan en la carpeta "data". No cierres esta ventana mientras la uses.
echo.
start "" http://localhost:3000
call npm run start
goto :eof

:error
echo.
echo  Ocurrio un error. Revisa el mensaje de arriba.
pause
exit /b 1

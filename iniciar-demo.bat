@echo off
chcp 65001 >nul
title Ingenieria Team Control - DEMO
cd /d "%~dp0"
where node >nul 2>nul || (echo Instala Node.js LTS desde https://nodejs.org & pause & exit /b 1)
if not exist node_modules call npm install || goto :error
if not exist .next\BUILD_ID call npm run build || goto :error
if not exist data\demo (
  echo Creando datos de demostracion...
  call npm run demo:seed || goto :error
)
echo.
echo  DEMO en http://localhost:3001  (no toca tus datos reales)
echo  Usuario: demo@teamcontrol.local   Contrasena: Demo2026segura
echo.
start "" http://localhost:3001
call npm run demo
goto :eof
:error
echo Ocurrio un error. Revisa el mensaje de arriba.
pause
exit /b 1

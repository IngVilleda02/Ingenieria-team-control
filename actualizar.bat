@echo off
cd /d "%~dp0"
echo Reconstruyendo la aplicacion despues de una actualizacion...
call npm install && call npm run build && echo Listo. Ejecuta iniciar.bat
pause

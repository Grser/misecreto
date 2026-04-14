@echo off
echo.
echo ================================================
echo  MiSecreto - Setup completo
echo ================================================
echo.

echo [1/5] Borrando node_modules...
if exist node_modules rmdir /s /q node_modules
echo       OK

echo [2/5] Borrando lock files...
if exist pnpm-lock.yaml del /f /q pnpm-lock.yaml
if exist yarn.lock del /f /q yarn.lock
if exist package-lock.json del /f /q package-lock.json
echo       OK

echo [3/5] Borrando cache de Expo y Metro...
if exist .expo rmdir /s /q .expo
if exist %TEMP%\metro-cache rmdir /s /q %TEMP%\metro-cache
echo       OK

echo [4/5] Instalando con pnpm (hoisted mode)...
pnpm install
echo       OK

echo [5/5] Iniciando app...
echo.
echo  ================================================
echo   Escaneá el QR con Expo Go en tu telefono
echo  ================================================
echo.
pnpm expo start --clear

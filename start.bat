@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

if not exist "node_modules" (
    echo First run - installing dependencies...
    call npm install
)

echo.
echo ChatDeck
echo   http://localhost:3456
echo.

npm run dev

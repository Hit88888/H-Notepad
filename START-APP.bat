@echo off
cd /d "%~dp0"
echo ================================
echo   H-Notepad - Setup and Launch
echo ================================
echo.
if not exist "node_modules" (
    echo First time setup - installing dependencies, this takes a minute...
    call npm install
    if errorlevel 1 (
        echo.
        echo Something went wrong during install. Scroll up to see the error.
        pause
        exit /b 1
    )
)
echo.
echo Starting H-Notepad...
call npm start
pause

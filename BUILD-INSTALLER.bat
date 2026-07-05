@echo off
cd /d "%~dp0"
echo ==========================================
echo   H-Notepad - Build Windows Installer
echo ==========================================
echo.
if not exist "node_modules" (
    echo Installing dependencies first, this takes a minute...
    call npm install
    if errorlevel 1 (
        echo.
        echo Something went wrong during install. Scroll up to see the error.
        pause
        exit /b 1
    )
)
echo.
echo Building installer... this can take a few minutes.
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npm run dist:win
if errorlevel 1 (
    echo.
    echo Build failed. Scroll up to see the error.
    pause
    exit /b 1
)
echo.
echo Done! Your installer is in the "dist" folder.
echo Look for a file like "H-Notepad Setup 1.0.0.exe"
explorer "dist"
pause

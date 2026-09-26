@echo off
rem Rebuilds docs\game-book.html from the game and opens it.
cd /d "%~dp0"
node tools\game-book.mjs
if errorlevel 1 goto fail
start "" "%~dp0docs\game-book.html"
exit /b 0
:fail
echo.
echo Could not build the book - see the error above.
pause

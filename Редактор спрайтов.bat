@echo off
rem Opens the sprite editor. Rebuilds tools\sprite-data.js from index.html first,
rem so the editor always shows the sprites that are in the game right now.
cd /d "%~dp0"
node tools\sprite-data.mjs
if errorlevel 1 goto fail
start "" "%~dp0tools\sprite-editor.html"
exit /b 0
:fail
echo.
echo Could not read sprites from index.html - see the error above.
pause

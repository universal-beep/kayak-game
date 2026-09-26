@echo off
rem Takes the newest sprite-*.json from Downloads (saved by the editor),
rem writes it into index.html and runs the lint check.
cd /d "%~dp0"
node tools\sprite-apply.mjs --latest
if errorlevel 1 goto end
call npm run lint
:end
echo.
pause

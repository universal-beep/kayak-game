@echo off
rem Runs the whole game with the autopilot (9 days x 3 seeds) and saves
rem results to docs\playthrough (JSON + history.md). Takes several minutes.
cd /d "%~dp0"
node tools\playthrough.mjs %*
if errorlevel 1 goto fail
echo.
echo Done. History: docs\playthrough\history.md
pause
exit /b 0
:fail
echo.
echo Some runs did not finish or crashed - see above.
pause

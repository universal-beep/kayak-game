@echo off
rem Drag an mp3/wav/ogg file onto this bat to put it into the game (bread sound).
cd /d "%~dp0"
if "%~1"=="" (
  echo Drag a sound file onto this bat.
  pause
  exit /b 1
)
node tools/add-sound.mjs crunch "%~1"
pause

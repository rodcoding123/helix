@echo off
set PATH=%PATH%;C:\Users\Specter\.cargo\bin
cd /d "%~dp0"
npm run tauri:dev

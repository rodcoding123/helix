@echo off
REM Helix Desktop Gateway Launcher (Windows)
REM
REM Launches the Helix gateway with all Phase 1B implementations
REM and port discovery for robust dev tool operation.
REM
REM Features:
REM - Memory synthesis pipeline (post-conversation AI analysis)
REM - THANOS_MODE creator authentication (API key verification)
REM - Salience scoring (memory importance calculation)
REM - Discord logging with hash chain integrity
REM - Port discovery (auto-fallback to next available port)
REM
REM Usage:
REM   helix-gateway-desktop.bat              (Start with default port 18789)
REM   set HELIX_GATEWAY_PORT=3000 && helix-gateway-desktop.bat  (Custom port)

echo.
echo ========================================
echo 🚀 Helix Desktop Gateway Launcher
echo ========================================
echo.
echo 🧠 Phase 1B Features Enabled:
echo   - Memory synthesis pipeline
echo   - THANOS_MODE authentication
echo   - Salience-based memory scoring
echo   - Hash chain logging
echo   - Port discovery with fallback
echo.

REM Enable auto-start for desktop app mode
set HELIX_GATEWAY_AUTOSTART=true

REM Set default port if not specified
if not defined HELIX_GATEWAY_PORT (
  set HELIX_GATEWAY_PORT=18789
)

echo 📍 Gateway Port: %HELIX_GATEWAY_PORT% (auto-fallback enabled)
echo 🌍 Environment: development
echo.
echo ========================================
echo.

REM Launch gateway
node helix-gateway-desktop.js

pause

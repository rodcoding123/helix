@echo off
REM Install 1Password CLI using winget
echo Installing 1Password CLI via winget...
winget install 1Password.CLI -e
if %errorlevel% equ 0 (
    echo.
    echo ✓ 1Password CLI installed successfully!
    echo.
    echo Verifying installation...
    op --version
    if %errorlevel% equ 0 (
        echo ✓ op command is working!
        echo.
        echo Next steps:
        echo 1. Run: op account add
        echo 2. Then run: scripts\setup-1password-direct.bat
    ) else (
        echo ✗ op command not found in PATH. Try restarting terminal/Windows.
    )
) else (
    echo ✗ Failed to install 1Password CLI
    echo.
    echo Alternative: Download from https://1password.com/downloads/command-line-tools/
)
pause

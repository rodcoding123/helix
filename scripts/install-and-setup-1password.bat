@echo off
REM Install and setup 1Password CLI for Helix
REM Run this script to complete the full setup

echo.
echo 1PASSWORD INSTALLATION AND SETUP FOR HELIX
echo ============================================
echo.

REM Step 1: Download 1Password CLI
echo Step 1: Downloading 1Password CLI...
powershell -NoProfile -Command "
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor [System.Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'
$zipFile = '%TEMP%\op.zip'
$extractPath = '%LOCALAPPDATA%\1Password'
New-Item -ItemType Directory -Force -Path $extractPath | Out-Null
Write-Host 'Downloading from https://downloads.1password.com/win/cli/x86_64/op.zip ...'
Invoke-WebRequest -Uri 'https://downloads.1password.com/win/cli/x86_64/op.zip' -OutFile $zipFile -UseBasicParsing
Expand-Archive -Path $zipFile -DestinationPath $extractPath -Force
Write-Host 'Extracted to: '$extractPath
del $zipFile
"

if %errorlevel% equ 0 (
    echo ✓ Downloaded and extracted successfully
) else (
    echo ✗ Failed to download. Trying alternative method...
    REM Alternative: winget
    echo Installing via winget...
    powershell -NoProfile -Command "winget install 1Password.CLI -e --accept-source-agreements"
)

echo.
echo Step 2: Adding op.exe to PATH...
setx PATH "%LOCALAPPDATA%\1Password;%PATH%" /M
echo ✓ Added to system PATH

echo.
echo Step 3: Verifying installation...
"%LOCALAPPDATA%\1Password\op.exe" --version
if %errorlevel% equ 0 (
    echo ✓ 1Password CLI is working!
) else (
    echo ✗ Still not found. Try restarting PowerShell/Command Prompt.
    pause
    exit /b 1
)

echo.
echo Step 4: Authenticating with 1Password...
echo Please follow the browser authentication.
echo.
"%LOCALAPPDATA%\1Password\op.exe" account add

if %errorlevel% equ 0 (
    echo ✓ Authenticated successfully!
) else (
    echo ✗ Authentication failed
    pause
    exit /b 1
)

echo.
echo Step 5: Creating Helix vault and migrating secrets...
cd /d "c:\Users\Specter\Desktop\Helix"
bash scripts/setup-1password.sh

if %errorlevel% equ 0 (
    echo ✓ Vault created and secrets migrated!
) else (
    echo ✗ Setup failed
    pause
    exit /b 1
)

echo.
echo Step 6: Verifying integration...
npx ts-node scripts/verify-1password.ts

if %errorlevel% equ 0 (
    echo ✓ Integration verified!
    echo.
    echo ALL DONE! 1Password is now set up for Helix.
    echo.
    echo Next:
    echo   1. Update your app startup to call: await initializeDiscordWebhooks()
    echo   2. Run: npm run test
    echo   3. Start your app normally
) else (
    echo ✗ Verification failed
)

pause

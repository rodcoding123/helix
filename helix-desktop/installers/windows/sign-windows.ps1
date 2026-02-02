# Helix Desktop - Windows Code Signing Script
#
# PREREQUISITES:
# 1. EV Code Signing Certificate (from DigiCert, Sectigo, etc.)
# 2. Windows SDK with signtool.exe installed
# 3. Certificate installed in Windows Certificate Store or as PFX file
#
# USAGE:
#   .\sign-windows.ps1 -FilePath "path\to\Helix.exe"
#   .\sign-windows.ps1 -FilePath "path\to\Helix.exe" -CertThumbprint "ABC123..."
#   .\sign-windows.ps1 -FilePath "path\to\Helix.exe" -PfxPath "cert.pfx" -PfxPassword "password"
#
# ENVIRONMENT VARIABLES (for CI):
#   WINDOWS_CERTIFICATE - Base64 encoded PFX certificate
#   WINDOWS_CERTIFICATE_PASSWORD - PFX password
#   WINDOWS_CERT_THUMBPRINT - Certificate thumbprint (if using cert store)

param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,

    [Parameter(Mandatory=$false)]
    [string]$CertThumbprint,

    [Parameter(Mandatory=$false)]
    [string]$PfxPath,

    [Parameter(Mandatory=$false)]
    [SecureString]$PfxPassword,

    [Parameter(Mandatory=$false)]
    [string]$TimestampServer = "http://timestamp.digicert.com",

    [Parameter(Mandatory=$false)]
    [string]$Description = "Helix - AI Consciousness Desktop App"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "Helix Windows Code Signing"
Write-Host "========================================"

# Verify file exists
if (-not (Test-Path $FilePath)) {
    Write-Error "File not found: $FilePath"
    exit 1
}

Write-Host "File to sign: $FilePath"

# Find signtool.exe
$signtoolPaths = @(
    "${env:ProgramFiles(x86)}\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe",
    "${env:ProgramFiles(x86)}\Windows Kits\10\bin\10.0.19041.0\x64\signtool.exe",
    "${env:ProgramFiles(x86)}\Windows Kits\10\bin\x64\signtool.exe",
    "${env:ProgramFiles}\Windows Kits\10\bin\x64\signtool.exe"
)

$signtool = $null
foreach ($path in $signtoolPaths) {
    if (Test-Path $path) {
        $signtool = $path
        break
    }
}

if (-not $signtool) {
    Write-Error "signtool.exe not found. Install Windows SDK."
    exit 1
}

Write-Host "Using signtool: $signtool"

# Build signing arguments
$signArgs = @(
    "sign",
    "/fd", "SHA256",
    "/tr", $TimestampServer,
    "/td", "SHA256",
    "/d", $Description
)

# Use certificate thumbprint (from cert store)
if ($CertThumbprint) {
    Write-Host "Using certificate from store: $CertThumbprint"
    $signArgs += @("/sha1", $CertThumbprint)
}
# Use PFX file
elseif ($PfxPath) {
    if (-not (Test-Path $PfxPath)) {
        Write-Error "PFX file not found: $PfxPath"
        exit 1
    }
    Write-Host "Using PFX certificate: $PfxPath"
    $signArgs += @("/f", $PfxPath)

    if ($PfxPassword) {
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($PfxPassword)
        $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        $signArgs += @("/p", $plainPassword)
    }
}
# Use environment variables (CI)
elseif ($env:WINDOWS_CERTIFICATE) {
    Write-Host "Using certificate from environment variable"

    $certBytes = [Convert]::FromBase64String($env:WINDOWS_CERTIFICATE)
    $tempPfx = [System.IO.Path]::GetTempFileName() + ".pfx"
    [System.IO.File]::WriteAllBytes($tempPfx, $certBytes)

    $signArgs += @("/f", $tempPfx)

    if ($env:WINDOWS_CERTIFICATE_PASSWORD) {
        $signArgs += @("/p", $env:WINDOWS_CERTIFICATE_PASSWORD)
    }
}
elseif ($env:WINDOWS_CERT_THUMBPRINT) {
    Write-Host "Using certificate thumbprint from environment"
    $signArgs += @("/sha1", $env:WINDOWS_CERT_THUMBPRINT)
}
else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "PLACEHOLDER MODE - No certificate provided" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To sign for real, provide one of:" -ForegroundColor Yellow
    Write-Host "  -CertThumbprint     Certificate thumbprint from Windows store"
    Write-Host "  -PfxPath            Path to PFX certificate file"
    Write-Host "  WINDOWS_CERTIFICATE Environment variable (base64 PFX)"
    Write-Host ""
    Write-Host "Example command that would be run:"
    Write-Host "  signtool sign /fd SHA256 /tr $TimestampServer /td SHA256 /sha1 <thumbprint> `"$FilePath`""
    Write-Host ""
    exit 0
}

# Add file path
$signArgs += $FilePath

# Sign the file
Write-Host ""
Write-Host "Signing file..."
& $signtool $signArgs

if ($LASTEXITCODE -ne 0) {
    Write-Error "Signing failed with exit code: $LASTEXITCODE"
    exit $LASTEXITCODE
}

# Verify signature
Write-Host ""
Write-Host "Verifying signature..."
& $signtool verify /pa /v $FilePath

if ($LASTEXITCODE -ne 0) {
    Write-Error "Signature verification failed"
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================"
Write-Host "Signing complete!" -ForegroundColor Green
Write-Host "========================================"

# Cleanup temp PFX if created
if ($tempPfx -and (Test-Path $tempPfx)) {
    Remove-Item $tempPfx -Force
}

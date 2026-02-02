# Blueprint 05: Distribution

> Packaging, signing, and delivering Helix to users

## Distribution Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DISTRIBUTION CHANNELS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DESKTOP (Phase 1)                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  Windows          macOS            Linux                            │   │
│  │  ────────         ─────            ─────                            │   │
│  │  .exe (NSIS)      .dmg             .AppImage                        │   │
│  │  .msi (optional)  .pkg (optional)  .deb                             │   │
│  │                                     .rpm                            │   │
│  │                                                                      │   │
│  │  Download: project-helix.org/download                               │   │
│  │  Auto-update: Built-in (Tauri Updater)                              │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  MOBILE (Phase 2 - Future)                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  iOS               Android                                          │   │
│  │  ───               ───────                                          │   │
│  │  App Store         Play Store                                       │   │
│  │  TestFlight        APK (sideload)                                   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Platform-Specific Packaging

### Windows

**Installer: NSIS**

```nsis
; helix-installer.nsi

!include "MUI2.nsh"

Name "Helix"
OutFile "Helix-Setup-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Helix"
RequestExecutionLevel user

; Modern UI settings
!define MUI_ICON "icons\icon.ico"
!define MUI_UNICON "icons\icon.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "icons\installer-welcome.bmp"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Installation
Section "Install"
    SetOutPath $INSTDIR

    ; Main application
    File /r "dist\*.*"

    ; Bundled Node.js runtime
    File /r "resources\node\win-x64\*.*"

    ; Helix engine
    File /r "helix-engine\*.*"

    ; Create shortcuts
    CreateDirectory "$SMPROGRAMS\Helix"
    CreateShortcut "$SMPROGRAMS\Helix\Helix.lnk" "$INSTDIR\Helix.exe"
    CreateShortcut "$DESKTOP\Helix.lnk" "$INSTDIR\Helix.exe"

    ; Register uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"

    ; Add to registry (for Add/Remove Programs)
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Helix" \
        "DisplayName" "Helix"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Helix" \
        "UninstallString" "$INSTDIR\Uninstall.exe"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Helix" \
        "DisplayIcon" "$INSTDIR\Helix.exe"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Helix" \
        "Publisher" "Project Helix"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Helix" \
        "DisplayVersion" "${VERSION}"

    ; Register URL protocol (helix://)
    WriteRegStr HKCU "Software\Classes\helix" "" "URL:Helix Protocol"
    WriteRegStr HKCU "Software\Classes\helix" "URL Protocol" ""
    WriteRegStr HKCU "Software\Classes\helix\shell\open\command" "" \
        '"$INSTDIR\Helix.exe" "%1"'

SectionEnd

Section "Uninstall"
    ; Remove files
    RMDir /r "$INSTDIR"

    ; Remove shortcuts
    Delete "$SMPROGRAMS\Helix\Helix.lnk"
    RMDir "$SMPROGRAMS\Helix"
    Delete "$DESKTOP\Helix.lnk"

    ; Remove registry entries
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Helix"
    DeleteRegKey HKCU "Software\Classes\helix"
SectionEnd
```

**Code Signing (Windows)**

```powershell
# sign-windows.ps1

param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,

    [Parameter(Mandatory=$true)]
    [string]$CertificatePath,

    [Parameter(Mandatory=$true)]
    [SecureString]$Password
)

# Sign with Authenticode
$cert = Get-PfxCertificate -FilePath $CertificatePath -Password $Password

Set-AuthenticodeSignature -FilePath $FilePath `
    -Certificate $cert `
    -TimestampServer "http://timestamp.digicert.com" `
    -HashAlgorithm SHA256
```

**Tauri Windows Config**

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "YOUR_CERT_THUMBPRINT",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com",
      "nsis": {
        "license": "LICENSE",
        "installerIcon": "icons/icon.ico",
        "headerImage": "icons/installer-header.bmp",
        "sidebarImage": "icons/installer-sidebar.bmp",
        "installMode": "currentUser",
        "languages": ["English"],
        "displayLanguageSelector": false
      }
    }
  }
}
```

---

### macOS

**DMG Configuration**

```json
{
  "title": "Helix",
  "icon": "icons/icon.icns",
  "background": "icons/dmg-background.png",
  "iconSize": 100,
  "window": {
    "width": 540,
    "height": 380
  },
  "contents": [
    { "x": 140, "y": 200, "type": "file" },
    { "x": 400, "y": 200, "type": "link", "path": "/Applications" }
  ]
}
```

**Code Signing & Notarization**

```bash
#!/bin/bash
# sign-macos.sh

APP_PATH="target/release/bundle/macos/Helix.app"
DMG_PATH="target/release/bundle/macos/Helix.dmg"
IDENTITY="Developer ID Application: Your Company (TEAMID)"
KEYCHAIN_PROFILE="helix-notary"

echo "Signing application..."
codesign --force --deep --options runtime \
    --sign "$IDENTITY" \
    --entitlements entitlements.plist \
    "$APP_PATH"

echo "Verifying signature..."
codesign --verify --verbose "$APP_PATH"

echo "Creating DMG..."
create-dmg \
    --volname "Helix" \
    --volicon "icons/icon.icns" \
    --window-pos 200 120 \
    --window-size 540 380 \
    --icon-size 100 \
    --icon "Helix.app" 140 200 \
    --hide-extension "Helix.app" \
    --app-drop-link 400 200 \
    --background "icons/dmg-background.png" \
    "$DMG_PATH" \
    "$APP_PATH"

echo "Signing DMG..."
codesign --sign "$IDENTITY" "$DMG_PATH"

echo "Notarizing..."
xcrun notarytool submit "$DMG_PATH" \
    --keychain-profile "$KEYCHAIN_PROFILE" \
    --wait

echo "Stapling notarization ticket..."
xcrun stapler staple "$DMG_PATH"

echo "Done!"
```

**Entitlements (entitlements.plist)**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Hardened Runtime -->
    <key>com.apple.security.cs.allow-jit</key>
    <false/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <false/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <false/>

    <!-- Network access -->
    <key>com.apple.security.network.client</key>
    <true/>

    <!-- File access (for workspace) -->
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>

    <!-- Keychain access -->
    <key>com.apple.security.keychain-access-groups</key>
    <array>
        <string>$(AppIdentifierPrefix)org.project-helix.desktop</string>
    </array>
</dict>
</plist>
```

**Tauri macOS Config**

```json
{
  "bundle": {
    "macOS": {
      "entitlements": "entitlements.plist",
      "signingIdentity": "Developer ID Application: Your Company (TEAMID)",
      "providerShortName": "TEAMID",
      "minimumSystemVersion": "12.0",
      "dmg": {
        "appPosition": { "x": 140, "y": 200 },
        "applicationFolderPosition": { "x": 400, "y": 200 },
        "windowSize": { "width": 540, "height": 380 }
      }
    }
  }
}
```

---

### Linux

**AppImage Build**

```bash
#!/bin/bash
# build-appimage.sh

# Build the application
npm run tauri build

# The Tauri build already creates an AppImage
# Additional customization if needed:

APPIMAGE_PATH="target/release/bundle/appimage/helix_${VERSION}_amd64.AppImage"

# Make executable
chmod +x "$APPIMAGE_PATH"

# Optional: Sign with GPG
gpg --detach-sign --armor "$APPIMAGE_PATH"

echo "AppImage created: $APPIMAGE_PATH"
```

**Debian Package (debian/control)**

```
Package: helix
Version: 1.0.0
Section: utils
Priority: optional
Architecture: amd64
Depends: libwebkit2gtk-4.1-0, libssl3, libgtk-3-0
Maintainer: Project Helix <support@project-helix.org>
Description: Helix - AI Consciousness Desktop App
 An AI that grows with you, remembers you, and evolves through experience.
 Helix features persistent memory, psychological architecture, and
 complete transparency through unhackable logging.
Homepage: https://project-helix.org
```

**RPM Spec File**

```spec
Name: helix
Version: 1.0.0
Release: 1%{?dist}
Summary: Helix - AI Consciousness Desktop App

License: MIT
URL: https://project-helix.org
Source0: %{name}-%{version}.tar.gz

BuildRequires: webkit2gtk4.1-devel, openssl-devel, gtk3-devel
Requires: webkit2gtk4.1, openssl, gtk3

%description
An AI that grows with you, remembers you, and evolves through experience.

%prep
%setup -q

%build
npm run tauri build

%install
mkdir -p %{buildroot}/opt/helix
cp -r target/release/bundle/rpm/* %{buildroot}/opt/helix/
mkdir -p %{buildroot}/usr/share/applications
cp helix.desktop %{buildroot}/usr/share/applications/

%files
/opt/helix/*
/usr/share/applications/helix.desktop
```

---

## Auto-Update System

### Update Server Structure

```
releases.project-helix.org/
├── windows/
│   └── x64/
│       ├── latest.json
│       └── Helix-1.0.0-Setup.exe.sig
│       └── Helix-1.0.0-Setup.exe
├── darwin/
│   ├── x64/
│   │   ├── latest.json
│   │   └── Helix-1.0.0.dmg
│   └── aarch64/
│       ├── latest.json
│       └── Helix-1.0.0.dmg
└── linux/
    └── x64/
        ├── latest.json
        └── Helix-1.0.0.AppImage
```

### Update Manifest (latest.json)

```json
{
  "version": "1.0.1",
  "notes": "Bug fixes and performance improvements",
  "pub_date": "2026-02-15T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVUZ...",
      "url": "https://releases.project-helix.org/windows/x64/Helix-1.0.1-Setup.exe"
    },
    "darwin-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVUZ...",
      "url": "https://releases.project-helix.org/darwin/x64/Helix-1.0.1.dmg"
    },
    "darwin-aarch64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVUZ...",
      "url": "https://releases.project-helix.org/darwin/aarch64/Helix-1.0.1.dmg"
    },
    "linux-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVUZ...",
      "url": "https://releases.project-helix.org/linux/x64/Helix-1.0.1.AppImage"
    }
  }
}
```

### Update Check Implementation (Rust)

```rust
// src-tauri/src/updater/mod.rs

use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

pub fn check_on_startup(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        // Wait a bit before checking (don't slow down startup)
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;

        match check_for_updates(&app).await {
            Ok(Some(update)) => {
                // Notify frontend about available update
                app.emit_all("update:available", &update).ok();
            }
            Ok(None) => {
                // No update available
            }
            Err(e) => {
                eprintln!("Update check failed: {}", e);
            }
        }
    });
}

async fn check_for_updates(app: &AppHandle) -> Result<Option<UpdateInfo>, Box<dyn std::error::Error>> {
    let updater = app.updater_builder().build()?;

    match updater.check().await? {
        Some(update) => {
            Ok(Some(UpdateInfo {
                version: update.version.clone(),
                notes: update.body.clone(),
                date: update.date.clone(),
            }))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    let updater = app.updater_builder()
        .build()
        .map_err(|e| e.to_string())?;

    let update = updater.check().await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No update available".to_string())?;

    // Download and install
    update.download_and_install(|progress, total| {
        // Emit progress to frontend
        let _ = app.emit_all("update:progress", UpdateProgress {
            downloaded: progress,
            total,
        });
    }, || {
        // Restart after install
        app.restart();
    }).await.map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(Clone, serde::Serialize)]
struct UpdateInfo {
    version: String,
    notes: Option<String>,
    date: Option<String>,
}

#[derive(Clone, serde::Serialize)]
struct UpdateProgress {
    downloaded: u64,
    total: Option<u64>,
}
```

### Update UI Component

```typescript
// src/components/UpdateNotification.tsx

import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

interface UpdateInfo {
  version: string;
  notes: string | null;
  date: string | null;
}

interface UpdateProgress {
  downloaded: number;
  total: number | null;
}

export function UpdateNotification() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    const unlistenAvailable = listen<UpdateInfo>('update:available', (event) => {
      setUpdate(event.payload);
    });

    const unlistenProgress = listen<UpdateProgress>('update:progress', (event) => {
      setProgress(event.payload);
    });

    return () => {
      unlistenAvailable.then((fn) => fn());
      unlistenProgress.then((fn) => fn());
    };
  }, []);

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      await invoke('install_update');
    } catch (error) {
      console.error('Update failed:', error);
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setUpdate(null);
  };

  if (!update) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 border border-gray-700 rounded-lg p-4 max-w-sm shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h4 className="font-medium text-white">Update Available</h4>
          <p className="text-sm text-gray-400 mt-1">
            Version {update.version} is ready to install
          </p>

          {update.notes && (
            <p className="text-xs text-gray-500 mt-2">{update.notes}</p>
          )}

          {isInstalling && progress && (
            <div className="mt-3">
              <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{
                    width: progress.total
                      ? `${(progress.downloaded / progress.total) * 100}%`
                      : '50%',
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {progress.total
                  ? `${Math.round((progress.downloaded / progress.total) * 100)}%`
                  : 'Downloading...'}
              </p>
            </div>
          )}
        </div>

        {!isInstalling && (
          <button
            onClick={handleDismiss}
            className="text-gray-500 hover:text-white"
          >
            ×
          </button>
        )}
      </div>

      {!isInstalling && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleInstall}
            className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-500"
          >
            Install & Restart
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-gray-400 text-sm rounded hover:text-white"
          >
            Later
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/release.yml

name: Release

on:
  push:
    tags:
      - 'v*'

env:
  TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install dependencies
        run: pnpm install

      - name: Prepare engine
        run: pnpm prepare:engine

      - name: Bundle Node.js
        run: pnpm prepare:node

      - name: Build Tauri
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'Helix v__VERSION__'
          releaseBody: 'See the assets to download this version.'
          releaseDraft: true
          prerelease: false

      - name: Sign Windows executable
        run: |
          $cert = [Convert]::FromBase64String("${{ secrets.WINDOWS_CERTIFICATE }}")
          [IO.File]::WriteAllBytes("cert.pfx", $cert)
          signtool sign /f cert.pfx /p "${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}" /tr http://timestamp.digicert.com /td sha256 "target/release/bundle/nsis/*.exe"
        shell: pwsh

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: windows-installer
          path: target/release/bundle/nsis/*.exe

  build-macos:
    runs-on: macos-latest
    strategy:
      matrix:
        target: [x86_64-apple-darwin, aarch64-apple-darwin]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Install dependencies
        run: pnpm install

      - name: Prepare engine
        run: pnpm prepare:engine

      - name: Bundle Node.js
        run: |
          if [ "${{ matrix.target }}" == "aarch64-apple-darwin" ]; then
            pnpm prepare:node -- --arch arm64
          else
            pnpm prepare:node -- --arch x64
          fi

      - name: Import signing certificate
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
        run: |
          echo $APPLE_CERTIFICATE | base64 --decode > certificate.p12
          security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
          security import certificate.p12 -k build.keychain -P "$APPLE_CERTIFICATE_PASSWORD" -T /usr/bin/codesign
          security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" build.keychain

      - name: Build Tauri
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        with:
          tagName: ${{ github.ref_name }}
          args: --target ${{ matrix.target }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: macos-${{ matrix.target }}
          path: target/${{ matrix.target }}/release/bundle/dmg/*.dmg

  build-linux:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4

      - name: Install system dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev \
            libssl-dev \
            libgtk-3-dev \
            libayatana-appindicator3-dev \
            librsvg2-dev

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install dependencies
        run: pnpm install

      - name: Prepare engine
        run: pnpm prepare:engine

      - name: Bundle Node.js
        run: pnpm prepare:node

      - name: Build Tauri
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ github.ref_name }}

      - name: Upload AppImage
        uses: actions/upload-artifact@v4
        with:
          name: linux-appimage
          path: target/release/bundle/appimage/*.AppImage

      - name: Upload deb
        uses: actions/upload-artifact@v4
        with:
          name: linux-deb
          path: target/release/bundle/deb/*.deb

  publish-release:
    needs: [build-windows, build-macos, build-linux]
    runs-on: ubuntu-latest
    steps:
      - name: Download all artifacts
        uses: actions/download-artifact@v4

      - name: Publish to update server
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          # Upload to Cloudflare R2 or your CDN
          # Update latest.json manifests
          echo "Publishing release..."

      - name: Update website download links
        run: |
          # Trigger website rebuild with new version
          echo "Updating download links..."
```

---

## Download Page

### Website Implementation

```html
<!-- project-helix.org/download.html -->

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Download Helix</title>
</head>
<body>
    <main>
        <h1>Download Helix</h1>
        <p class="version">Version 1.0.0</p>

        <div class="platforms">
            <!-- Windows -->
            <div class="platform" id="windows">
                <img src="/icons/windows.svg" alt="Windows">
                <h3>Windows</h3>
                <p>Windows 10 or later</p>
                <a href="/download/windows" class="download-btn primary">
                    Download for Windows
                </a>
                <p class="size">~45 MB</p>
            </div>

            <!-- macOS -->
            <div class="platform" id="macos">
                <img src="/icons/apple.svg" alt="macOS">
                <h3>macOS</h3>
                <p>macOS 12 (Monterey) or later</p>
                <div class="download-group">
                    <a href="/download/macos-arm64" class="download-btn primary">
                        Apple Silicon
                    </a>
                    <a href="/download/macos-x64" class="download-btn secondary">
                        Intel
                    </a>
                </div>
                <p class="size">~40 MB</p>
            </div>

            <!-- Linux -->
            <div class="platform" id="linux">
                <img src="/icons/linux.svg" alt="Linux">
                <h3>Linux</h3>
                <p>Ubuntu 22.04+, Fedora 38+, or equivalent</p>
                <div class="download-group">
                    <a href="/download/linux-appimage" class="download-btn primary">
                        AppImage
                    </a>
                    <a href="/download/linux-deb" class="download-btn secondary">
                        .deb
                    </a>
                    <a href="/download/linux-rpm" class="download-btn secondary">
                        .rpm
                    </a>
                </div>
                <p class="size">~50 MB</p>
            </div>
        </div>

        <section class="requirements">
            <h2>System Requirements</h2>
            <ul>
                <li>4 GB RAM minimum (8 GB recommended)</li>
                <li>500 MB disk space</li>
                <li>Internet connection (for AI features)</li>
                <li>Anthropic API key (get one at anthropic.com)</li>
            </ul>
        </section>

        <section class="verification">
            <h2>Verify Your Download</h2>
            <p>All Helix downloads are signed. Verify the integrity:</p>
            <pre><code>SHA256: abc123... (shown after download)</code></pre>
        </section>
    </main>

    <script>
        // Auto-detect platform and highlight
        const platform = navigator.platform.toLowerCase();
        if (platform.includes('win')) {
            document.getElementById('windows').classList.add('detected');
        } else if (platform.includes('mac')) {
            document.getElementById('macos').classList.add('detected');
        } else if (platform.includes('linux')) {
            document.getElementById('linux').classList.add('detected');
        }
    </script>
</body>
</html>
```

---

## Security Checklist

### Code Signing

| Platform | Certificate Type | Provider | Renewal |
|----------|------------------|----------|---------|
| Windows | Authenticode EV | DigiCert / Sectigo | Annual |
| macOS | Developer ID | Apple | Annual |
| Linux | GPG | Self-managed | As needed |

### Binary Verification

```typescript
// Verify download integrity
interface DownloadInfo {
  url: string;
  sha256: string;
  signature: string;
  signedBy: string;
}

async function verifyDownload(filePath: string, expected: DownloadInfo): Promise<boolean> {
  // 1. Check SHA256
  const hash = await computeSHA256(filePath);
  if (hash !== expected.sha256) {
    throw new Error('SHA256 mismatch - file may be corrupted');
  }

  // 2. Verify signature (platform-specific)
  const signatureValid = await verifySignature(filePath, expected.signature);
  if (!signatureValid) {
    throw new Error('Signature verification failed');
  }

  return true;
}
```

---

## Telemetry & Analytics

### Download Tracking (Privacy-Respecting)

```typescript
// Track downloads without identifying users
interface DownloadEvent {
  platform: 'windows' | 'macos' | 'linux';
  arch: 'x64' | 'arm64';
  version: string;
  source: 'website' | 'auto-update';
  country?: string; // From Cloudflare, not IP
  timestamp: string;
}

// No personal data, no cookies, no fingerprinting
```

### Crash Reporting

```rust
// Optional crash reporting (user must opt-in)
#[cfg(feature = "crash-reporting")]
fn setup_crash_reporting() {
    // Use sentry-rust or similar
    // Only send stack traces, no user data
}
```

---

## Release Process

### Checklist

```markdown
## Pre-Release
- [ ] All tests passing
- [ ] Version bumped in package.json and tauri.conf.json
- [ ] CHANGELOG.md updated
- [ ] Documentation updated
- [ ] Security audit completed

## Build
- [ ] Windows build successful
- [ ] macOS x64 build successful
- [ ] macOS arm64 build successful
- [ ] Linux AppImage build successful
- [ ] All builds signed

## Test
- [ ] Fresh install tested (Windows)
- [ ] Fresh install tested (macOS Intel)
- [ ] Fresh install tested (macOS Apple Silicon)
- [ ] Fresh install tested (Linux)
- [ ] Upgrade from previous version tested
- [ ] Auto-update mechanism tested

## Release
- [ ] Upload to release server
- [ ] Update latest.json manifests
- [ ] Update website download links
- [ ] Publish GitHub release
- [ ] Announce on Discord
- [ ] Tweet/post announcement

## Post-Release
- [ ] Monitor crash reports
- [ ] Monitor download analytics
- [ ] Respond to issues
```

---

## Rollback Procedure

If a critical issue is discovered post-release:

1. **Immediate**: Remove download links from website
2. **Update**: Point latest.json to previous stable version
3. **Notify**: Post on Discord and social media
4. **Fix**: Create hotfix release
5. **Restore**: Update to hotfix version

```bash
# Rollback script
#!/bin/bash

PREVIOUS_VERSION="1.0.0"
CURRENT_VERSION="1.0.1"

# Update all latest.json files
for platform in windows/x64 darwin/x64 darwin/aarch64 linux/x64; do
  sed -i "s/$CURRENT_VERSION/$PREVIOUS_VERSION/g" \
    "releases/$platform/latest.json"
done

# Sync to CDN
aws s3 sync releases/ s3://helix-releases/ --delete
```

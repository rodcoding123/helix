# Building Helix Desktop

This document covers building Helix Desktop for development and production.

## Prerequisites

### All Platforms

- **Node.js 22+**: [nodejs.org](https://nodejs.org/)
- **Rust (latest stable)**: [rustup.rs](https://rustup.rs/)
- **Git**: [git-scm.com](https://git-scm.com/)

### Windows

- **Visual Studio Build Tools 2022** with "Desktop development with C++" workload
- **WebView2**: Usually pre-installed on Windows 10/11

```powershell
# Install via winget
winget install Microsoft.VisualStudio.2022.BuildTools
winget install Microsoft.DotNet.SDK.8
```

### macOS

- **Xcode Command Line Tools**:
  ```bash
  xcode-select --install
  ```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  curl \
  wget
```

### Linux (Fedora)

```bash
sudo dnf install -y \
  webkit2gtk4.1-devel \
  openssl-devel \
  gtk3-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel
```

---

## Project Structure

```
helix/
├── helix-desktop/     # Tauri + React frontend
│   ├── src/           # React source
│   ├── src-tauri/     # Rust backend
│   ├── scripts/       # Build scripts
│   └── installers/    # Platform installers
├── helix-engine/      # Node.js backend engine
└── ...
```

---

## Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/project-helix/helix.git
cd helix
```

### 2. Install Dependencies

```bash
# Root dependencies
npm install

# helix-engine dependencies
cd helix-engine
npm install
npm run build
cd ..

# helix-desktop dependencies
cd helix-desktop
npm install
```

### 3. Run Development Mode

```bash
# From helix-desktop/
npm run tauri:dev
```

This starts:
- Vite dev server on `localhost:1420`
- Tauri app in development mode with hot reload

---

## Building for Production

### Quick Build (Current Platform)

```bash
cd helix-desktop

# Prepare helix-engine
npm run prepare:engine -- --production

# Bundle Node.js runtime
node scripts/bundle-node.js

# Build Tauri app
npm run tauri build
```

Output location:
- **Windows**: `src-tauri/target/release/bundle/nsis/`
- **macOS**: `src-tauri/target/release/bundle/dmg/`
- **Linux**: `src-tauri/target/release/bundle/appimage/`

### Cross-Platform Builds

#### Building for All Platforms

You need to build on each target platform. CI/CD handles this automatically.

#### macOS Universal Binary

```bash
# Build for both Intel and Apple Silicon
npm run tauri build -- --target universal-apple-darwin
```

#### macOS Specific Architectures

```bash
# Apple Silicon
npm run tauri build -- --target aarch64-apple-darwin

# Intel
npm run tauri build -- --target x86_64-apple-darwin
```

---

## Build Scripts

### `scripts/build-engine.js`

Builds helix-engine for bundling with the desktop app.

```bash
# Development build
node scripts/build-engine.js

# Production build (prunes dev dependencies)
node scripts/build-engine.js --production

# Clean build
node scripts/build-engine.js --clean --production
```

### `scripts/bundle-node.js`

Downloads and bundles Node.js runtime for the target platform.

```bash
# Bundle for current platform
node scripts/bundle-node.js

# Bundle for specific platform
node scripts/bundle-node.js --platform darwin --arch arm64

# Bundle all platforms (CI use)
node scripts/bundle-node.js --all
```

---

## Package.json Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build React frontend |
| `npm run tauri:dev` | Start Tauri in dev mode |
| `npm run tauri build` | Build Tauri for production |
| `npm run prepare:engine` | Build helix-engine for bundling |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest tests |

---

## Code Signing

### Windows

1. Obtain an Authenticode EV certificate from DigiCert, Sectigo, etc.
2. Set environment variables:
   ```powershell
   $env:TAURI_SIGNING_PRIVATE_KEY = "your-private-key"
   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "your-password"
   ```
3. Configure in `tauri.conf.json`:
   ```json
   {
     "bundle": {
       "windows": {
         "certificateThumbprint": "YOUR_THUMBPRINT",
         "timestampUrl": "http://timestamp.digicert.com"
       }
     }
   }
   ```

### macOS

1. Enroll in Apple Developer Program
2. Create "Developer ID Application" certificate
3. Store credentials:
   ```bash
   xcrun notarytool store-credentials "helix-notary" \
     --apple-id "your@email.com" \
     --team-id "TEAMID" \
     --password "app-specific-password"
   ```
4. Configure in `tauri.conf.json`:
   ```json
   {
     "bundle": {
       "macOS": {
         "signingIdentity": "Developer ID Application: Your Name (TEAMID)",
         "entitlements": "entitlements.plist"
       }
     }
   }
   ```

### Linux

Sign with GPG (optional):
```bash
gpg --detach-sign --armor Helix.AppImage
```

---

## CI/CD

GitHub Actions workflows handle automated builds:

- **`.github/workflows/build.yml`**: Runs on push to main and PRs
- **`.github/workflows/release.yml`**: Runs on version tags (v*)

### Creating a Release

1. Update version in:
   - `helix-desktop/package.json`
   - `helix-desktop/src-tauri/tauri.conf.json`
   - `helix-engine/package.json`

2. Commit and tag:
   ```bash
   git add .
   git commit -m "Release v1.0.0"
   git tag v1.0.0
   git push origin main --tags
   ```

3. GitHub Actions will:
   - Build for Windows, macOS (Intel + ARM), Linux
   - Create a draft release with all installers
   - Publish when builds complete

---

## Troubleshooting

### Windows: WebView2 not found

Install WebView2 Runtime from [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

### macOS: Code signing errors

```bash
# Check available identities
security find-identity -v -p codesigning

# Reset keychain if needed
security delete-keychain build.keychain
```

### Linux: WebKit not found

```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel
```

### Build fails with "out of memory"

Increase Node.js memory:
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
```

### Rust compilation slow

Enable incremental compilation:
```bash
export CARGO_INCREMENTAL=1
```

---

## Bundle Size

Approximate sizes:
- **Windows installer**: ~50 MB
- **macOS DMG**: ~45 MB
- **Linux AppImage**: ~55 MB

To reduce size:
1. Use `--production` flag when building engine
2. Enable Rust optimizations in `Cargo.toml`:
   ```toml
   [profile.release]
   lto = true
   codegen-units = 1
   strip = true
   ```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri update signing key |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Signing key password |
| `APPLE_SIGNING_IDENTITY` | macOS signing identity |
| `APPLE_ID` | Apple ID for notarization |
| `APPLE_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

---

## Resources

- [Tauri Documentation](https://tauri.app/v1/guides/)
- [Tauri GitHub Actions](https://github.com/tauri-apps/tauri-action)
- [NSIS Documentation](https://nsis.sourceforge.io/Docs/)
- [Apple Notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

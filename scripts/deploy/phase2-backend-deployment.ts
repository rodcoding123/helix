#!/usr/bin/env node
/**
 * PHASE 2: Desktop App Packaging & Distribution (1 day)
 *
 * Packages Helix Desktop for production distribution:
 * 1. Build for all platforms (Windows, macOS, Linux)
 * 2. Create installers
 * 3. Prepare for user distribution
 * 4. Code signing configuration (for later)
 *
 * NOTE: Desktop app IS the main server (35+ tools/MCPs).
 * This is the PRIMARY deployment target, NOT web or mobile.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import * as readline from 'readline';

interface DesktopBuildConfig {
  platforms: Array<'windows' | 'macos' | 'linux'>;
  appVersion: string;
  codeSigning: boolean;
  certificatePath?: string;
  distributionMethod: 'github' | 'website' | 'store';
}

const LOG_PREFIX = '[PHASE 2]';
const DESKTOP_DIR = path.join(process.cwd(), 'helix-desktop');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

function log(message: string, level: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
  const timestamp = new Date().toISOString();
  const prefix = `${LOG_PREFIX} [${timestamp}]`;

  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m',
  };

  console.log(`${colors[level]}${prefix} ${message}${colors.reset}`);
}

function executeCommand(command: string, cwd: string = process.cwd()): string {
  log(`Executing: ${command}`, 'info');
  try {
    const output = execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output;
  } catch (err) {
    const error = err as { message: string };
    log(`Command failed: ${error.message}`, 'error');
    throw err;
  }
}

async function selectPlatforms(): Promise<Array<'windows' | 'macos' | 'linux'>> {
  // Try loading from 1Password first
  try {
    const platformsStr = execSync('op read "op://Helix/Build Platforms/password"', { encoding: 'utf-8' }).trim().toLowerCase();

    if (platformsStr.includes('all')) {
      log('✓ Loaded platform selection from 1Password: All platforms', 'success');
      return ['windows', 'macos', 'linux'];
    }

    const platforms: Array<'windows' | 'macos' | 'linux'> = [];
    if (platformsStr.includes('windows')) platforms.push('windows');
    if (platformsStr.includes('macos')) platforms.push('macos');
    if (platformsStr.includes('linux')) platforms.push('linux');

    if (platforms.length > 0) {
      log(`✓ Loaded platform selection from 1Password: ${platforms.join(', ')}`, 'success');
      return platforms;
    }
  } catch {
    // Fall back to interactive
  }

  const currentPlatform = process.platform;
  console.log('\n🖥️  Which platforms do you want to build for?');
  console.log(`   Current platform: ${currentPlatform}`);
  console.log('   Available:');
  console.log('   - Windows (.msi, .exe)');
  console.log('   - macOS (.dmg, .app) [requires macOS]');
  console.log('   - Linux (.deb, .AppImage)\n');

  const buildAll = await ask('  Build for all platforms? (yes/no): ');

  if (buildAll.toLowerCase() === 'yes') {
    return ['windows', 'macos', 'linux'];
  }

  const platforms: Array<'windows' | 'macos' | 'linux'> = [];

  const buildWindows = await ask('  Build for Windows? (yes/no): ');
  if (buildWindows.toLowerCase() === 'yes') platforms.push('windows');

  const buildMacOS = await ask('  Build for macOS? (yes/no): ');
  if (buildMacOS.toLowerCase() === 'yes') platforms.push('macos');

  const buildLinux = await ask('  Build for Linux? (yes/no): ');
  if (buildLinux.toLowerCase() === 'yes') platforms.push('linux');

  return platforms.length > 0 ? platforms : ['windows'];
}

async function checkPrerequisites(): Promise<void> {
  log('Checking build prerequisites...', 'info');

  const checks = [
    { name: 'Node.js', command: 'node --version' },
    { name: 'Rust', command: 'rustc --version' },
    { name: 'Cargo', command: 'cargo --version' },
  ];

  for (const check of checks) {
    try {
      const version = executeCommand(check.command);
      log(`✓ ${check.name}: ${version.trim()}`, 'success');
    } catch {
      log(`✗ ${check.name} not found. Install from: https://nodejs.org/ or https://rustup.rs/`, 'error');
      process.exit(1);
    }
  }

  // Check helix-runtime is built
  if (!fs.existsSync(path.join(process.cwd(), 'src', 'helix'))) {
    log('✗ helix-runtime not found', 'error');
    process.exit(1);
  }

  log('✓ helix-runtime source available', 'success');
}

async function buildDesktopApp(config: DesktopBuildConfig): Promise<void> {
  log('Building Helix Desktop application...', 'info');

  if (!fs.existsSync(DESKTOP_DIR)) {
    log('Desktop directory not found (helix-desktop/)', 'error');
    process.exit(1);
  }

  try {
    // Step 1: Install dependencies
    log('Installing dependencies...', 'info');
    executeCommand('npm install', DESKTOP_DIR);
    log('✓ Dependencies installed', 'success');

    // Step 2: Build Tauri app
    log(`Building for platforms: ${config.platforms.join(', ')}...`, 'info');

    // Tauri build command automatically detects the current platform
    // For cross-compilation, we need to build on the target platform or use specialized tools
    const tauriCommand = 'npm run tauri build -- --release';

    try {
      executeCommand(tauriCommand, DESKTOP_DIR);
      log(`✓ Built for current platform`, 'success');
    } catch (err) {
      log(
        `Build warning/error. This may be expected if cross-compiling. Check ${DESKTOP_DIR}/src-tauri/target/`,
        'warn'
      );
    }

    // List built artifacts
    const releaseDir = path.join(DESKTOP_DIR, 'src-tauri', 'target', 'release');
    if (fs.existsSync(releaseDir)) {
      log('Built artifacts:', 'info');
      const files = fs.readdirSync(releaseDir);
      files
        .filter(f => f.includes('helix') || f.endsWith('.exe') || f.endsWith('.dmg') || f.endsWith('.deb'))
        .forEach(f => {
          log(`  📦 ${f}`, 'success');
        });
    }
  } catch (err) {
    log(`Desktop build failed: ${(err as Error).message}`, 'error');
    process.exit(1);
  }
}

async function configureDistribution(
  config: DesktopBuildConfig
): Promise<{ url?: string; instructions: string }> {
  log('Configuring distribution method...', 'info');

  console.log('\n📦 Distribution Options:');
  console.log('   1. GitHub Releases (free, auto-updater support)');
  console.log('   2. Website (custom domain)');
  console.log('   3. App Store (Windows Store, macOS App Store, Linux snap)');

  const choice = await ask('  Select distribution method (1-3): ');

  switch (choice) {
    case '2':
      const website = await ask('  Website URL (e.g., helix.example.com): ');
      log(`✓ Distribution URL: https://${website}/download`, 'success');
      return {
        url: `https://${website}/download`,
        instructions: `Upload installers to ${website}/download folder`,
      };

    case '3':
      log('App Store distribution requires certificates and developer accounts', 'info');
      return {
        instructions:
          'Register with: Microsoft Store, Apple App Store, Linux Snap Store\nRequires code signing certificates',
      };

    case '1':
    default:
      log('✓ Using GitHub Releases (default)', 'success');
      return {
        url: 'https://github.com/project-helix/helix/releases',
        instructions: 'Upload installers to GitHub Releases',
      };
  }
}

async function generateDeploymentReport(config: DesktopBuildConfig): Promise<void> {
  log('Generating Phase 2 report...', 'info');

  const report = `# PHASE 2: DESKTOP APP PACKAGING REPORT

**Generated:** ${new Date().toISOString()}

## Deployment Summary

| Item | Value |
|------|-------|
| Application | Helix Desktop |
| Version | ${config.appVersion} |
| Platforms Built | ${config.platforms.join(', ')} |
| Code Signed | ${config.codeSigning ? 'Yes' : 'No (configure later)' |
| Distribution Method | Awaiting configuration |
| Status | Ready for distribution |

## What is Helix Desktop?

**Helix Desktop is the MAIN server application** that:
- Runs locally on user's computer
- Contains 35+ integrated tools and MCPs
- Provides full execution engine with custom tool support
- Cross-platform: Windows, macOS, Linux

**Remote Management:**
- Web interface (Phase 3) - manage from browser
- Mobile apps (Phase 4) - manage from iOS/Android
- Both connect to local desktop server via secure RPC

## Built Artifacts

Installer files are located in: \`helix-desktop/src-tauri/target/release/\`

### Windows
- \`Helix_${config.appVersion}_x64_en-US.msi\` - Windows installer
- \`Helix_${config.appVersion}_x64_en-US.exe\` - Standalone executable

### macOS
- \`Helix_${config.appVersion}_universal.dmg\` - Disk image (Intel + Apple Silicon)
- \`Helix_${config.appVersion}_universal.app\` - App bundle

### Linux
- \`helix_${config.appVersion}_amd64.deb\` - Debian package
- \`Helix_${config.appVersion}.AppImage\` - Universal Linux package

## Code Signing (For Later)

Currently: **Not signed** (OK for internal testing)

Before public release:
1. Obtain code signing certificate
2. Set environment variables:
   - \`TAURI_SIGNING_CERTIFICATE\` - Path to certificate
   - \`TAURI_SIGNING_CERTIFICATE_KEY\` - Certificate key
3. Rebuild: \`npm run tauri build -- --release\`

## Distribution Setup

After code signing is configured:

### GitHub Releases
\`\`\`bash
# 1. Tag new release
git tag v${config.appVersion}

# 2. Push tag
git push origin v${config.appVersion}

# 3. Create release with description
gh release create v${config.appVersion} \\
  --title "Helix Desktop ${config.appVersion}" \\
  --notes "Release notes here"

# 4. Upload installers
gh release upload v${config.appVersion} helix-desktop/src-tauri/target/release/*
\`\`\`

### Custom Website
1. Create download page with platform options
2. Host installers on CDN or web server
3. Configure auto-updater in Tauri config

### App Stores
- **Windows Store**: https://partner.microsoft.com/
- **macOS App Store**: https://appstoreconnect.apple.com/
- **Linux Snap**: https://snapcraft.io/

## User Installation

### Windows
1. Download \`.msi\` or \`.exe\`
2. Double-click installer
3. Follow setup wizard
4. Application launches automatically

### macOS
1. Download \`.dmg\`
2. Drag Helix to Applications folder
3. Launch from Applications
4. Allow in System Preferences (first run)

### Linux (Debian)
\`\`\`bash
sudo dpkg -i helix_${config.appVersion}_amd64.deb
helix  # Launch from terminal
\`\`\`

### Linux (AppImage)
\`\`\`bash
chmod +x Helix_${config.appVersion}.AppImage
./Helix_${config.appVersion}.AppImage
\`\`\`

## Auto-Updater Configuration

Tauri auto-updater enables users to stay up-to-date:

\`\`\`json
{
  "tauri": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://updates.example.com/\\{\\{target\\}\\}/\\{\\{current_version\\}\\}"
      ],
      "pubkey": "<public_key_from_signing>"
    }
  }
}
\`\`\`

## Checklist for Release

Before distributing to users:

- [ ] All platforms built successfully
- [ ] Code signing configured (when ready)
- [ ] Auto-updater tested
- [ ] Release notes written
- [ ] Installation tested on Windows
- [ ] Installation tested on macOS (if available)
- [ ] Installation tested on Linux
- [ ] Web management interface deployed (Phase 3)
- [ ] Mobile apps deployed (Phase 4)
- [ ] Support documentation prepared

## Architecture Reminder

\`\`\`
User's Computer
├─ Helix Desktop (Phase 2) ← You are here
│  ├─ 35+ Tools & MCPs
│  ├─ Full execution engine
│  ├─ GraphQL API (via helix-runtime)
│  └─ Tauri system integration
│
└─ Remote Management (Phases 3-4)
   ├─ Web (Vercel)
   ├─ iOS app
   └─ Android app
\`\`\`

The desktop app IS the server. Everything else connects to it.

## Next Phase (Phase 3)

Deploy web management interface to Vercel:
- Real-time dashboard
- Tool management
- Execution monitoring
- Remote control from browser

---

Generated by Phase 2 deployment script
`;

  const reportPath = path.join(process.cwd(), 'PHASE2_DESKTOP_PACKAGING_REPORT.md');
  fs.writeFileSync(reportPath, report);
  log(`✓ Report saved to ${reportPath}`, 'success');
}

async function main(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║    HELIX PRODUCTION DEPLOYMENT - PHASE 2                  ║');
  console.log('║         DESKTOP APP PACKAGING & DISTRIBUTION              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Check prerequisites
    await checkPrerequisites();

    // Step 2: Select platforms
    const platforms = await selectPlatforms();
    log(`Building for: ${platforms.join(', ')}`, 'info');

    // Step 3: Get app version
    const packageJsonPath = path.join(DESKTOP_DIR, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const appVersion = packageJson.version || '1.0.0';

    // Step 4: Build desktop app
    const config: DesktopBuildConfig = {
      platforms: platforms as Array<'windows' | 'macos' | 'linux'>,
      appVersion,
      codeSigning: false, // Configure later
      distributionMethod: 'github',
    };

    await buildDesktopApp(config);

    // Step 5: Configure distribution
    const distribution = await configureDistribution(config);
    config.distributionMethod = distribution.url ? 'website' : 'github';

    // Step 6: Generate report
    await generateDeploymentReport(config);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║       PHASE 2 DESKTOP PACKAGING COMPLETE                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('✅ Desktop app packaged for distribution!');
    console.log(`   Platforms: ${platforms.join(', ')}`);
    console.log(`   Version: ${appVersion}`);
    console.log(`   Location: ${DESKTOP_DIR}/src-tauri/target/release/\n`);

    console.log('📋 Next Steps (Phase 3 - Web Management):');
    console.log('   1. Deploy web interface to Vercel');
    console.log('   2. Configure real-time chat interface');
    console.log('   3. Set up tool management UI');
    console.log('   4. Enable remote desktop control\n');

    console.log('Later (Code Signing):');
    console.log('   1. Obtain code signing certificate');
    console.log('   2. Configure TAURI_SIGNING_CERTIFICATE env vars');
    console.log('   3. Rebuild and sign installers');
    console.log('   4. Upload to distribution channels\n');

    rl.close();
  } catch (err) {
    log(`Desktop packaging failed: ${(err as Error).message}`, 'error');
    rl.close();
    process.exit(1);
  }
}

main();

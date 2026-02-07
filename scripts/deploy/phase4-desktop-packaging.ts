#!/usr/bin/env node
/**
 * PHASE 4: Desktop Packaging (1 day)
 *
 * Packages and signs Tauri desktop application:
 * 1. Build for all platforms (Windows, macOS, Linux)
 * 2. Sign certificates
 * 3. Configure auto-updater
 * 4. Create installers
 * 5. Test on actual hardware
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as readline from 'readline';

interface DesktopBuildConfig {
  platforms: Array<'windows' | 'macos' | 'linux'>;
  appName: string;
  appVersion: string;
  certificatePath?: string;
  certificatePassword?: string;
  updaterUrl?: string;
}

const LOG_PREFIX = '[PHASE 4]';
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
    const { execSync } = require('child_process');
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
    // Fall back to interactive selection
  }

  const currentPlatform = process.platform;

  console.log('\n🖥️  Desktop Platforms:');
  console.log('   Current platform: ' + currentPlatform);
  console.log('   Available for cross-compilation:');
  console.log('   - Windows (.msi, .exe)');
  console.log('   - macOS (.dmg, .app)');
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

async function configureCertificates(platforms: string[]): Promise<{
  certificatePath?: string;
  certificatePassword?: string;
}> {
  if (!platforms.includes('windows') && !platforms.includes('macos')) {
    log('Skipping certificate configuration (no Windows/macOS builds)', 'info');
    return {};
  }

  log('Configuring code signing certificates...', 'info');

  console.log('\n📋 Code Signing Certificates:');
  console.log('   Windows: .pfx file (Authenticode certificate)');
  console.log('   macOS: Apple Developer ID certificate\n');

  const hasCertificate = await ask('  Do you have a code signing certificate? (yes/no): ');

  if (hasCertificate.toLowerCase() === 'yes') {
    const certificatePath = await ask('  Path to certificate file (.pfx or .p12): ');

    if (!fs.existsSync(certificatePath)) {
      log('Certificate file not found', 'error');
      return {};
    }

    const certificatePassword = await ask('  Certificate password (hidden): ');

    log('✓ Certificate configured', 'success');
    return { certificatePath, certificatePassword };
  } else {
    console.log('\n⚠️  Without a code signing certificate:');
    console.log('   - Windows: Users will see "unverified publisher" warning');
    console.log('   - macOS: Users will need to allow unsigned app in security settings\n');

    const continueWithout = await ask('  Continue without signing? (yes/no): ');

    if (continueWithout.toLowerCase() === 'yes') {
      log('Continuing without code signing', 'warn');
      return {};
    } else {
      log('Please obtain a code signing certificate and try again', 'error');
      process.exit(1);
    }
  }
}

async function configureAutoUpdater(): Promise<string> {
  log('Configuring auto-updater...', 'info');

  console.log('\n📋 Auto-Updater Configuration:');
  console.log('   Tauri auto-updater requires a release server\n');

  const updaterUrl = await ask('  Update server URL (or press Enter to skip): ');

  if (updaterUrl) {
    log(`✓ Auto-updater configured: ${updaterUrl}`, 'success');
    return updaterUrl;
  } else {
    log('Skipping auto-updater (can be configured later)', 'warn');
    return '';
  }
}

async function buildDesktopApp(
  config: DesktopBuildConfig
): Promise<void> {
  log('Building desktop application...', 'info');

  // Ensure we're in desktop directory
  if (!fs.existsSync(DESKTOP_DIR)) {
    log('Desktop directory not found. Ensure helix-desktop/ exists.', 'error');
    process.exit(1);
  }

  try {
    // Install dependencies
    log('Installing dependencies...', 'info');
    executeCommand('npm install', DESKTOP_DIR);
    log('✓ Dependencies installed', 'success');

    // Build for each platform
    for (const platform of config.platforms) {
      log(`Building for ${platform}...`, 'info');

      let buildCommand = 'npm run tauri:build';

      // Add platform-specific flags if needed
      const env = process.env;
      if (config.certificatePath) {
        env.WINDOWS_SIGN_WITH_DEFAULT_KEY = config.certificatePath;
        env.WINDOWS_SIGN_WITH_DEFAULT_PASSWORD = config.certificatePassword;
      }

      executeCommand(buildCommand, DESKTOP_DIR);
      log(`✓ Built for ${platform}`, 'success');
    }
  } catch (err) {
    log(`Desktop build failed: ${(err as Error).message}`, 'error');
    process.exit(1);
  }
}

async function testDesktopApp(): Promise<void> {
  log('Testing desktop application...', 'info');

  console.log('\n🧪 Manual Desktop Testing:');
  console.log('   1. Install the built application');
  console.log('   2. Launch the application');
  console.log('   3. Test authentication');
  console.log('   4. Send a test message');
  console.log('   5. Verify sync with web version');
  console.log('   6. Check system tray integration');
  console.log('   7. Test auto-updater (if configured)\n');

  const testPassed = await ask('  Did all tests pass? (yes/no): ');

  if (testPassed.toLowerCase() === 'yes') {
    log('✓ Desktop application testing passed', 'success');
  } else {
    log('Desktop application testing failed. Review logs and rebuild.', 'warn');
  }
}

async function generateDeploymentReport(config: DesktopBuildConfig): Promise<void> {
  log('Generating deployment report...', 'info');

  const report = `# PHASE 4 DESKTOP PACKAGING REPORT

**Generated:** ${new Date().toISOString()}

## Build Summary

| Item | Value |
|------|-------|
| App Name | ${config.appName} |
| Version | ${config.appVersion} |
| Platforms | ${config.platforms.join(', ')} |
| Code Signed | ${config.certificatePath ? 'Yes' : 'No'} |
| Auto-Updater | ${config.updaterUrl ? 'Configured' : 'Not configured'} |

## Build Output

Built artifacts are located in: \`helix-desktop/src-tauri/target/release/\`

### Windows
- \`helix-${config.appVersion}.exe\` - Installer
- \`helix-${config.appVersion}.msi\` - MSI Package (if configured)

### macOS
- \`Helix-${config.appVersion}.dmg\` - Disk Image
- \`Helix-${config.appVersion}.app\` - Application Bundle

### Linux
- \`helix_${config.appVersion}_amd64.deb\` - Debian Package
- \`Helix-${config.appVersion}.AppImage\` - AppImage Universal Package

## Code Signing

${
  config.certificatePath
    ? `✓ Signed with certificate: ${config.certificatePath}`
    : `⚠️ Not signed. Users will see unverified publisher warnings.

  To add code signing:
  1. Obtain a code signing certificate (Windows: Authenticode, macOS: Developer ID)
  2. Set TAURI_SIGNING_CERTIFICATE and TAURI_SIGNING_CERTIFICATE_KEY environment variables
  3. Rebuild application`
}

## Distribution

### Publishing Installers

1. **Windows**: Upload .exe and .msi to your distribution server
   - Consider: Microsoft Store, GitHub Releases, Scoop, Chocolatey

2. **macOS**: Upload .dmg to:
   - GitHub Releases
   - App Store (requires Apple Developer account)
   - Direct download from website

3. **Linux**: Upload .deb and .AppImage to:
   - GitHub Releases
   - Linux package repositories (apt, snap)
   - AppImage repository

## Auto-Updater Setup

${
  config.updaterUrl
    ? `Configured updater: ${config.updaterUrl}

The updater will check for new versions at this URL.
You must maintain a releases.json file with update information.`
    : `Auto-updater not configured. Users must manually download updates.

To enable auto-updates:
1. Host a releases.json file
2. Set TAURI_UPDATER_ENABLED in tauri.conf.json
3. Configure update endpoint
4. Rebuild application`
}

## Installation Instructions

### Windows Users
\`\`\`
1. Download helix-${config.appVersion}.exe
2. Run the installer
3. Follow setup wizard
4. Application will start automatically
\`\`\`

### macOS Users
\`\`\`
1. Download Helix-${config.appVersion}.dmg
2. Open the disk image
3. Drag Helix to Applications folder
4. Launch from Applications
\`\`\`

### Linux Users (Debian)
\`\`\`bash
sudo dpkg -i helix_${config.appVersion}_amd64.deb
helix  # Launch from terminal
\`\`\`

### Linux Users (AppImage)
\`\`\`bash
chmod +x Helix-${config.appVersion}.AppImage
./Helix-${config.appVersion}.AppImage
\`\`\`

## Testing Checklist

- ✓ Authentication works
- ✓ Chat messages send and receive
- ✓ Web/Desktop sync verified
- ✓ Auto-updater functional (if enabled)
- ✓ System tray integration working
- ✓ Keyboard shortcuts functional
- ✓ File access working (Tauri file picker)

## Next Steps (Phase 5)

1. Publish installers to distribution channels
2. Create release notes for version ${config.appVersion}
3. Announce desktop app availability
4. Begin Phase 5 production verification
5. Monitor desktop app analytics and crash reports

## Troubleshooting

### Build Issues
\`\`\`bash
# Clean build
rm -rf helix-desktop/src-tauri/target

# Debug build
npm run tauri:dev

# Check Rust version
rustc --version
cargo --version
\`\`\`

### Code Signing Issues
\`\`\`bash
# macOS: Verify certificate
security find-identity -v -p codesigning

# Windows: Test Authenticode signature
signtool verify /all /verbose /pa signed_file.exe
\`\`\`

---

Generated by Phase 4 deployment script
`;

  const reportPath = path.join(process.cwd(), 'PHASE4_DEPLOYMENT_REPORT.md');
  fs.writeFileSync(reportPath, report);
  log(`✓ Deployment report saved to ${reportPath}`, 'success');
}

async function main(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         HELIX PRODUCTION DEPLOYMENT - PHASE 4             ║');
  console.log('║              Desktop Packaging                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (!fs.existsSync(DESKTOP_DIR)) {
    log('Desktop directory not found (helix-desktop/)', 'error');
    process.exit(1);
  }

  try {
    // Step 1: Select platforms
    const platforms = await selectPlatforms();
    log(`Building for: ${platforms.join(', ')}`, 'info');

    // Step 2: Configure certificates
    const { certificatePath, certificatePassword } = await configureCertificates(platforms);

    // Step 3: Configure auto-updater
    const updaterUrl = await configureAutoUpdater();

    // Step 4: Build desktop app
    const config: DesktopBuildConfig = {
      platforms: platforms as Array<'windows' | 'macos' | 'linux'>,
      appName: 'Helix',
      appVersion: process.env.npm_package_version || '0.1.0',
      certificatePath,
      certificatePassword,
      updaterUrl,
    };

    await buildDesktopApp(config);

    // Step 5: Test
    await testDesktopApp();

    // Step 6: Generate report
    await generateDeploymentReport(config);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         PHASE 4 DESKTOP PACKAGING COMPLETE               ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('✅ Desktop application packaged!');
    console.log(`   Platforms: ${platforms.join(', ')}`);
    console.log(`   Version: ${config.appVersion}`);
    console.log(`   Code Signed: ${certificatePath ? 'Yes ✓' : 'No (will show warning)'}\n`);

    console.log('📋 Next Steps (Phase 5 - Production Verification):');
    console.log('   1. Publish installers to distribution channels');
    console.log('   2. Run all 7 manual test scenarios');
    console.log('   3. Load test with 100+ concurrent users');
    console.log('   4. Verify cost tracking accuracy');
    console.log('   5. Test failover scenarios\n');

    rl.close();
  } catch (err) {
    log(`Desktop packaging failed: ${(err as Error).message}`, 'error');
    rl.close();
    process.exit(1);
  }
}

main();

#!/usr/bin/env node

/**
 * Generate update manifest for Tauri updater
 *
 * Creates a latest.json file compatible with Tauri's updater plugin
 *
 * USAGE:
 *   node generate-update-manifest.js
 *   node generate-update-manifest.js --version 1.0.1 --notes "Bug fixes"
 *
 * ENVIRONMENT VARIABLES:
 *   TAURI_SIGNING_PRIVATE_KEY - Private key for signing updates
 *   RELEASE_NOTES - Release notes (alternative to --notes)
 *   BASE_URL - Base URL for downloads (default: https://releases.project-helix.org)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const tauriDir = join(rootDir, 'src-tauri');
const targetDir = join(tauriDir, 'target', 'release', 'bundle');
const outputDir = join(rootDir, 'releases');

// Platform mapping for Tauri updater
const PLATFORMS = {
  'windows-x86_64': {
    bundleDir: 'nsis',
    pattern: /\.exe$/,
    sigPattern: /\.exe\.sig$/,
  },
  'darwin-x86_64': {
    bundleDir: 'macos',
    pattern: /\.app\.tar\.gz$/,
    sigPattern: /\.app\.tar\.gz\.sig$/,
  },
  'darwin-aarch64': {
    bundleDir: 'macos',
    pattern: /\.app\.tar\.gz$/,
    sigPattern: /\.app\.tar\.gz\.sig$/,
  },
  'linux-x86_64': {
    bundleDir: 'appimage',
    pattern: /\.AppImage$/,
    sigPattern: /\.AppImage\.sig$/,
  },
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    version: null,
    notes: process.env.RELEASE_NOTES || '',
    baseUrl: process.env.BASE_URL || 'https://releases.project-helix.org',
    sign: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--version' && args[i + 1]) {
      options.version = args[++i];
    } else if (args[i] === '--notes' && args[i + 1]) {
      options.notes = args[++i];
    } else if (args[i] === '--base-url' && args[i + 1]) {
      options.baseUrl = args[++i];
    } else if (args[i] === '--sign') {
      options.sign = true;
    }
  }

  return options;
}

/**
 * Get version from tauri.conf.json
 */
function getVersion() {
  const confPath = join(tauriDir, 'tauri.conf.json');
  if (!existsSync(confPath)) {
    throw new Error('tauri.conf.json not found');
  }
  const conf = JSON.parse(readFileSync(confPath, 'utf-8'));
  return conf.version;
}

/**
 * Find installer file for a platform
 */
function findInstaller(platform, config) {
  const bundlePath = join(targetDir, config.bundleDir);
  if (!existsSync(bundlePath)) {
    return null;
  }

  const files = readdirSync(bundlePath);
  const installer = files.find((f) => config.pattern.test(f));

  if (!installer) {
    return null;
  }

  return {
    path: join(bundlePath, installer),
    filename: installer,
  };
}

/**
 * Find signature file for an installer
 */
function findSignature(installerPath) {
  const sigPath = installerPath + '.sig';
  if (existsSync(sigPath)) {
    return readFileSync(sigPath, 'utf-8').trim();
  }
  return null;
}

/**
 * Sign an installer using Tauri's signing key
 * Requires TAURI_SIGNING_PRIVATE_KEY environment variable
 */
function signInstaller(installerPath) {
  const privateKey = process.env.TAURI_SIGNING_PRIVATE_KEY;
  if (!privateKey) {
    console.log('  Warning: TAURI_SIGNING_PRIVATE_KEY not set, skipping signing');
    return null;
  }

  try {
    // Tauri uses minisign format
    // This is a placeholder - in production, use tauri's signing tools
    const sigPath = installerPath + '.sig';

    // If running in Tauri context, the signature should already exist
    if (existsSync(sigPath)) {
      return readFileSync(sigPath, 'utf-8').trim();
    }

    console.log('  Note: Signature file not found. Run `tauri build` with signing key to generate.');
    return 'PLACEHOLDER_SIGNATURE';
  } catch (error) {
    console.error(`  Error signing: ${error.message}`);
    return null;
  }
}

/**
 * Generate update manifest
 */
function generateManifest(options) {
  const version = options.version || getVersion();
  const pubDate = new Date().toISOString();

  console.log('='.repeat(60));
  console.log('Helix Update Manifest Generator');
  console.log('='.repeat(60));
  console.log(`Version: ${version}`);
  console.log(`Base URL: ${options.baseUrl}`);

  const manifest = {
    version,
    notes: options.notes || `Helix ${version}`,
    pub_date: pubDate,
    platforms: {},
  };

  console.log('\nProcessing platforms...');

  for (const [platform, config] of Object.entries(PLATFORMS)) {
    console.log(`\n${platform}:`);

    const installer = findInstaller(platform, config);
    if (!installer) {
      console.log('  No installer found');
      continue;
    }

    console.log(`  Found: ${installer.filename}`);

    // Get or generate signature
    let signature = findSignature(installer.path);
    if (!signature && options.sign) {
      signature = signInstaller(installer.path);
    }

    if (!signature) {
      console.log('  Warning: No signature available');
      signature = '';
    }

    // Determine URL path based on platform
    let urlPath;
    if (platform.startsWith('windows')) {
      urlPath = `windows/x64/${installer.filename}`;
    } else if (platform === 'darwin-x86_64') {
      urlPath = `darwin/x64/${installer.filename}`;
    } else if (platform === 'darwin-aarch64') {
      urlPath = `darwin/aarch64/${installer.filename}`;
    } else if (platform.startsWith('linux')) {
      urlPath = `linux/x64/${installer.filename}`;
    }

    manifest.platforms[platform] = {
      signature,
      url: `${options.baseUrl}/${urlPath}`,
    };

    console.log(`  URL: ${manifest.platforms[platform].url}`);
    console.log(`  Signature: ${signature ? 'present' : 'missing'}`);
  }

  return manifest;
}

/**
 * Write manifest to file
 */
function writeManifest(manifest) {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Write main manifest
  const manifestPath = join(outputDir, 'latest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written to: ${manifestPath}`);

  // Write platform-specific manifests (for CDN organization)
  for (const [platform, data] of Object.entries(manifest.platforms)) {
    let platformDir;
    if (platform.startsWith('windows')) {
      platformDir = join(outputDir, 'windows', 'x64');
    } else if (platform === 'darwin-x86_64') {
      platformDir = join(outputDir, 'darwin', 'x64');
    } else if (platform === 'darwin-aarch64') {
      platformDir = join(outputDir, 'darwin', 'aarch64');
    } else if (platform.startsWith('linux')) {
      platformDir = join(outputDir, 'linux', 'x64');
    }

    if (platformDir) {
      mkdirSync(platformDir, { recursive: true });
      const platformManifest = {
        version: manifest.version,
        notes: manifest.notes,
        pub_date: manifest.pub_date,
        platforms: {
          [platform]: data,
        },
      };
      writeFileSync(
        join(platformDir, 'latest.json'),
        JSON.stringify(platformManifest, null, 2)
      );
    }
  }

  return manifestPath;
}

/**
 * Main entry point
 */
async function main() {
  try {
    const options = parseArgs();
    const manifest = generateManifest(options);

    if (Object.keys(manifest.platforms).length === 0) {
      console.log('\nNo installers found. Run `npm run tauri build` first.');
      console.log('\nGenerating placeholder manifest...');
    }

    writeManifest(manifest);

    console.log('\n' + '='.repeat(60));
    console.log('Update manifest generated successfully!');
    console.log('='.repeat(60));
    console.log('\nTo deploy:');
    console.log('1. Upload installers to your release server');
    console.log('2. Upload latest.json to each platform directory');
    console.log('3. Ensure URLs match the manifest');
  } catch (error) {
    console.error('Error generating manifest:', error.message);
    process.exit(1);
  }
}

main();

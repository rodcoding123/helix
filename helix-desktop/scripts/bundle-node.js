#!/usr/bin/env node

/**
 * Bundle Node.js runtime for each platform
 * Downloads Node.js LTS binaries and extracts them to resources/node/{platform}/
 */

import { createWriteStream, existsSync, mkdirSync, rmSync, chmodSync, cpSync, createReadStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { extract } from 'tar';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const resourcesDir = join(rootDir, 'src-tauri', 'resources', 'node');

// Node.js LTS version to bundle
const NODE_VERSION = '22.13.1';

// Platform configurations
const PLATFORMS = {
  'win-x64': {
    url: `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip`,
    archive: 'zip',
    extractDir: `node-v${NODE_VERSION}-win-x64`,
    executable: 'node.exe',
  },
  'darwin-x64': {
    url: `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-x64.tar.gz`,
    archive: 'tar.gz',
    extractDir: `node-v${NODE_VERSION}-darwin-x64`,
    executable: 'node',
  },
  'darwin-arm64': {
    url: `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-arm64.tar.gz`,
    archive: 'tar.gz',
    extractDir: `node-v${NODE_VERSION}-darwin-arm64`,
    executable: 'node',
  },
  'linux-x64': {
    url: `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz`,
    archive: 'tar.gz',
    extractDir: `node-v${NODE_VERSION}-linux-x64`,
    executable: 'node',
  },
};

/**
 * Download a file from URL to destination
 */
async function downloadFile(url, dest) {
  console.log(`  Downloading from ${url}...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }

  const fileStream = createWriteStream(dest);
  await pipeline(response.body, fileStream);
  console.log(`  Downloaded to ${dest}`);
}

/**
 * Extract tar.gz archive
 */
async function extractTarGz(archivePath, destDir) {
  console.log(`  Extracting ${archivePath}...`);
  const readStream = createReadStream(archivePath);
  await pipeline(readStream, createGunzip(), extract({ cwd: destDir }));
}

/**
 * Extract zip archive (Windows)
 */
function extractZip(archivePath, destDir) {
  console.log(`  Extracting ${archivePath}...`);

  if (process.platform === 'win32') {
    execSync(
      `powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`unzip -o "${archivePath}" -d "${destDir}"`, { stdio: 'inherit' });
  }
}

/**
 * Download and extract Node.js for a specific platform
 */
async function bundlePlatform(platformName, config) {
  const platformDir = join(resourcesDir, platformName);
  const nodeExecutable = join(platformDir, config.executable);

  // Check if already downloaded (idempotent)
  if (existsSync(nodeExecutable)) {
    console.log(`  ${platformName}: Already bundled (skipping)`);
    return;
  }

  console.log(`  ${platformName}: Downloading Node.js ${NODE_VERSION}...`);

  // Create temp directory
  const tempDir = join(resourcesDir, '.temp', platformName);
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true });
  }
  mkdirSync(tempDir, { recursive: true });

  // Download archive
  const archiveExt = config.archive === 'zip' ? 'zip' : 'tar.gz';
  const archivePath = join(tempDir, `node.${archiveExt}`);
  await downloadFile(config.url, archivePath);

  // Extract archive
  if (config.archive === 'zip') {
    extractZip(archivePath, tempDir);
  } else {
    await extractTarGz(archivePath, tempDir);
  }

  // Move extracted files to platform directory
  const extractedDir = join(tempDir, config.extractDir);
  if (existsSync(platformDir)) {
    rmSync(platformDir, { recursive: true });
  }
  mkdirSync(platformDir, { recursive: true });

  if (platformName.startsWith('win')) {
    // Windows: copy node.exe
    cpSync(join(extractedDir, 'node.exe'), join(platformDir, 'node.exe'));
  } else {
    // Unix: copy bin/node and make executable
    cpSync(join(extractedDir, 'bin', 'node'), join(platformDir, 'node'));
    chmodSync(join(platformDir, 'node'), 0o755);
  }

  // Cleanup temp directory
  rmSync(tempDir, { recursive: true });

  console.log(`  ${platformName}: Done!`);
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = { platform: null, arch: null, all: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--platform' && args[i + 1]) {
      options.platform = args[++i];
    } else if (args[i] === '--arch' && args[i + 1]) {
      options.arch = args[++i];
    } else if (args[i] === '--all') {
      options.all = true;
    }
  }

  return options;
}

/**
 * Get current platform identifier
 */
function getCurrentPlatform() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'win32') return 'win-x64';
  if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64';
  if (platform === 'darwin') return 'darwin-x64';
  if (platform === 'linux') return 'linux-x64';

  throw new Error(`Unsupported platform: ${platform} ${arch}`);
}

/**
 * Main entry point
 */
async function main() {
  console.log('Bundling Node.js runtime...');
  console.log(`Node.js version: ${NODE_VERSION}`);

  const options = parseArgs();

  if (!existsSync(resourcesDir)) {
    mkdirSync(resourcesDir, { recursive: true });
  }

  let platformsToBuild = [];

  if (options.all) {
    platformsToBuild = Object.keys(PLATFORMS);
  } else if (options.platform) {
    const platformKey = options.arch ? `${options.platform}-${options.arch}` : options.platform;
    if (!PLATFORMS[platformKey]) {
      console.error(`Unknown platform: ${platformKey}`);
      console.error(`Available: ${Object.keys(PLATFORMS).join(', ')}`);
      process.exit(1);
    }
    platformsToBuild = [platformKey];
  } else {
    platformsToBuild = [getCurrentPlatform()];
  }

  console.log(`Platforms to bundle: ${platformsToBuild.join(', ')}`);

  for (const platform of platformsToBuild) {
    try {
      await bundlePlatform(platform, PLATFORMS[platform]);
    } catch (error) {
      console.error(`Failed to bundle ${platform}:`, error.message);
      if (!options.all) process.exit(1);
    }
  }

  console.log('\nNode.js bundling complete!');
}

main().catch((error) => {
  console.error('Bundle failed:', error);
  process.exit(1);
});

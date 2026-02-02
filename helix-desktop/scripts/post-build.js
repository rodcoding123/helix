#!/usr/bin/env node

/**
 * Post-build script for Helix Desktop
 * - Verifies bundle contents
 * - Checks bundle size
 * - Generates checksums
 * - Creates update manifest
 */

import { existsSync, statSync, readdirSync, createReadStream, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const tauriDir = join(rootDir, 'src-tauri');
const targetDir = join(tauriDir, 'target', 'release', 'bundle');

// Configuration
const MAX_BUNDLE_SIZE_MB = 200;
const PLATFORMS = {
  windows: {
    paths: ['nsis/*.exe', 'msi/*.msi'],
    dir: 'nsis',
  },
  macos: {
    paths: ['dmg/*.dmg', 'macos/*.app'],
    dir: 'dmg',
  },
  linux: {
    paths: ['appimage/*.AppImage', 'deb/*.deb', 'rpm/*.rpm'],
    dir: 'appimage',
  },
};

/**
 * Calculate SHA256 checksum of a file
 */
async function calculateChecksum(filePath) {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  await pipeline(stream, hash);
  return hash.digest('hex');
}

/**
 * Get file size in MB
 */
function getFileSizeMB(filePath) {
  const stats = statSync(filePath);
  return stats.size / (1024 * 1024);
}

/**
 * Find files matching a pattern in a directory
 */
function findFiles(baseDir, pattern) {
  const [dirPattern, filePattern] = pattern.split('/');
  const searchDir = join(baseDir, dirPattern);

  if (!existsSync(searchDir)) {
    return [];
  }

  const files = readdirSync(searchDir);
  const regex = new RegExp(filePattern.replace('*', '.*'));

  return files
    .filter((f) => regex.test(f))
    .map((f) => join(searchDir, f));
}

/**
 * Verify required resources exist
 * Note: helix-desktop uses helix-runtime as a sibling project, not a bundled resource
 */
function verifyResources() {
  // Check helix-runtime sibling project
  const openclawDir = join(rootDir, '..', 'helix-runtime');
  const openclawDist = join(openclawDir, 'dist');

  const missing = [];
  const found = [];

  // Check if helix-runtime exists and is built
  if (existsSync(openclawDir)) {
    found.push('helix-runtime (sibling project)');
    if (existsSync(openclawDist)) {
      found.push('helix-runtime/dist (built)');
    } else {
      missing.push('helix-runtime/dist (run: cd ../helix-runtime && pnpm build)');
    }
  } else {
    missing.push('helix-runtime (sibling project not found)');
  }

  return { found, missing };
}

/**
 * Check for Node.js runtime
 */
function verifyNodeRuntime() {
  const nodeDir = join(tauriDir, 'resources', 'node');
  if (!existsSync(nodeDir)) {
    return { found: false, platforms: [] };
  }

  const platforms = readdirSync(nodeDir).filter((d) =>
    statSync(join(nodeDir, d)).isDirectory()
  );

  return { found: true, platforms };
}

/**
 * Generate checksums for all installers
 */
async function generateChecksums() {
  const checksums = {};

  for (const [platform, config] of Object.entries(PLATFORMS)) {
    for (const pattern of config.paths) {
      const files = findFiles(targetDir, pattern);
      for (const file of files) {
        const filename = basename(file);
        const checksum = await calculateChecksum(file);
        const sizeMB = getFileSizeMB(file).toFixed(2);
        checksums[filename] = { checksum, sizeMB, platform };
      }
    }
  }

  return checksums;
}

/**
 * Check bundle sizes
 */
function checkBundleSizes(checksums) {
  const warnings = [];
  const sizes = [];

  for (const [filename, info] of Object.entries(checksums)) {
    sizes.push({ filename, sizeMB: parseFloat(info.sizeMB) });
    if (parseFloat(info.sizeMB) > MAX_BUNDLE_SIZE_MB) {
      warnings.push(`${filename} is ${info.sizeMB}MB (exceeds ${MAX_BUNDLE_SIZE_MB}MB limit)`);
    }
  }

  return { warnings, sizes };
}

/**
 * Get version from tauri.conf.json
 */
function getVersion() {
  const confPath = join(tauriDir, 'tauri.conf.json');
  if (!existsSync(confPath)) {
    return 'unknown';
  }
  const conf = JSON.parse(readFileSync(confPath, 'utf-8'));
  return conf.version || 'unknown';
}

/**
 * Write checksums file
 */
function writeChecksums(checksums) {
  const outputDir = join(rootDir, 'releases');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const checksumFile = join(outputDir, 'checksums.txt');
  const lines = Object.entries(checksums)
    .map(([filename, info]) => `${info.checksum}  ${filename}`)
    .join('\n');

  writeFileSync(checksumFile, lines + '\n');
  return checksumFile;
}

/**
 * Write build summary
 */
function writeSummary(results) {
  const outputDir = join(rootDir, 'releases');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const summaryFile = join(outputDir, 'build-summary.json');
  writeFileSync(summaryFile, JSON.stringify(results, null, 2));
  return summaryFile;
}

/**
 * Main entry point
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Helix Desktop - Post-Build Verification');
  console.log('='.repeat(60));

  const results = {
    timestamp: new Date().toISOString(),
    version: 'unknown',
    resources: { verified: false },
    nodeRuntime: { found: false },
    installers: {},
    warnings: [],
    errors: [],
  };

  // Get version
  try {
    const confPath = join(tauriDir, 'tauri.conf.json');
    if (existsSync(confPath)) {
      const conf = JSON.parse(readFileSync(confPath, 'utf-8'));
      results.version = conf.version || 'unknown';
    }
  } catch (e) {
    results.errors.push(`Failed to read version: ${e.message}`);
  }

  console.log(`\nVersion: ${results.version}`);

  // Verify resources
  console.log('\n--- Verifying Resources ---');
  const resources = verifyResources();
  results.resources = resources;

  if (resources.found.length > 0) {
    console.log('Found:');
    resources.found.forEach((r) => console.log(`  ✓ ${r}`));
  }
  if (resources.missing.length > 0) {
    console.log('Missing (warnings):');
    resources.missing.forEach((r) => {
      console.log(`  ⚠ ${r}`);
      results.warnings.push(`Missing: ${r}`);
    });
  }

  // Verify Node.js runtime
  console.log('\n--- Verifying Node.js Runtime ---');
  const nodeRuntime = verifyNodeRuntime();
  results.nodeRuntime = nodeRuntime;

  if (nodeRuntime.found) {
    console.log(`Found Node.js runtime for: ${nodeRuntime.platforms.join(', ')}`);
  } else {
    console.log('Warning: Node.js runtime not bundled');
    results.warnings.push('Node.js runtime not bundled');
  }

  // Check if bundle directory exists
  if (!existsSync(targetDir)) {
    console.log('\n--- No Bundle Found ---');
    console.log(`Bundle directory not found: ${targetDir}`);
    console.log('Run "npm run tauri:build" to create installers.');
    results.warnings.push('Bundle directory not found (run npm run tauri:build)');
  } else {
    // Generate checksums
    console.log('\n--- Generating Checksums ---');
    const checksums = await generateChecksums();
    results.installers = checksums;

    if (Object.keys(checksums).length === 0) {
      console.log('No installers found.');
      results.warnings.push('No installers found in bundle directory');
    } else {
      for (const [filename, info] of Object.entries(checksums)) {
        console.log(`\n${filename}`);
        console.log(`  SHA256: ${info.checksum}`);
        console.log(`  Size: ${info.sizeMB} MB`);
        console.log(`  Platform: ${info.platform}`);
      }

      // Check sizes
      const { warnings } = checkBundleSizes(checksums);
      results.warnings.push(...warnings);

      if (warnings.length > 0) {
        console.log('\n--- Size Warnings ---');
        warnings.forEach((w) => console.log(`  ⚠ ${w}`));
      }

      // Write checksums file
      const checksumFile = writeChecksums(checksums);
      console.log(`\nChecksums written to: ${checksumFile}`);
    }
  }

  // Write summary
  const summaryFile = writeSummary(results);
  console.log(`Build summary written to: ${summaryFile}`);

  // Final status
  console.log('\n' + '='.repeat(60));
  if (results.errors.length > 0) {
    console.log(`Status: FAILED (${results.errors.length} errors)`);
    results.errors.forEach((e) => console.log(`  ✗ ${e}`));
    process.exit(1);
  } else if (results.warnings.length > 0) {
    console.log(`Status: PASSED with ${results.warnings.length} warnings`);
  } else {
    console.log('Status: PASSED');
  }
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('Post-build failed:', error);
  process.exit(1);
});

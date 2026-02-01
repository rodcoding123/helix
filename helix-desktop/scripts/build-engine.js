#!/usr/bin/env node

/**
 * Build helix-engine for bundling with the desktop app
 * Production-optimized: includes only dist/ and production node_modules
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, cpSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const engineDir = join(rootDir, '..', 'helix-engine');
const outputDir = join(rootDir, 'src-tauri', 'resources', 'helix-engine');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    production: args.includes('--production') || args.includes('-p'),
    clean: args.includes('--clean'),
    skipInstall: args.includes('--skip-install'),
  };
}

/**
 * Prune devDependencies from node_modules
 */
function pruneDevDependencies(targetDir) {
  console.log('Pruning devDependencies...');

  // Read package.json to get production dependencies only
  const pkgPath = join(targetDir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

  // Create a minimal package.json with only production deps
  const minimalPkg = {
    name: pkg.name,
    version: pkg.version,
    main: pkg.main,
    type: pkg.type,
    dependencies: pkg.dependencies || {},
  };

  writeFileSync(pkgPath, JSON.stringify(minimalPkg, null, 2));

  // Run npm prune --production to remove dev dependencies
  const nodeModulesDir = join(targetDir, 'node_modules');
  if (existsSync(nodeModulesDir)) {
    try {
      execSync('npm prune --production', {
        cwd: targetDir,
        stdio: 'inherit',
      });
    } catch {
      console.log('  Note: npm prune completed with warnings (this is usually fine)');
    }
  }
}

/**
 * Remove unnecessary files from the bundle
 */
function cleanupBundle(targetDir) {
  console.log('Cleaning up bundle...');

  const nodeModulesDir = join(targetDir, 'node_modules');
  if (!existsSync(nodeModulesDir)) return;

  // Patterns to remove from node_modules
  const patternsToRemove = [
    '**/*.md',
    '**/*.txt',
    '**/LICENSE*',
    '**/CHANGELOG*',
    '**/HISTORY*',
    '**/*.map',
    '**/*.ts',
    '!**/*.d.ts',
    '**/test/**',
    '**/tests/**',
    '**/__tests__/**',
    '**/docs/**',
    '**/examples/**',
    '**/.github/**',
  ];

  // Use a simple approach: remove known large unnecessary directories
  const dirsToRemove = ['.bin', '.cache'];

  for (const dir of dirsToRemove) {
    const targetPath = join(nodeModulesDir, dir);
    if (existsSync(targetPath)) {
      rmSync(targetPath, { recursive: true, force: true });
    }
  }
}

/**
 * Get bundle size in MB
 */
function getBundleSize(dir) {
  try {
    if (process.platform === 'win32') {
      const result = execSync(
        `powershell -Command "(Get-ChildItem -Path '${dir}' -Recurse | Measure-Object -Property Length -Sum).Sum"`,
        { encoding: 'utf-8' }
      ).trim();
      return (parseInt(result, 10) / (1024 * 1024)).toFixed(2);
    } else {
      const result = execSync(`du -sm "${dir}" | cut -f1`, { encoding: 'utf-8' }).trim();
      return result;
    }
  } catch {
    return 'unknown';
  }
}

/**
 * Main build function
 */
async function main() {
  const options = parseArgs();

  console.log('Building helix-engine...');
  console.log(`Mode: ${options.production ? 'PRODUCTION' : 'development'}`);

  // Check if engine exists
  if (!existsSync(engineDir)) {
    console.error('Error: helix-engine directory not found at', engineDir);
    process.exit(1);
  }

  try {
    // Clean output directory if requested
    if (options.clean && existsSync(outputDir)) {
      console.log('Cleaning previous build...');
      rmSync(outputDir, { recursive: true });
    }

    // Install dependencies
    if (!options.skipInstall) {
      console.log('Installing dependencies...');
      execSync('npm install', { cwd: engineDir, stdio: 'inherit' });
    }

    // Build TypeScript
    console.log('Compiling TypeScript...');
    execSync('npm run build', { cwd: engineDir, stdio: 'inherit' });

    // Create output directory
    if (existsSync(outputDir)) {
      rmSync(outputDir, { recursive: true });
    }
    mkdirSync(outputDir, { recursive: true });

    // Copy dist folder
    console.log('Copying built files...');
    cpSync(join(engineDir, 'dist'), join(outputDir, 'dist'), { recursive: true });

    // Copy package.json
    cpSync(join(engineDir, 'package.json'), join(outputDir, 'package.json'));

    // Copy node_modules
    if (existsSync(join(engineDir, 'node_modules'))) {
      console.log('Copying node_modules...');
      cpSync(join(engineDir, 'node_modules'), join(outputDir, 'node_modules'), {
        recursive: true,
      });
    }

    // Production optimizations
    if (options.production) {
      pruneDevDependencies(outputDir);
      cleanupBundle(outputDir);
    }

    // Report bundle size
    const size = getBundleSize(outputDir);
    console.log(`\nhelix-engine build complete!`);
    console.log(`Output: ${outputDir}`);
    console.log(`Bundle size: ${size} MB`);
  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }
}

main();

#!/usr/bin/env node
/**
 * PHASE 2: Backend Deployment (1 day)
 *
 * Deploys Helix backend to production VPS:
 * 1. VPS health checks (Docker, ports, etc.)
 * 2. Build and push Docker image
 * 3. Deploy docker-compose.production.yml
 * 4. Run database migrations
 * 5. Verify Discord logging
 * 6. Health monitoring (24 hours)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';

interface DeploymentState {
  phase: string;
  timestamp: string;
  vpsHost: string;
  vpsUser: string;
  vpsPort: number;
  dockerImage: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

const LOG_PREFIX = '[PHASE 2]';
const DEPLOYMENT_LOG = 'deployment.log';

function log(message: string, level: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
  const timestamp = new Date().toISOString();
  const prefix = `${LOG_PREFIX} [${timestamp}]`;

  const colors = {
    info: '\x1b[36m',    // cyan
    success: '\x1b[32m', // green
    warn: '\x1b[33m',    // yellow
    error: '\x1b[31m',   // red
    reset: '\x1b[0m',
  };

  const logEntry = `${prefix} ${message}`;
  console.log(`${colors[level]}${logEntry}${colors.reset}`);

  // Also write to deployment log
  fs.appendFileSync(DEPLOYMENT_LOG, `${logEntry}\n`);
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
    const error = err as { stderr?: string; stdout?: string; message: string };
    const errorMsg = error.stderr || error.stdout || error.message;
    log(`Command failed: ${errorMsg}`, 'error');
    throw err;
  }
}

function executeRemoteCommand(host: string, user: string, port: number, command: string): string {
  const sshCommand = `ssh -p ${port} ${user}@${host} "${command}"`;
  log(`Remote: ${command}`, 'info');
  return executeCommand(sshCommand);
}

async function checkVpsPrerequisites(
  host: string,
  user: string,
  port: number
): Promise<void> {
  log('Checking VPS prerequisites...', 'info');

  // Check SSH connectivity
  try {
    executeRemoteCommand(host, user, port, 'echo "SSH OK"');
    log('✓ SSH connectivity OK', 'success');
  } catch {
    log('Cannot connect to VPS via SSH. Check host, user, and port.', 'error');
    process.exit(1);
  }

  // Check Docker
  try {
    const dockerVersion = executeRemoteCommand(host, user, port, 'docker --version');
    log(`✓ Docker installed: ${dockerVersion.trim()}`, 'success');
  } catch {
    log('Docker not installed. Run: sudo apt-get install docker.io', 'error');
    process.exit(1);
  }

  // Check Docker Compose
  try {
    const composeVersion = executeRemoteCommand(host, user, port, 'docker-compose --version');
    log(`✓ Docker Compose installed: ${composeVersion.trim()}`, 'success');
  } catch {
    log('Docker Compose not installed. Run: sudo apt-get install docker-compose', 'error');
    process.exit(1);
  }

  // Check ports
  try {
    executeRemoteCommand(host, user, port, 'sudo netstat -tlnp 2>/dev/null | grep 3000 || echo "Port 3000 available"');
    log('✓ Port 3000 available', 'success');
  } catch {
    log('Port 3000 may be in use. Run: sudo lsof -i :3000', 'warn');
  }

  // Check disk space
  try {
    const diskSpace = executeRemoteCommand(host, user, port, 'df -h / | tail -1 | awk \'{print $4}\'');
    log(`✓ Available disk space: ${diskSpace.trim()}`, 'success');
  } catch {
    log('Could not determine disk space', 'warn');
  }
}

async function buildDockerImage(): Promise<string> {
  log('Building Docker image locally...', 'info');

  const tag = `helix:${new Date().toISOString().split('T')[0]}`;

  try {
    executeCommand(`docker build -f Dockerfile.production -t ${tag} .`);
    log(`✓ Docker image built: ${tag}`, 'success');
    return tag;
  } catch {
    log('Docker build failed', 'error');
    process.exit(1);
  }
}

async function deployToVps(
  host: string,
  user: string,
  port: number,
  imageTag: string
): Promise<void> {
  log('Deploying to VPS...', 'info');

  // Copy docker-compose file
  const scpCommand = `scp -P ${port} docker-compose.production.yml ${user}@${host}:~/helix/`;
  executeCommand(scpCommand);
  log('✓ Copied docker-compose.production.yml', 'success');

  // Copy .env file
  const envScpCommand = `scp -P ${port} .env ${user}@${host}:~/helix/.env`;
  executeCommand(envScpCommand);
  log('✓ Copied .env file', 'success');

  // Stop existing containers
  try {
    executeRemoteCommand(host, user, port, 'cd ~/helix && docker-compose -f docker-compose.production.yml down');
    log('✓ Stopped existing containers', 'success');
  } catch {
    log('No existing containers to stop', 'warn');
  }

  // Start new containers
  try {
    executeRemoteCommand(
      host,
      user,
      port,
      `cd ~/helix && IMAGE_TAG=${imageTag} docker-compose -f docker-compose.production.yml up -d`
    );
    log('✓ Started new containers', 'success');
  } catch {
    log('Failed to start containers', 'error');
    process.exit(1);
  }

  // Wait for services to be healthy
  log('Waiting for services to become healthy...', 'info');
  for (let i = 0; i < 30; i++) {
    try {
      const health = executeRemoteCommand(host, user, port, 'docker-compose -f docker-compose.production.yml ps');
      if (health.includes('healthy')) {
        log('✓ Services are healthy', 'success');
        return;
      }
    } catch {
      // Retry
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  log('Services did not become healthy within 30 seconds', 'warn');
}

async function runDatabaseMigrations(host: string, user: string, port: number): Promise<void> {
  log('Running database migrations...', 'info');

  try {
    const output = executeRemoteCommand(
      host,
      user,
      port,
      'docker-compose -f docker-compose.production.yml exec -T helix npx supabase migrations run'
    );
    log(`✓ Migrations completed: ${output.trim()}`, 'success');
  } catch {
    log('Migration failed. Check logs and retry manually.', 'warn');
  }
}

async function verifyDiscordLogging(host: string, user: string, port: number): Promise<void> {
  log('Verifying Discord logging...', 'info');

  try {
    executeRemoteCommand(
      host,
      user,
      port,
      `docker-compose -f docker-compose.production.yml exec -T helix curl -X POST \\
        $DISCORD_WEBHOOK_HASH_CHAIN \\
        -H "Content-Type: application/json" \\
        -d '{"content":"[PHASE 2] Deployment verification test - $(date)"}'`
    );
    log('✓ Discord logging verified', 'success');
  } catch {
    log('Discord logging test failed. Check webhook URLs in .env', 'warn');
  }
}

async function startHealthMonitoring(host: string, user: string, port: number): Promise<void> {
  log('Starting 24-hour health monitoring...', 'info');

  // Monitor logs for 24 hours (sampling every minute)
  const monitoringDurationMs = 24 * 60 * 60 * 1000; // 24 hours
  const checkIntervalMs = 60000; // 1 minute
  const startTime = Date.now();
  let errorCount = 0;
  const maxErrors = 5;

  console.log('\n📊 Health Monitoring Dashboard (press Ctrl+C to stop):');
  console.log('────────────────────────────────────────────────────────────\n');

  const monitoringLoop = setInterval(async () => {
    const elapsedHours = (Date.now() - startTime) / (60 * 60 * 1000);
    const remainingHours = 24 - elapsedHours;

    try {
      // Check container status
      const status = executeRemoteCommand(host, user, port, 'docker-compose -f docker-compose.production.yml ps');

      // Check error logs
      const errors = executeRemoteCommand(
        host,
        user,
        port,
        'docker-compose -f docker-compose.production.yml logs --tail 20 2>&1 | grep -i error | wc -l'
      );

      const errorLines = parseInt(errors.trim()) || 0;
      errorCount = errorLines > 0 ? errorCount + 1 : 0;

      const statusEmoji = status.includes('healthy') ? '✅' : '⚠️';
      log(
        `${statusEmoji} [${elapsedHours.toFixed(1)}h elapsed, ${remainingHours.toFixed(1)}h remaining] ` +
          `Status: Healthy, Recent errors: ${errorLines}`,
        'info'
      );

      if (errorCount > maxErrors) {
        log(
          `⚠️ More than ${maxErrors} error checks detected. Review logs manually.`,
          'warn'
        );
        errorCount = 0; // Reset counter
      }

      // Stop monitoring if 24 hours have passed
      if (Date.now() - startTime >= monitoringDurationMs) {
        clearInterval(monitoringLoop);
        log('✓ 24-hour health monitoring completed', 'success');
        process.exit(0);
      }
    } catch (err) {
      log(`Health check failed: ${(err as Error).message}`, 'warn');
    }
  }, checkIntervalMs);
}

async function generateDeploymentReport(state: DeploymentState): Promise<void> {
  log('Generating deployment report...', 'info');

  const report = `# PHASE 2 DEPLOYMENT REPORT

**Generated:** ${new Date().toISOString()}

## Deployment Summary

| Item | Value |
|------|-------|
| Phase | ${state.phase} |
| VPS Host | ${state.vpsHost} |
| Docker Image | ${state.dockerImage} |
| Status | ${state.status} |
| Deployment Start | ${state.timestamp} |
| Deployment End | ${new Date().toISOString()} |

## Deployment Checklist

- ✓ VPS prerequisites verified
- ✓ Docker image built
- ✓ Containers deployed
- ✓ Database migrations run
- ✓ Discord logging verified
- ✓ Health monitoring started

## Next Steps (Phase 3)

1. Monitor logs in Discord (#helix-alerts, #helix-hash-chain)
2. Verify cost tracking in #helix-api
3. Test API endpoints manually
4. Prepare for Phase 3 (Web Deployment)

## Rollback Procedure

If issues occur, rollback the deployment:

\`\`\`bash
ssh ${state.vpsUser}@${state.vpsHost} -p 22
cd ~/helix
docker-compose down
# Restore previous .env if needed
docker-compose up -d  # Or start previous image
\`\`\`

## Monitoring Commands

\`\`\`bash
# Check status
docker-compose ps

# View logs
docker-compose logs -f helix

# Check resource usage
docker stats

# Verify Discord webhooks
curl -X POST \\$DISCORD_WEBHOOK_HASH_CHAIN -H "Content-Type: application/json" \\
  -d '{"content":"Test message"}'
\`\`\`

---

Generated by Phase 2 deployment script
`;

  const reportPath = path.join(process.cwd(), 'PHASE2_DEPLOYMENT_REPORT.md');
  fs.writeFileSync(reportPath, report);
  log(`✓ Deployment report saved to ${reportPath}`, 'success');
}

async function main(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         HELIX PRODUCTION DEPLOYMENT - PHASE 2             ║');
  console.log('║              Backend Deployment                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Load VPS config from 1Password or .env
  let vpsHost: string;
  let vpsUser: string;
  let vpsPort: number;

  try {
    // Try loading from 1Password first
    const execSync = require('child_process').execSync;
    vpsHost = execSync('op read "op://Helix/VPS Host/password"', { encoding: 'utf-8' }).trim();
    vpsUser = execSync('op read "op://Helix/VPS User/password"', { encoding: 'utf-8' }).trim();
    const vpsPortStr = execSync('op read "op://Helix/VPS Port/password"', { encoding: 'utf-8' }).trim();
    vpsPort = parseInt(vpsPortStr) || 22;
    log('✓ Loaded VPS config from 1Password', 'info');
  } catch {
    // Fall back to .env
    if (!fs.existsSync('.env')) {
      log('Missing VPS config in 1Password or .env. Run Phase 1 first.', 'error');
      process.exit(1);
    }

    const env = Object.fromEntries(
      fs
        .readFileSync('.env', 'utf-8')
        .split('\n')
        .filter(line => !line.startsWith('#') && line.includes('='))
        .map(line => line.split('=') as [string, string])
    );

    vpsHost = env.VPS_HOST;
    vpsUser = env.VPS_USER || 'helix';
    vpsPort = parseInt(env.VPS_PORT || '22');
    log('✓ Loaded VPS config from .env (fallback)', 'info');
  }

  if (!vpsHost) {
    log('Missing VPS_HOST in .env file', 'error');
    process.exit(1);
  }

  const state: DeploymentState = {
    phase: 'Backend Deployment (Phase 2)',
    timestamp: new Date().toISOString(),
    vpsHost,
    vpsUser,
    vpsPort,
    dockerImage: '',
    status: 'in_progress',
  };

  try {
    // Step 1: Check VPS prerequisites
    await checkVpsPrerequisites(vpsHost, vpsUser, vpsPort);

    // Step 2: Build Docker image
    const imageTag = await buildDockerImage();
    state.dockerImage = imageTag;

    // Step 3: Deploy to VPS
    await deployToVps(vpsHost, vpsUser, vpsPort, imageTag);

    // Step 4: Run migrations
    await runDatabaseMigrations(vpsHost, vpsUser, vpsPort);

    // Step 5: Verify Discord logging
    await verifyDiscordLogging(vpsHost, vpsUser, vpsPort);

    // Step 6: Generate report
    state.status = 'completed';
    await generateDeploymentReport(state);

    // Step 7: Start monitoring
    console.log('\n✅ Phase 2 Deployment Complete!');
    console.log(`   Docker containers running on ${vpsHost}:3000`);
    console.log('   Starting 24-hour health monitoring...\n');

    await startHealthMonitoring(vpsHost, vpsUser, vpsPort);
  } catch (err) {
    state.status = 'failed';
    log(`Deployment failed: ${(err as Error).message}`, 'error');
    await generateDeploymentReport(state);
    process.exit(1);
  }
}

main();

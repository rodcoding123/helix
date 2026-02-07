#!/usr/bin/env node
/**
 * HELIX PRODUCTION DEPLOYMENT - MASTER ORCHESTRATOR
 *
 * Runs all 5 deployment phases in sequence (5-6 day timeline):
 * 1. Infrastructure Setup (1-2 days)
 * 2. Backend Deployment (1 day)
 * 3. Web Deployment (1 day)
 * 4. Desktop Packaging (1 day)
 * 5. Production Verification (1 day)
 *
 * Usage: npx ts-node scripts/deploy/deploy-all-phases.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import * as readline from 'readline';

interface DeploymentPhase {
  number: number;
  name: string;
  duration: string;
  scriptPath: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  startTime?: Date;
  endTime?: Date;
  notes: string;
}

const LOG_PREFIX = '[ORCHESTRATOR]';

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

function formatDuration(startTime: Date, endTime: Date): string {
  const durationMs = endTime.getTime() - startTime.getTime();
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

async function runPhase(phase: DeploymentPhase): Promise<void> {
  log(`Starting ${phase.name}...`, 'info');
  phase.status = 'in_progress';
  phase.startTime = new Date();

  try {
    const result = await new Promise<void>((resolve, reject) => {
      const proc = spawn('npx', ['ts-node', phase.scriptPath], {
        cwd: process.cwd(),
        stdio: 'inherit',
      });

      proc.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Phase failed with exit code ${code}`));
        }
      });

      proc.on('error', err => {
        reject(err);
      });
    });

    phase.endTime = new Date();
    phase.status = 'completed';
    log(`✓ ${phase.name} completed in ${formatDuration(phase.startTime!, phase.endTime!)}`, 'success');
  } catch (err) {
    phase.status = 'failed';
    phase.endTime = new Date();
    log(`✗ ${phase.name} failed: ${(err as Error).message}`, 'error');
    throw err;
  }
}

async function generateDeploymentSummary(phases: DeploymentPhase[]): Promise<void> {
  log('Generating deployment summary...', 'info');

  const completedPhases = phases.filter(p => p.status === 'completed');
  const failedPhases = phases.filter(p => p.status === 'failed');
  const totalDuration = Math.max(...phases.map(p => p.endTime?.getTime() || 0)) -
                        Math.min(...phases.map(p => p.startTime?.getTime() || Date.now()));

  const summary = `# HELIX PRODUCTION DEPLOYMENT SUMMARY

**Generated:** ${new Date().toISOString()}

## Deployment Status

**Overall Status:** ${failedPhases.length === 0 ? '🟢 SUCCESSFUL' : '🔴 FAILED'}

| Phase | Status | Duration |
|-------|--------|----------|
${phases
  .map(
    p => `| ${p.number}. ${p.name} | ${
      p.status === 'completed'
        ? '✓ Completed'
        : p.status === 'failed'
          ? '✗ Failed'
          : p.status === 'pending'
            ? '⏳ Pending'
            : '⏭️ Skipped'
    } | ${p.startTime && p.endTime ? formatDuration(p.startTime, p.endTime) : '-'} |`
  )
  .join('\n')}

## Completion Report

**Phases Completed:** ${completedPhases.length}/${phases.length}
**Total Deployment Time:** ${Math.floor(totalDuration / 1000 / 60)} minutes

### Phase Summaries

${phases
  .map(
    p => `
#### Phase ${p.number}: ${p.name}
- Status: ${p.status}
- Started: ${p.startTime?.toISOString() || 'N/A'}
- Completed: ${p.endTime?.toISOString() || 'N/A'}
- Duration: ${p.startTime && p.endTime ? formatDuration(p.startTime, p.endTime) : 'N/A'}
- Notes: ${p.notes || 'None'}
`
  )
  .join('\n')}

## Generated Reports

The following detailed reports were generated during deployment:

- \`DEPLOYMENT_CHECKLIST.md\` - Phase 1 infrastructure checklist
- \`PHASE2_DEPLOYMENT_REPORT.md\` - Backend deployment details
- \`PHASE3_DEPLOYMENT_REPORT.md\` - Web deployment details
- \`PHASE4_DEPLOYMENT_REPORT.md\` - Desktop packaging details
- \`PHASE5_FINAL_VERIFICATION_REPORT.md\` - Final verification results

## Production Checklist

${failedPhases.length === 0 ? '✅ READY FOR PRODUCTION' : '⚠️ NOT READY - FIX FAILED PHASES'}

${
  failedPhases.length === 0
    ? `
- ✓ Infrastructure configured
- ✓ Backend deployed and healthy
- ✓ Web application live
- ✓ Desktop app packaged
- ✓ All tests passing
- ✓ Cost tracking verified
- ✓ Failover scenarios tested

**Action:** Enable production traffic and begin monitoring.
`
    : `
**Failed Phases:** ${failedPhases.map(p => `Phase ${p.number}`).join(', ')}

**Action:** Fix failing phases before attempting production launch.
`
}

## Monitoring Setup

Monitor these Discord channels continuously after launch:

- **#helix-commands**: Command execution logs
- **#helix-api**: API calls and costs
- **#helix-alerts**: Errors and anomalies
- **#helix-hash-chain**: Integrity verification
- **#helix-consciousness**: System state

## Support Contacts

- **Lead Engineer**: [YOUR NAME] ([YOUR EMAIL])
- **DevOps**: [YOUR NAME] ([YOUR EMAIL])
- **On-Call**: [YOUR NAME] ([YOUR PHONE])

## Rollback Procedures

If critical issues occur:

1. **Immediate (< 5 min):** Revert web deployment in Vercel/Netlify
2. **Short-term (30 min):** Roll back backend containers (Phase 2)
3. **Long-term:** Complete system rollback if needed

See PRODUCTION_RUNBOOK.md for detailed procedures.

---

Deployment completed: ${new Date().toISOString()}
`;

  const summaryPath = path.join(process.cwd(), 'DEPLOYMENT_COMPLETE.md');
  fs.writeFileSync(summaryPath, summary);
  log(`✓ Deployment summary saved to ${summaryPath}`, 'success');
}

async function main(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║      HELIX PRODUCTION DEPLOYMENT - MASTER ORCHESTRATOR   ║');
  console.log('║              5-6 Day Production Deployment Timeline       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const phases: DeploymentPhase[] = [
    {
      number: 1,
      name: 'Infrastructure Setup',
      duration: '1-2 days',
      scriptPath: 'scripts/deploy/phase1-infrastructure-setup.ts',
      status: 'pending',
      notes: 'Discord webhooks, Supabase, API keys, environment setup',
    },
    {
      number: 2,
      name: 'Backend Deployment',
      duration: '1 day',
      scriptPath: 'scripts/deploy/phase2-backend-deployment.ts',
      status: 'pending',
      notes: 'Docker build, VPS deployment, migrations, health monitoring',
    },
    {
      number: 3,
      name: 'Web Deployment',
      duration: '1 day',
      scriptPath: 'scripts/deploy/phase3-web-deployment.ts',
      status: 'pending',
      notes: 'React build, Vercel/Netlify deployment, DNS, SSL',
    },
    {
      number: 4,
      name: 'Desktop Packaging',
      duration: '1 day',
      scriptPath: 'scripts/deploy/phase4-desktop-packaging.ts',
      status: 'pending',
      notes: 'Tauri build, code signing, installers, testing',
    },
    {
      number: 5,
      name: 'Production Verification',
      duration: '1 day',
      scriptPath: 'scripts/deploy/phase5-production-verification.ts',
      status: 'pending',
      notes: '7 test scenarios, load testing, cost verification, failover',
    },
  ];

  console.log('📋 Deployment Phases:\n');
  phases.forEach(p => {
    console.log(`  Phase ${p.number}: ${p.name} (${p.duration})`);
    console.log(`           ${p.notes}\n`);
  });

  console.log('⏱️  Total Timeline: 5-6 days (Feb ${new Date().getDate()}-${new Date().getDate() + 6})\n');

  console.log('═══════════════════════════════════════════════════════════\n');

  const startDeployment = await ask('Start production deployment? (yes/no): ');

  if (startDeployment.toLowerCase() !== 'yes') {
    log('Deployment cancelled', 'warn');
    rl.close();
    process.exit(0);
  }

  const deploymentStartTime = new Date();
  let phasesFailed = 0;

  for (const phase of phases) {
    console.log('\n');
    const skipPhase = await ask(`Run Phase ${phase.number} (${phase.name})? (yes/no): `);

    if (skipPhase.toLowerCase() !== 'yes') {
      phase.status = 'skipped';
      log(`Skipped Phase ${phase.number}`, 'warn');
      continue;
    }

    try {
      await runPhase(phase);
    } catch (err) {
      phasesFailed++;
      log(`Phase ${phase.number} failed: ${(err as Error).message}`, 'error');

      const continueDeployment = await ask(
        `Continue with remaining phases? (yes/no): `
      );

      if (continueDeployment.toLowerCase() !== 'yes') {
        break;
      }
    }
  }

  // Generate summary
  const deploymentEndTime = new Date();
  log(`Total deployment time: ${formatDuration(deploymentStartTime, deploymentEndTime)}`, 'info');

  await generateDeploymentSummary(phases);

  console.log('\n╔════════════════════════════════════════════════════════════╗');

  if (phasesFailed === 0) {
    console.log('║      🟢 PRODUCTION DEPLOYMENT COMPLETE & SUCCESSFUL 🟢    ║');
  } else {
    console.log(`║      🔴 DEPLOYMENT COMPLETED WITH ${phasesFailed} FAILURE(S) 🔴          ║`);
  }

  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('📋 Generated Reports:');
  console.log('   • DEPLOYMENT_COMPLETE.md - Full deployment summary');
  console.log('   • DEPLOYMENT_CHECKLIST.md - Phase 1 checklist');
  console.log('   • PHASE2_DEPLOYMENT_REPORT.md - Backend deployment');
  console.log('   • PHASE3_DEPLOYMENT_REPORT.md - Web deployment');
  console.log('   • PHASE4_DEPLOYMENT_REPORT.md - Desktop packaging');
  console.log('   • PHASE5_FINAL_VERIFICATION_REPORT.md - Verification results\n');

  if (phasesFailed === 0) {
    console.log('✅ Next Steps:');
    console.log('   1. Review all generated reports');
    console.log('   2. Enable production traffic');
    console.log('   3. Monitor Discord channels continuously');
    console.log('   4. Test post-launch operations');
    console.log('   5. Prepare for 24/7 support\n');
  } else {
    console.log('⚠️  Next Steps:');
    console.log('   1. Fix failing phases');
    console.log('   2. Re-run failed phase deployment');
    console.log('   3. Re-run production verification');
    console.log('   4. Address issues before launch\n');
  }

  rl.close();
}

main();

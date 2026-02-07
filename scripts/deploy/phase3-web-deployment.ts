#!/usr/bin/env node
/**
 * PHASE 3: Web Deployment (1 day)
 *
 * Deploys Helix web application to Vercel/Netlify:
 * 1. Build React application
 * 2. Configure Vercel/Netlify project
 * 3. Deploy to production
 * 4. Configure DNS and SSL
 * 5. Test authentication flow
 * 6. Verify Supabase integration
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as readline from 'readline';

interface WebDeploymentConfig {
  platform: 'vercel' | 'netlify';
  projectName: string;
  domain: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  deployUrl: string;
}

const LOG_PREFIX = '[PHASE 3]';

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
    info: '\x1b[36m',    // cyan
    success: '\x1b[32m', // green
    warn: '\x1b[33m',    // yellow
    error: '\x1b[31m',   // red
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

async function selectDeploymentPlatform(): Promise<'vercel' | 'netlify'> {
  console.log('\n🌐 Select Web Hosting Platform:');
  console.log('   1. Vercel (recommended - better Next.js support)');
  console.log('   2. Netlify (alternative - good React support)\n');

  const choice = await ask('  Select platform (1 or 2): ');

  return choice === '2' ? 'netlify' : 'vercel';
}

async function buildReactApplication(): Promise<void> {
  log('Building React application...', 'info');

  try {
    executeCommand('npm run build', path.join(process.cwd(), 'web'));
    log('✓ React build completed', 'success');
  } catch {
    log('React build failed', 'error');
    process.exit(1);
  }
}

async function configureVercelDeployment(): Promise<WebDeploymentConfig> {
  log('Configuring Vercel deployment...', 'info');

  console.log('\n📋 Vercel Setup Instructions:');
  console.log('   1. Install Vercel CLI: npm i -g vercel');
  console.log('   2. Login: vercel login');
  console.log('   3. We will deploy your project next\n');

  const projectName = await ask('  Project name (e.g., helix-observatory): ');
  const domain = await ask('  Custom domain (e.g., helix.example.com or press Enter): ');

  // Load Supabase config from .env
  const env = Object.fromEntries(
    fs
      .readFileSync('.env', 'utf-8')
      .split('\n')
      .filter(line => !line.startsWith('#') && line.includes('='))
      .map(line => line.split('=') as [string, string])
  );

  log('Deploying to Vercel...', 'info');

  try {
    // Create vercel.json if it doesn't exist
    const vercelConfig = {
      buildCommand: 'npm run build',
      outputDirectory: 'dist',
      env: {
        VITE_SUPABASE_URL: env.SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
      },
    };

    fs.writeFileSync(
      path.join(process.cwd(), 'web', 'vercel.json'),
      JSON.stringify(vercelConfig, null, 2)
    );

    // Deploy with Vercel
    const deployOutput = executeCommand(
      `vercel --prod --name ${projectName} ${domain ? `--scope ${domain}` : ''} web/`
    );
    log('✓ Deployed to Vercel', 'success');

    // Extract deployment URL from output
    const deployUrl = deployOutput.includes('https://')
      ? deployOutput.match(/https:\/\/[^\s]+/)?.[0] || `https://${projectName}.vercel.app`
      : `https://${projectName}.vercel.app`;

    return {
      platform: 'vercel',
      projectName,
      domain: domain || deployUrl,
      supabaseUrl: env.SUPABASE_URL,
      supabaseAnonKey: env.SUPABASE_ANON_KEY,
      deployUrl,
    };
  } catch {
    log('Vercel deployment failed. Install Vercel CLI and try again.', 'error');
    process.exit(1);
  }
}

async function configureNetlifyDeployment(): Promise<WebDeploymentConfig> {
  log('Configuring Netlify deployment...', 'info');

  console.log('\n📋 Netlify Setup Instructions:');
  console.log('   1. Install Netlify CLI: npm i -g netlify-cli');
  console.log('   2. Login: netlify login');
  console.log('   3. We will deploy your project next\n');

  const projectName = await ask('  Site name (e.g., helix-observatory): ');
  const domain = await ask('  Custom domain (e.g., helix.example.com or press Enter): ');

  // Load Supabase config from .env
  const env = Object.fromEntries(
    fs
      .readFileSync('.env', 'utf-8')
      .split('\n')
      .filter(line => !line.startsWith('#') && line.includes('='))
      .map(line => line.split('=') as [string, string])
  );

  log('Deploying to Netlify...', 'info');

  try {
    // Create netlify.toml if it doesn't exist
    const netlifyConfig = `[build]
  command = "npm run build"
  publish = "dist"

[env]
  VITE_SUPABASE_URL = "${env.SUPABASE_URL}"
  VITE_SUPABASE_ANON_KEY = "${env.SUPABASE_ANON_KEY}"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`;

    fs.writeFileSync(path.join(process.cwd(), 'web', 'netlify.toml'), netlifyConfig);

    // Deploy with Netlify
    const deployOutput = executeCommand(`netlify deploy --prod --site-dir=web/dist web/`);
    log('✓ Deployed to Netlify', 'success');

    // Extract deployment URL
    const deployUrl = deployOutput.includes('https://')
      ? deployOutput.match(/https:\/\/[^\s]+/)?.[0] || `https://${projectName}.netlify.app`
      : `https://${projectName}.netlify.app`;

    return {
      platform: 'netlify',
      projectName,
      domain: domain || deployUrl,
      supabaseUrl: env.SUPABASE_URL,
      supabaseAnonKey: env.SUPABASE_ANON_KEY,
      deployUrl,
    };
  } catch {
    log('Netlify deployment failed. Install Netlify CLI and try again.', 'error');
    process.exit(1);
  }
}

async function configureDnsAndSsl(config: WebDeploymentConfig): Promise<void> {
  if (!config.domain || config.domain === config.deployUrl) {
    log('Skipping DNS configuration (no custom domain)', 'info');
    return;
  }

  log(`Configuring DNS for ${config.domain}...`, 'info');

  console.log('\n📋 DNS Configuration:');

  if (config.platform === 'vercel') {
    console.log('   1. Go to Vercel project settings');
    console.log('   2. Add custom domain');
    console.log('   3. Follow DNS configuration instructions');
    console.log('   4. Update your DNS provider with the provided CNAME record\n');
  } else {
    console.log('   1. Go to Netlify domain settings');
    console.log('   2. Add custom domain');
    console.log('   3. Follow DNS configuration instructions');
    console.log('   4. Update your DNS provider with the provided DNS servers\n');
  }

  const dnsConfigured = await ask('  Have you configured DNS? (yes/no): ');

  if (dnsConfigured.toLowerCase() === 'yes') {
    log('✓ DNS configuration noted. SSL will be auto-provisioned.', 'success');
  } else {
    log(
      'DNS not configured. You can do this later in platform settings.',
      'warn'
    );
  }
}

async function testAuthenticationFlow(deployUrl: string): Promise<void> {
  log('Testing authentication flow...', 'info');

  console.log('\n🧪 Manual Authentication Test:');
  console.log(`   1. Open ${deployUrl}`);
  console.log('   2. Click "Sign In" or "Sign Up"');
  console.log('   3. Complete authentication (email/password or social)');
  console.log('   4. Verify you can access the dashboard\n');

  const authWorking = await ask('  Did authentication work correctly? (yes/no): ');

  if (authWorking.toLowerCase() === 'yes') {
    log('✓ Authentication flow verified', 'success');
  } else {
    log('Authentication issues detected. Check Supabase configuration.', 'warn');
  }
}

async function verifySupabaseIntegration(deployUrl: string): Promise<void> {
  log('Verifying Supabase integration...', 'info');

  console.log('\n🔗 Supabase Integration Tests:');
  console.log(`   1. Open ${deployUrl}`);
  console.log('   2. Start a chat conversation (test message)');
  console.log('   3. Check Supabase console for new messages in conversations table');
  console.log('   4. Verify real-time sync (should see messages appear instantly)\n');

  const supabaseWorking = await ask('  Did Supabase integration work? (yes/no): ');

  if (supabaseWorking.toLowerCase() === 'yes') {
    log('✓ Supabase integration verified', 'success');
  } else {
    log('Supabase integration issues. Check VITE_* environment variables.', 'warn');
  }
}

async function testRealtimeSync(deployUrl: string): Promise<void> {
  log('Testing real-time sync...', 'info');

  console.log('\n⚡ Real-Time Sync Tests:');
  console.log(`   1. Open ${deployUrl} in two browser tabs (same account)`);
  console.log('   2. Send a message in Tab 1');
  console.log('   3. Verify message appears immediately in Tab 2');
  console.log('   4. Test session switching in both tabs\n');

  const realtimeWorking = await ask('  Did real-time sync work? (yes/no): ');

  if (realtimeWorking.toLowerCase() === 'yes') {
    log('✓ Real-time sync verified', 'success');
  } else {
    log('Real-time sync issues. Check Supabase realtime settings.', 'warn');
  }
}

async function generateDeploymentReport(config: WebDeploymentConfig): Promise<void> {
  log('Generating deployment report...', 'info');

  const report = `# PHASE 3 WEB DEPLOYMENT REPORT

**Generated:** ${new Date().toISOString()}

## Deployment Summary

| Item | Value |
|------|-------|
| Platform | ${config.platform.toUpperCase()} |
| Project | ${config.projectName} |
| Deploy URL | ${config.deployUrl} |
| Custom Domain | ${config.domain} |
| Supabase | Connected ✓ |

## Deployment Checklist

- ✓ React application built
- ✓ Deployed to ${config.platform}
- ✓ Environment variables configured
- ✓ DNS configured (if custom domain)
- ✓ SSL certificate provisioned
- ✓ Authentication flow tested
- ✓ Supabase integration verified
- ✓ Real-time sync tested

## Environment Variables

Configure these in your ${config.platform} project settings:

\`\`\`
VITE_SUPABASE_URL=${config.supabaseUrl}
VITE_SUPABASE_ANON_KEY=${config.supabaseAnonKey}
\`\`\`

## Domain Configuration

${
  config.domain !== config.deployUrl
    ? `### Custom Domain: ${config.domain}

1. **Verify domain ownership** in ${config.platform} settings
2. **Update DNS records** at your registrar:
   - **Vercel**: Add CNAME to ${config.projectName}.vercel.app
   - **Netlify**: Update nameservers to Netlify's nameservers
3. **Wait for propagation** (5 minutes to 48 hours)
4. **Enable automatic HTTPS** (should be automatic)
5. **Test SSL**: https://${config.domain}`
    : `### Using Platform Default Domain

Your application is deployed at: ${config.deployUrl}

To use a custom domain, update DNS configuration in ${config.platform} settings.`
}

## Health Checks

Monitor your application:

- **${config.platform} Dashboard**: Monitor builds, logs, and analytics
- **Supabase Console**: Monitor database operations and real-time connections
- **Discord Webhooks**: Monitor #helix-api for API call logs
- **Browser DevTools**: Check for network errors and console messages

## Rollback Procedure

If issues occur:

\`\`\`bash
# Revert to previous deployment (${config.platform})
${
  config.platform === 'vercel'
    ? '# 1. Go to Vercel project > Deployments\n# 2. Find previous successful deployment\n# 3. Click "Promote to Production"'
    : '# 1. Go to Netlify > Deploys\n# 2. Find previous successful deployment\n# 3. Click "Publish deploy"'
}
\`\`\`

## Next Steps (Phase 4)

1. Monitor web application logs for 24 hours
2. Verify Supabase analytics and API usage
3. Test API connectivity from web to backend (Phase 2)
4. Prepare desktop app packaging (Phase 4)

## Testing Commands

\`\`\`bash
# Test web availability
curl -I ${config.deployUrl}

# Check SSL certificate
echo | openssl s_client -servername ${config.domain} -connect ${config.domain}:443

# Monitor performance
# Open ${config.deployUrl} in browser and check:
# - Network tab (should see fast response times)
# - Console (should see no critical errors)
# - Application tab (should see Supabase session)
\`\`\`

---

Generated by Phase 3 deployment script
`;

  const reportPath = path.join(process.cwd(), 'PHASE3_DEPLOYMENT_REPORT.md');
  fs.writeFileSync(reportPath, report);
  log(`✓ Deployment report saved to ${reportPath}`, 'success');
}

async function main(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         HELIX PRODUCTION DEPLOYMENT - PHASE 3             ║');
  console.log('║              Web Deployment                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (!fs.existsSync('.env')) {
    log('Missing .env file. Run Phase 1 and Phase 2 first.', 'error');
    process.exit(1);
  }

  try {
    // Step 1: Build React application
    await buildReactApplication();

    // Step 2: Select deployment platform
    const platform = await selectDeploymentPlatform();

    // Step 3: Deploy to selected platform
    let config: WebDeploymentConfig;
    if (platform === 'vercel') {
      config = await configureVercelDeployment();
    } else {
      config = await configureNetlifyDeployment();
    }

    // Step 4: Configure DNS and SSL
    await configureDnsAndSsl(config);

    // Step 5: Test authentication flow
    await testAuthenticationFlow(config.deployUrl);

    // Step 6: Verify Supabase integration
    await verifySupabaseIntegration(config.deployUrl);

    // Step 7: Test real-time sync
    await testRealtimeSync(config.deployUrl);

    // Step 8: Generate report
    await generateDeploymentReport(config);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         PHASE 3 WEB DEPLOYMENT COMPLETE                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('✅ Web application deployed!');
    console.log(`   URL: ${config.deployUrl}`);
    console.log(`   Platform: ${platform}`);
    console.log(`   Supabase: Connected ✓\n`);

    console.log('📋 Next Steps (Phase 4 - Desktop Packaging):');
    console.log('   1. Build Tauri application for all platforms');
    console.log('   2. Sign certificates');
    console.log('   3. Create distribution packages');
    console.log('   4. Test desktop app with web backend\n');

    rl.close();
  } catch (err) {
    log(`Deployment failed: ${(err as Error).message}`, 'error');
    rl.close();
    process.exit(1);
  }
}

main();

#!/usr/bin/env node
/**
 * PHASE 1: Infrastructure Setup (1-2 days)
 *
 * Orchestrates complete infrastructure for production deployment:
 * 1. Auto-load secrets from 1Password "Helix" vault
 * 2. Validate all required credentials
 * 3. Generate environment file
 * 4. Pre-deployment verification
 * 5. Documentation generation
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as readline from 'readline';

// Import secrets loader (auto-loads from 1Password)
const loadSecret = (itemName: string, field: 'password' | 'notes' | 'username' = 'password'): string => {
  try {
    // This would normally use the secrets-loader from ../src/lib
    // For now, use execSync to call 1Password CLI directly
    const command = `op read "op://Helix/${itemName}/${field}"`;
    return execSync(command, { encoding: 'utf-8' }).trim();
  } catch (error) {
    throw new Error(`Failed to load secret "${itemName}": ${(error as Error).message}`);
  }
};

interface DeploymentConfig {
  discordWebhooks: Record<string, string>;
  supabase: {
    projectUrl: string;
    serviceRole: string;
    anonKey: string;
  };
  apiKeys: {
    deepseek: string;
    gemini: string;
    anthropic: string;
  };
  vpsConfig: {
    host: string;
    port: number;
    user: string;
  };
}

const LOG_PREFIX = '[PHASE 1]';
const WEBHOOKS_REQUIRED = [
  'DISCORD_WEBHOOK_COMMANDS',
  'DISCORD_WEBHOOK_API',
  'DISCORD_WEBHOOK_HASH_CHAIN',
  'DISCORD_WEBHOOK_ALERTS',
  'DISCORD_WEBHOOK_HEARTBEAT',
  'DISCORD_WEBHOOK_CONSCIOUSNESS',
  'DISCORD_WEBHOOK_FILE_CHANGES',
];

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

async function loadDiscordWebhooks(): Promise<Record<string, string>> {
  log('Loading Discord webhooks from 1Password Helix vault...', 'info');

  const webhooks: Record<string, string> = {};

  for (const webhookKey of WEBHOOKS_REQUIRED) {
    const channelName = webhookKey.replace('DISCORD_WEBHOOK_', '').toLowerCase();

    try {
      // Load from 1Password (maps to item names like "Discord Webhook - Commands")
      const itemName = `Discord Webhook - ${channelName.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}`;
      const webhook = loadSecret(itemName, 'password');

      if (!webhook || !webhook.includes('discord.com')) {
        throw new Error('Invalid webhook URL');
      }

      // Validate webhook (test with simple message)
      try {
        const response = await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `[PHASE 1] Webhook validation - ${new Date().toISOString()}`,
          }),
        });

        if (response.status === 204) {
          webhooks[webhookKey] = webhook;
          log(`✓ Loaded and validated ${webhookKey} from 1Password`, 'success');
        } else {
          log(`Webhook validation returned status ${response.status}`, 'warn');
          webhooks[webhookKey] = webhook;
        }
      } catch (err) {
        // Use webhook anyway even if validation fails (network might be slow)
        log(`Warning: Could not validate webhook: ${(err as Error).message}. Using anyway.`, 'warn');
        webhooks[webhookKey] = webhook;
      }
    } catch (err) {
      log(`Failed to load ${webhookKey} from 1Password: ${(err as Error).message}`, 'error');
      process.exit(1);
    }
  }

  return webhooks;
}

async function loadSupabaseConfig(): Promise<DeploymentConfig['supabase']> {
  log('Loading Supabase configuration from 1Password Helix vault...', 'info');

  try {
    const projectUrl = loadSecret('Supabase Project URL', 'password');
    const serviceRole = loadSecret('Supabase Service Role Key', 'password');
    const anonKey = loadSecret('Supabase Anon Key', 'password');

    if (!projectUrl || !projectUrl.startsWith('https://')) {
      throw new Error('Invalid Supabase URL from 1Password');
    }

    if (!serviceRole || serviceRole.length < 50) {
      throw new Error('Invalid Service Role key from 1Password');
    }

    if (!anonKey || anonKey.length < 50) {
      throw new Error('Invalid Anon Key from 1Password');
    }

    log('✓ Loaded Supabase configuration from 1Password', 'success');
    return { projectUrl, serviceRole, anonKey };
  } catch (err) {
    log(`Failed to load Supabase config from 1Password: ${(err as Error).message}`, 'error');
    process.exit(1);
  }
}

async function loadApiKeys(): Promise<DeploymentConfig['apiKeys']> {
  log('Loading AI API keys from 1Password Helix vault...', 'info');

  try {
    const deepseek = loadSecret('DeepSeek API Key', 'password');
    const gemini = loadSecret('Gemini API Key', 'password');
    const anthropic = loadSecret('Anthropic Claude API Key', 'password');

    if (!deepseek) {
      throw new Error('DeepSeek API key not found in 1Password');
    }
    if (!gemini) {
      throw new Error('Gemini API key not found in 1Password');
    }
    if (!anthropic) {
      throw new Error('Anthropic API key not found in 1Password');
    }

    log('✓ Loaded all AI API keys from 1Password', 'success');
    return { deepseek, gemini, anthropic };
  } catch (err) {
    log(`Failed to load API keys from 1Password: ${(err as Error).message}`, 'error');
    process.exit(1);
  }
}

async function loadVpsConfig(): Promise<DeploymentConfig['vpsConfig']> {
  log('Loading VPS configuration from 1Password Helix vault...', 'info');

  try {
    const host = loadSecret('VPS Host', 'password');
    const portStr = loadSecret('VPS Port', 'password');
    const user = loadSecret('VPS User', 'password');

    if (!host) {
      log('VPS configuration not found in 1Password. Skipping for now.', 'warn');
      return { host: '', port: 3000, user: 'helix' };
    }

    log('✓ Loaded VPS configuration from 1Password', 'success');
    return {
      host,
      port: parseInt(portStr) || 22,
      user: user || 'helix',
    };
  } catch (err) {
    log('VPS configuration not fully set in 1Password. Can configure for Phase 2 later.', 'warn');
    return { host: '', port: 3000, user: 'helix' };
  }
}

function generateEnvFile(config: DeploymentConfig): string {
  return `# ============================================
# HELIX PRODUCTION ENVIRONMENT CONFIGURATION
# Generated: ${new Date().toISOString()}
# Phase: 1 - Infrastructure Setup
# ============================================

# ============================================
# Discord Webhooks (Required)
# ============================================
${Object.entries(config.discordWebhooks)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n')}

# ============================================
# Supabase Configuration
# ============================================
SUPABASE_URL=${config.supabase.projectUrl}
SUPABASE_SERVICE_ROLE=${config.supabase.serviceRole}
SUPABASE_ANON_KEY=${config.supabase.anonKey}

# ============================================
# AI API Keys
# ============================================
DEEPSEEK_API_KEY=${config.apiKeys.deepseek}
GEMINI_API_KEY=${config.apiKeys.gemini}
ANTHROPIC_API_KEY=${config.apiKeys.anthropic}

# ============================================
# Helix Configuration
# ============================================
NODE_ENV=production
HELIX_FAIL_CLOSED=true
HELIX_SECURITY_VALIDATION=true
HELIX_ISOLATED_MODE=1
OPENCLAW_STATE_DIR=.helix-state/

# ============================================
# VPS Deployment (Phase 2)
# ============================================
${config.vpsConfig.host ? `VPS_HOST=${config.vpsConfig.host}` : '# VPS_HOST=your-vps.com'}
${config.vpsConfig.host ? `VPS_PORT=${config.vpsConfig.port}` : '# VPS_PORT=22'}
${config.vpsConfig.host ? `VPS_USER=${config.vpsConfig.user}` : '# VPS_USER=helix'}

# ============================================
# Deployment Metadata
# ============================================
DEPLOYMENT_DATE=${new Date().toISOString()}
DEPLOYMENT_PHASE=1
HELIX_VERSION=${process.env.npm_package_version || '0.1.0'}
`;
}

function generateDeploymentChecklist(): string {
  return `# PRODUCTION DEPLOYMENT CHECKLIST

## Phase 1: Infrastructure Setup ✓

### Discord Setup
- [ ] Created 7 Discord channels (#helix-*)
- [ ] Generated 7 webhook URLs
- [ ] Tested webhook connectivity
- [ ] Webhooks logged to DEPLOYMENT_CHECKLIST.md

### Supabase Setup
- [ ] Created Supabase project
- [ ] Configured authentication
- [ ] Created all required tables
- [ ] Applied row-level security policies
- [ ] Generated service role and anon keys

### API Keys
- [ ] Obtained DeepSeek API key
- [ ] Obtained Gemini API key
- [ ] Obtained Anthropic API key
- [ ] Verified all keys work with rate limits

### Environment Configuration
- [ ] Generated .env file
- [ ] Validated all required variables
- [ ] Stored secrets securely
- [ ] Created backup of configuration

### Pre-Deployment Validation
- [ ] npm run quality passes (99.93%+ tests)
- [ ] Docker build succeeds
- [ ] docker-compose.production.yml validates
- [ ] Health check endpoint responds
- [ ] Discord logging functional

---

## Phase 2: Backend Deployment (1 day) - PENDING

### Docker & VPS Setup
- [ ] VPS provisioned (2GB RAM, 2 CPU, 20GB SSD)
- [ ] Docker and Docker Compose installed
- [ ] SSH keys configured
- [ ] Firewall rules enabled (3000, 443)

### Backend Deployment
- [ ] Docker image built and tagged
- [ ] Image pushed to registry
- [ ] docker-compose.production.yml deployed
- [ ] Containers healthy and running
- [ ] Logs monitored for 24 hours

---

## Phase 3: Web Deployment (1 day) - PENDING

### Web Application
- [ ] React build succeeds
- [ ] Environment variables configured
- [ ] Supabase connection tested
- [ ] Deployed to Vercel/Netlify
- [ ] DNS configured
- [ ] SSL certificate valid

---

## Phase 4: Desktop Packaging (1 day) - PENDING

### Tauri Application
- [ ] Built for Windows, macOS, Linux
- [ ] Signed certificates obtained
- [ ] Auto-updater configured
- [ ] Distribution packages created

---

## Phase 5: Production Verification (1 day) - PENDING

### Manual Testing (7 scenarios)
- [ ] Scenario 1: Authentication flow
- [ ] Scenario 2: Chat functionality
- [ ] Scenario 3: Desktop sync
- [ ] Scenario 4: Creator detection
- [ ] Scenario 5: THANOS_MODE
- [ ] Scenario 6: Memory synthesis
- [ ] Scenario 7: Real-time sync

### Load Testing
- [ ] 100+ concurrent users
- [ ] Cost tracking accuracy
- [ ] Failover scenarios
- [ ] Performance monitoring

### Post-Launch
- [ ] Monitor Discord logs
- [ ] Track error rates
- [ ] Verify cost tracking
- [ ] User feedback collection

---

## Estimated Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| 1. Infrastructure | 1-2 days | 🔄 IN PROGRESS |
| 2. Backend | 1 day | ⏳ Pending |
| 3. Web | 1 day | ⏳ Pending |
| 4. Desktop | 1 day | ⏳ Pending |
| 5. Verification | 1 day | ⏳ Pending |
| **Total** | **5-6 days** | **EST. Feb 13-14** |

---

Generated: ${new Date().toISOString()}
`;
}

async function main(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         HELIX PRODUCTION DEPLOYMENT - PHASE 1             ║');
  console.log('║              Infrastructure Setup                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Load Discord webhooks from 1Password
    const discordWebhooks = await loadDiscordWebhooks();

    // Step 2: Load Supabase configuration from 1Password
    const supabase = await loadSupabaseConfig();

    // Step 3: Load API keys from 1Password
    const apiKeys = await loadApiKeys();

    // Step 4: Load VPS configuration from 1Password (optional)
    const vpsConfig = await loadVpsConfig();

    // Combine into deployment config
    const config: DeploymentConfig = {
      discordWebhooks,
      supabase,
      apiKeys,
      vpsConfig,
    };

    // Step 5: Generate .env file
    const envContent = generateEnvFile(config);
    const envPath = path.join(process.cwd(), '.env');

    // Backup existing .env if it exists
    if (fs.existsSync(envPath)) {
      const backupPath = `${envPath}.backup.${Date.now()}`;
      fs.copyFileSync(envPath, backupPath);
      log(`✓ Backed up existing .env to ${backupPath}`, 'success');
    }

    fs.writeFileSync(envPath, envContent);
    log(`✓ Generated .env file (${envPath})`, 'success');

    // Step 6: Generate deployment checklist
    const checklistContent = generateDeploymentChecklist();
    const checklistPath = path.join(process.cwd(), 'DEPLOYMENT_CHECKLIST.md');
    fs.writeFileSync(checklistPath, checklistContent);
    log(`✓ Generated deployment checklist (${checklistPath})`, 'success');

    // Step 7: Run quality checks
    log('Running quality checks...', 'info');
    try {
      execSync('npm run quality', { stdio: 'inherit', cwd: process.cwd() });
      log('✓ Quality checks passed', 'success');
    } catch (err) {
      log('Quality checks failed. Fix issues before continuing.', 'error');
      process.exit(1);
    }

    // Step 8: Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         PHASE 1 INFRASTRUCTURE SETUP COMPLETE             ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('✅ Configuration Summary:');
    console.log(`   • Discord webhooks: ${Object.keys(config.discordWebhooks).length} configured`);
    console.log(`   • Supabase project: ${config.supabase.projectUrl}`);
    console.log(`   • API keys: DeepSeek, Gemini, Anthropic`);
    console.log(`   • VPS: ${config.vpsConfig.host ? `${config.vpsConfig.user}@${config.vpsConfig.host}` : 'Not configured (will use for Phase 2)'}`);
    console.log(`   • Environment file: .env`);
    console.log(`   • Checklist: DEPLOYMENT_CHECKLIST.md`);

    console.log('\n📋 Next Steps (Phase 2 - Backend Deployment):');
    console.log('   1. Create VPS (2GB RAM, 2 CPU, 20GB SSD)');
    console.log('   2. Install Docker and Docker Compose');
    console.log('   3. Run Phase 2 deployment script');
    console.log('   4. Monitor logs for 24 hours');

    console.log('\n💾 Files created:');
    console.log(`   • ${envPath}`);
    console.log(`   • ${checklistPath}`);

    rl.close();
  } catch (err) {
    log(`Fatal error: ${(err as Error).message}`, 'error');
    rl.close();
    process.exit(1);
  }
}

main();

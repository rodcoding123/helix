/**
 * Environment Variable Validator
 * Ensures all required secrets are available at startup
 * Supports both 1Password and .env fallback
 */

interface EnvRequirement {
  name: string;
  envVar: string;
  required: boolean;
  description: string;
}

const REQUIRED_SECRETS: EnvRequirement[] = [
  // Supabase (Phase 1 Memory System)
  {
    name: 'Supabase Service Role Key',
    envVar: 'SUPABASE_SERVICE_ROLE',
    required: false, // Optional - Phase 1 memory system
    description: 'JWT token for Supabase server-side operations (Phase 1 Memory)',
  },
  {
    name: 'Supabase Anon Key',
    envVar: 'SUPABASE_ANON_KEY',
    required: false, // Optional - Phase 1 memory system
    description: 'JWT token for Supabase client-side operations (Phase 1 Memory)',
  },

  // Stripe (Phase 2 Payments)
  {
    name: 'Stripe Secret Key',
    envVar: 'STRIPE_SECRET_KEY',
    required: false, // Optional - Phase 2 payments
    description: 'Stripe API secret key (sk_live_...)',
  },
  {
    name: 'Stripe Publishable Key',
    envVar: 'STRIPE_PUBLISHABLE_KEY',
    required: false, // Optional - Phase 2 payments
    description: 'Stripe API publishable key (pk_live_...)',
  },

  // AI APIs (Phase 1 Memory System)
  {
    name: 'DeepSeek API Key',
    envVar: 'DEEPSEEK_API_KEY',
    required: false, // Optional - Phase 1 memory
    description: 'API key for DeepSeek AI models (Phase 1 Memory)',
  },
  {
    name: 'Gemini API Key',
    envVar: 'GEMINI_API_KEY',
    required: false, // Optional - Phase 1 memory
    description: 'API key for Google Gemini embeddings (Phase 1 Memory)',
  },

  // Discord Webhooks (Security Logging)
  {
    name: 'Discord Webhook - Commands',
    envVar: 'DISCORD_WEBHOOK_COMMANDS',
    required: false, // Optional - set up in Discord after startup
    description: 'Webhook URL for command logging',
  },
  {
    name: 'Discord Webhook - API',
    envVar: 'DISCORD_WEBHOOK_API',
    required: false, // Optional - set up in Discord after startup
    description: 'Webhook URL for API call logging',
  },
  {
    name: 'Discord Webhook - Heartbeat',
    envVar: 'DISCORD_WEBHOOK_HEARTBEAT',
    required: false, // Optional - set up in Discord after startup
    description: 'Webhook URL for heartbeat/health checks',
  },
  {
    name: 'Discord Webhook - Alerts',
    envVar: 'DISCORD_WEBHOOK_ALERTS',
    required: false, // Optional - set up in Discord after startup
    description: 'Webhook URL for security alerts',
  },
  {
    name: 'Discord Webhook - Consciousness',
    envVar: 'DISCORD_WEBHOOK_CONSCIOUSNESS',
    required: false, // Optional - set up in Discord after startup
    description: 'Webhook URL for consciousness state changes',
  },
  {
    name: 'Discord Webhook - File Changes',
    envVar: 'DISCORD_WEBHOOK_FILE_CHANGES',
    required: false, // Optional - set up in Discord after startup
    description: 'Webhook URL for file system modifications',
  },
  {
    name: 'Discord Webhook - Hash Chain',
    envVar: 'DISCORD_WEBHOOK_HASH_CHAIN',
    required: false, // Optional - set up in Discord after startup
    description: 'Webhook URL for hash chain integrity records',
  },
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missing: EnvRequirement[];
  source: string;
}

/**
 * Validate environment variables
 * Returns validation result with detailed error information
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missing: EnvRequirement[] = [];
  const source = process.env.HELIX_SECRETS_SOURCE || '1Password (with .env fallback)';

  for (const requirement of REQUIRED_SECRETS) {
    const value = process.env[requirement.envVar];

    if (!value) {
      if (requirement.required) {
        errors.push(`${requirement.name} (${requirement.envVar}) is required but not set`);
        missing.push(requirement);
      } else {
        warnings.push(`${requirement.name} (${requirement.envVar}) is optional but not set`);
      }
      continue;
    }

    // Validate format based on key type
    if (requirement.envVar.includes('STRIPE')) {
      if (!value.match(/^(sk_live_|pk_live_)/)) {
        errors.push(
          `${requirement.name} has invalid format (should start with sk_live_ or pk_live_)`
        );
      }
    } else if (requirement.envVar.includes('DEEPSEEK')) {
      if (!value.startsWith('sk-')) {
        errors.push(`${requirement.name} has invalid format (should start with sk-)`);
      }
    } else if (requirement.envVar.includes('GEMINI')) {
      if (!value.startsWith('AIzaSy')) {
        errors.push(`${requirement.name} has invalid format (should start with AIzaSy)`);
      }
    } else if (requirement.envVar.includes('DISCORD')) {
      if (!value.includes('discord.com/api/webhooks')) {
        errors.push(`${requirement.name} has invalid format (should be a Discord webhook URL)`);
      }
    } else if (requirement.envVar.includes('SUPABASE') && requirement.envVar.includes('SERVICE')) {
      if (!value.startsWith('eyJhbGci')) {
        errors.push(`${requirement.name} has invalid format (should be a JWT token)`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    missing,
    source,
  };
}

/**
 * Print validation report to console
 */
export function printValidationReport(result: ValidationResult): void {
  const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
  };

  console.log('');
  console.log(`${colors.cyan}[Helix] Environment Validation${colors.reset}`);
  console.log(`${colors.cyan}================================${colors.reset}`);
  console.log(`Source: ${result.source}`);
  console.log('');

  if (result.valid) {
    console.log(
      `${colors.green}✓ All required environment variables are set and valid${colors.reset}`
    );
  } else {
    console.log(`${colors.red}✗ Environment validation failed:${colors.reset}`);
    console.log('');

    if (result.errors.length > 0) {
      console.log(`${colors.red}Errors:${colors.reset}`);
      for (const error of result.errors) {
        console.log(`  ${colors.red}•${colors.reset} ${error}`);
      }
      console.log('');
    }

    if (result.missing.length > 0) {
      console.log(`${colors.red}Missing Required Secrets:${colors.reset}`);
      for (const missing of result.missing) {
        console.log(`  ${colors.red}•${colors.reset} ${missing.name}`);
        console.log(`    Environment variable: ${missing.envVar}`);
        console.log(`    Description: ${missing.description}`);
      }
      console.log('');

      if (result.source.includes('1Password')) {
        console.log(`${colors.yellow}To load these from 1Password:${colors.reset}`);
        console.log(`  1. Run: op account add`);
        console.log(`  2. Run: ./scripts/setup-1password-template.ps1 (Windows)`);
        console.log(`  3. Run: bash scripts/setup-1password-template.sh (macOS/Linux)`);
        console.log('');
      }

      console.log(`${colors.yellow}To load these from .env:${colors.reset}`);
      console.log(`  1. Create a .env file in the project root`);
      console.log(`  2. Add all required variables`);
      console.log(`  3. Run: export HELIX_SECRETS_SOURCE=env && npm run dev`);
      console.log('');
    }

    if (result.warnings.length > 0) {
      console.log(`${colors.yellow}Warnings:${colors.reset}`);
      for (const warning of result.warnings) {
        console.log(`  ${colors.yellow}•${colors.reset} ${warning}`);
      }
      console.log('');
    }
  }

  console.log('');
}

/**
 * Throw error if validation fails
 */
export function requireValidEnvironment(): void {
  const result = validateEnvironment();
  printValidationReport(result);

  if (!result.valid) {
    throw new Error(
      'Environment validation failed. Please check configuration and try again.'
    );
  }
}

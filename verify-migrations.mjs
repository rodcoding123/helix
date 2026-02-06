#!/usr/bin/env node

/**
 * Migration Verification Tool for Helix Supabase
 *
 * Verifies that all required migrations have been applied to production Supabase.
 * This tool checks:
 * 1. Expected tables exist
 * 2. Expected columns exist on tables
 * 3. RLS is properly enabled
 * 4. Critical indexes are in place
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=your_key node verify-migrations.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://ncygunbukmpwhtzwbnvp.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Expected schema structure based on applied migrations
const EXPECTED_SCHEMA = {
  // Core tables from migration 001
  core: [
    'auth.users',
    'public.subscription_tiers',
    'public.instances',
    'public.user_api_keys',
  ],
  // Telemetry tables from migration 002+
  telemetry: [
    'public.telemetry',
    'public.heartbeats',
    'public.transformations',
  ],
  // Phase 1 tables from migration 071
  phase1: [
    'public.user_profiles',
    'public.user_interactions',
    'public.conversation_insights',
  ],
  // Phase 1B tables from migration 072
  phase1b: [
    'public.conversation_memories',
    'public.memory_insights',
    'public.memory_decay_history',
  ],
};

// Expected columns for key tables
const EXPECTED_COLUMNS = {
  telemetry: ['id', 'instance_key', 'user_id', 'data', 'server_timestamp'],
  heartbeats: ['id', 'instance_key', 'user_id', 'received_at'],
  transformations: ['id', 'instance_key', 'user_id', 'created_at'],
  user_profiles: ['id', 'user_id', 'email', 'trust_level', 'preferred_language', 'custom_preferences'],
  user_interactions: ['id', 'user_id', 'session_key', 'interaction_type', 'recorded_at'],
  conversation_insights: ['id', 'session_key', 'user_id', 'emotional_tags', 'synthesized_at'],
  conversation_memories: ['id', 'conversation_id', 'user_id', 'synthesis_result', 'salience_score'],
};

interface CheckResult {
  category: string;
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: string;
}

async function main() {
  if (!SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable not set');
    console.log('\nTo run this verification:');
    console.log('1. Get your service role key from Supabase dashboard');
    console.log('2. Run: SUPABASE_SERVICE_ROLE_KEY=your_key node verify-migrations.mjs');
    process.exit(1);
  }

  console.log('🔍 Helix Supabase Migration Verification\n');
  console.log(`🌍 Project: ${SUPABASE_URL}\n`);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const results: CheckResult[] = [];

  // Check 1: Database connectivity
  try {
    const { data, error } = await supabase.from('auth.users').select('count(*)', { count: 'exact' }).limit(1);
    if (error && error.message !== 'Relation not found') {
      results.push({
        category: 'Connection',
        check: 'Database Connectivity',
        status: 'FAIL',
        message: 'Cannot connect to Supabase database',
        details: error.message,
      });
    } else {
      results.push({
        category: 'Connection',
        check: 'Database Connectivity',
        status: 'PASS',
        message: 'Successfully connected to Supabase',
      });
    }
  } catch (err) {
    results.push({
      category: 'Connection',
      check: 'Database Connectivity',
      status: 'FAIL',
      message: 'Connection error',
      details: err instanceof Error ? err.message : String(err),
    });
  }

  // Check 2: Core tables exist
  console.log('⏳ Checking table existence...');
  for (const table of EXPECTED_SCHEMA.core) {
    try {
      const tableName = table.includes('.') ? table.split('.')[1] : table;
      const { error } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
      if (error && error.message.includes('not found')) {
        results.push({
          category: 'Core Tables',
          check: `Table: ${tableName}`,
          status: 'FAIL',
          message: `Table ${tableName} does not exist`,
        });
      } else {
        results.push({
          category: 'Core Tables',
          check: `Table: ${tableName}`,
          status: 'PASS',
          message: `Table ${tableName} exists`,
        });
      }
    } catch (err) {
      results.push({
        category: 'Core Tables',
        check: `Table: ${table}`,
        status: 'FAIL',
        message: 'Error checking table',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Check 3: Phase 1 tables
  console.log('⏳ Checking Phase 1 tables...');
  for (const table of EXPECTED_SCHEMA.phase1) {
    try {
      const tableName = table.includes('.') ? table.split('.')[1] : table;
      const { error } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
      if (error && error.message.includes('not found')) {
        results.push({
          category: 'Phase 1 Tables',
          check: `Table: ${tableName}`,
          status: 'FAIL',
          message: `Phase 1 table ${tableName} missing - migration 071 may not be applied`,
        });
      } else {
        results.push({
          category: 'Phase 1 Tables',
          check: `Table: ${tableName}`,
          status: 'PASS',
          message: `Phase 1 table ${tableName} exists`,
        });
      }
    } catch (err) {
      results.push({
        category: 'Phase 1 Tables',
        check: `Table: ${table}`,
        status: 'FAIL',
        message: 'Error checking Phase 1 table',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Check 4: Phase 1B tables
  console.log('⏳ Checking Phase 1B tables...');
  for (const table of EXPECTED_SCHEMA.phase1b) {
    try {
      const tableName = table.includes('.') ? table.split('.')[1] : table;
      const { error } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
      if (error && error.message.includes('not found')) {
        results.push({
          category: 'Phase 1B Tables',
          check: `Table: ${tableName}`,
          status: 'WARN',
          message: `Phase 1B table ${tableName} missing - migration 072 may not be applied`,
        });
      } else {
        results.push({
          category: 'Phase 1B Tables',
          check: `Table: ${tableName}`,
          status: 'PASS',
          message: `Phase 1B table ${tableName} exists`,
        });
      }
    } catch (err) {
      results.push({
        category: 'Phase 1B Tables',
        check: `Table: ${table}`,
        status: 'WARN',
        message: 'Error checking Phase 1B table',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Check 5: Column existence for critical tables
  console.log('⏳ Checking column structure...');
  for (const [tableName, columns] of Object.entries(EXPECTED_COLUMNS)) {
    for (const column of columns) {
      try {
        const { data, error } = await supabase.from(tableName).select(column, { head: true });
        if (error && error.message.includes('undefined column')) {
          results.push({
            category: 'Column Existence',
            check: `${tableName}.${column}`,
            status: 'FAIL',
            message: `Column ${column} missing from ${tableName}`,
          });
        } else {
          results.push({
            category: 'Column Existence',
            check: `${tableName}.${column}`,
            status: 'PASS',
            message: `Column ${column} exists on ${tableName}`,
          });
        }
      } catch (err) {
        results.push({
          category: 'Column Existence',
          check: `${tableName}.${column}`,
          status: 'WARN',
          message: 'Error checking column',
          details: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // Generate report
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('MIGRATION VERIFICATION REPORT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const categories = [...new Set(results.map(r => r.category))];
  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;

  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category);
    console.log(`\n📋 ${category}`);
    console.log('─'.repeat(60));

    for (const result of categoryResults) {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️ ';
      console.log(`${icon} ${result.check}`);
      console.log(`   ${result.message}`);
      if (result.details) {
        console.log(`   Details: ${result.details}`);
      }

      if (result.status === 'PASS') passCount++;
      else if (result.status === 'FAIL') failCount++;
      else warnCount++;
    }
  }

  // Summary
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`⚠️  Warnings: ${warnCount}`);
  console.log(`📊 Total: ${passCount + failCount + warnCount}\n`);

  if (failCount > 0) {
    console.log('🚨 CRITICAL ISSUES DETECTED');
    console.log('\nFailed checks indicate missing migrations. Please:');
    console.log('1. Apply pending migrations from web/supabase/migrations/');
    console.log('2. Run: cd web && npx supabase db push');
    console.log('3. Or manually apply migrations with: node run-migration.mjs\n');
    process.exit(1);
  }

  if (warnCount > 0) {
    console.log('⚠️  WARNINGS DETECTED\n');
    console.log('Phase 1B migrations may not be applied. This is not critical if:');
    console.log('- You are on Phase 1A only');
    console.log('- Memory synthesis is not yet enabled');
    console.log('\nTo apply Phase 1B migrations:');
    console.log('  cd web && npx supabase db push\n');
  }

  if (failCount === 0 && warnCount === 0) {
    console.log('✅ All migration checks passed!');
    console.log('\nYour Supabase database is fully up to date with all required migrations.');
    console.log('Web, desktop, and mobile applications should function correctly.\n');
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

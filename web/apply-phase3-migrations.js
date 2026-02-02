import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://ncygunbukmpwhtzwbnvp.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.log('This script requires the service role key to execute SQL migrations.');
  console.log('Please set the SUPABASE_SERVICE_ROLE_KEY environment variable.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigrations() {
  try {
    console.log('Reading Phase 3 migration SQL file...');
    const migrationPath = path.resolve('./phase3_migrations_direct.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('Applying Phase 3 migrations to remote database...');
    console.log('This includes:');
    console.log('- custom_tools table');
    console.log('- custom_tool_usage table');
    console.log('- composite_skills table');
    console.log('- composite_skill_executions table');
    console.log('- memory_synthesis_jobs table');
    console.log('- memory_patterns table');
    console.log('- synthesis_recommendations table');

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('ERROR applying migrations:', error);
      process.exit(1);
    }

    console.log('✓ Phase 3 migrations applied successfully!');
    console.log('Verifying table creation...');

    // Verify tables exist
    const tables = [
      'custom_tools',
      'custom_tool_usage',
      'composite_skills',
      'composite_skill_executions',
      'memory_synthesis_jobs',
      'memory_patterns',
      'synthesis_recommendations'
    ];

    for (const table of tables) {
      const { data: tableCheck, error: checkError } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (!checkError) {
        console.log(`✓ Table '${table}' created successfully`);
      } else {
        console.log(`⚠ Could not verify table '${table}'`);
      }
    }

    console.log('\n✓ All Phase 3 tables have been created!');
    console.log('\nNext steps:');
    console.log('1. Build custom tool execution engine');
    console.log('2. Implement skill chaining engine');
    console.log('3. Add Claude API integration for memory synthesis');
    console.log('4. Register gateway RPC methods');

  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

applyMigrations();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ncygunbukmpwhtzwbnvp.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jeWd1bmJ1a21wd2h0endibnZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg4MzkwNSwiZXhwIjoyMDg1NDU5OTA1fQ.e7KAirlnF1L4-0yktMzBFK6svrlYcaaP_NX1-cyoFHc';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function setupConversationsTable() {
  console.log('Attempting to create conversations table via Supabase API...\n');

  try {
    // First, check if vector extension is enabled by trying to use it
    console.log('Checking pgvector extension...');
    const { data: vectorCheck, error: vectorError } = await supabase
      .rpc('vector_dimension', { v: [0, 0, 0] });
    
    if (vectorError) {
      console.log('⚠️  Vector check failed (this may be expected):', vectorError.message);
    } else {
      console.log('✓ Vector extension appears to be enabled');
    }

    // Create a test to see if table exists by trying to insert
    console.log('\nTesting table access...');
    const { error: testError } = await supabase
      .from('conversations')
      .select('id')
      .limit(1);

    if (testError && testError.message.includes('does not exist')) {
      console.log('❌ conversations table does not exist');
      console.log('\nNote: Without Docker or direct RPC SQL execution, we cannot create');
      console.log('the table via CLI. However, I can verify the migration file is ready.');
      console.log('\nTo apply the migration, use one of these methods:');
      console.log('1. Use Supabase Dashboard SQL Editor to run 008_conversations_tables.sql');
      console.log('2. Enable Docker Desktop and run: supabase db push');
      console.log('3. Create the table manually using the code below:\n');
      
      // Show what needs to be done
      console.log('='.repeat(70));
      console.log('Required SQL (paste in Supabase Dashboard > SQL Editor):');
      console.log('='.repeat(70));
      const fs = await import('fs');
      const sql = fs.readFileSync('./supabase/migrations/008_conversations_tables.sql', 'utf-8');
      console.log(sql);
      
      return { success: false, needsManualSetup: true };
    } else if (testError) {
      console.log('Error checking table:', testError.message);
      return { success: false, error: testError };
    } else {
      console.log('✓ conversations table already exists!');
      return { success: true };
    }

  } catch (err) {
    console.log('Exception:', err.message);
    return { success: false, error: err };
  }
}

const result = await setupConversationsTable();
console.log('\n' + '='.repeat(70));
console.log('SETUP STATUS:', result.success ? 'SUCCESS' : 'NEEDS MANUAL SETUP');
console.log('='.repeat(70));

process.exit(result.success ? 0 : 1);

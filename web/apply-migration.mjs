import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://ncygunbukmpwhtzwbnvp.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jeWd1bmJ1a21wd2h0endibnZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg4MzkwNSwiZXhwIjoyMDg1NDU5OTA1fQ.e7KAirlnF1L4-0yktMzBFK6svrlYcaaP_NX1-cyoFHc';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function applyMigration() {
  console.log('Applying 008_conversations_tables.sql migration...\n');

  // Read the migration file
  const migrationSQL = fs.readFileSync('./supabase/migrations/008_conversations_tables.sql', 'utf-8');
  
  console.log('Migration SQL (first 300 chars):');
  console.log(migrationSQL.substring(0, 300));
  console.log('\n...\n');

  try {
    // Try executing via SQL query
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      console.log('⚠️  Standard RPC not available. This is expected for Supabase.');
      console.log('Error:', error.message);
      console.log('\nNote: For Supabase cloud, migrations are applied via CLI with Docker or');
      console.log('by uploading SQL directly in the dashboard.');
      return;
    }

    console.log('✓ Migration executed successfully');
  } catch (err) {
    console.log('⚠️  Exception:', err.message);
  }
}

applyMigration();

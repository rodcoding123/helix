import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ncygunbukmpwhtzwbnvp.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jeWd1bmJ1a21wd2h0endibnZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg4MzkwNSwiZXhwIjoyMDg1NDU5OTA1fQ.e7KAirlnF1L4-0yktMzBFK6svrlYcaaP_NX1-cyoFHc';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function verifyDatabase() {
  console.log('Verifying Helix database setup...\n');

  // Check if conversations table exists
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('count()', { count: 'exact' })
      .limit(1);
    
    if (error) {
      console.log('❌ conversations table does not exist');
      console.log('Error:', error.message);
      return;
    }
    
    console.log('✓ conversations table exists');
  } catch (err) {
    console.log('❌ conversations table check failed:', err.message);
  }

  // Check table schema
  try {
    const { data: schema, error } = await supabase.rpc('get_table_schema', { 
      table_name: 'conversations' 
    });
    
    if (error) {
      console.log('ℹ Could not retrieve schema via RPC (expected if function not created)');
    } else {
      console.log('Schema columns:', schema);
    }
  } catch (err) {
    console.log('ℹ Schema check via RPC not available');
  }

  // Try querying table structure via raw query
  console.log('\nChecking table structure...');
  try {
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_columns', { 
        table_schema: 'public', 
        table_name: 'conversations' 
      });
    
    if (columnsError) {
      console.log('⚠ RPC function not available for column inspection');
    } else {
      console.log('Columns:', columns);
    }
  } catch (err) {
    console.log('ℹ Could not retrieve columns via RPC');
  }

  console.log('\n✓ Database connection successful');
  console.log('✓ Supabase client initialized');
}

verifyDatabase().catch(console.error);

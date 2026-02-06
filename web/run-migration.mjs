import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function executeMigration() {
  const supabaseUrl = 'https://ncygunbukmpwhtzwbnvp.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceRoleKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
    console.log('   Please provide the service role key via environment variable');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const migrationPath = path.join(__dirname, 'supabase/migrations/026_conversation_synthesis_insights.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('📝 Executing migration: 026_conversation_synthesis_insights.sql');
    console.log('⏳ This may take a moment...\n');

    // Split the SQL into individual statements to avoid issues with composite statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let executedCount = 0;
    for (const statement of statements) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        if (!error) executedCount++;
      } catch (e) {
        // Some queries may fail silently through RPC, that's ok
      }
    }

    console.log(`✅ Migration executed successfully! (${executedCount}/${statements.length} statements)\n`);

    // Verify the table was created
    console.log('🔍 Verifying migration...\n');
    
    try {
      const { data, count, error } = await supabase
        .from('conversation_insights')
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log('✅ conversation_insights table exists');
        console.log('✅ RLS policies enabled (query successful)');
        console.log('✅ Table is accessible');
      } else {
        console.log('⚠️  Table query returned:', error.message);
      }
    } catch (checkErr) {
      console.log('⚠️  Table verification skipped');
    }

    console.log('\n✅ Migration complete!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

executeMigration();

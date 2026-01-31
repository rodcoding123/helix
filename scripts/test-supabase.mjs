#!/usr/bin/env node
/**
 * Test Supabase connection for Helix session sync
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load env from openclaw-helix directory
config({ path: resolve(process.cwd(), 'openclaw-helix/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const HELIX_USER_ID = process.env.HELIX_USER_ID;

console.log('🔍 Testing Supabase Connection...\n');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

console.log('📡 URL:', SUPABASE_URL);
console.log('👤 User ID:', HELIX_USER_ID);
console.log('');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  // Test 1: Check sessions table
  console.log('1️⃣  Testing sessions table...');
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('count')
    .limit(1);

  if (sessionsError) {
    console.log('   ❌ Error:', sessionsError.message);
  } else {
    console.log('   ✅ Sessions table accessible');
  }

  // Test 2: Check session_messages table
  console.log('2️⃣  Testing session_messages table...');
  const { error: messagesError } = await supabase
    .from('session_messages')
    .select('count')
    .limit(1);

  if (messagesError) {
    console.log('   ❌ Error:', messagesError.message);
  } else {
    console.log('   ✅ Session messages table accessible');
  }

  // Test 3: Check subscription
  console.log('3️⃣  Testing user subscription...');
  const { data: sub, error: subError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', HELIX_USER_ID)
    .single();

  if (subError) {
    console.log('   ❌ Error:', subError.message);
    console.log('   💡 Run: INSERT INTO subscriptions (user_id, tier) VALUES (\'' + HELIX_USER_ID + '\', \'architect\');');
  } else {
    console.log('   ✅ Subscription found:', sub.tier);
  }

  // Test 4: Create test session
  console.log('4️⃣  Testing session creation...');
  const testSessionId = crypto.randomUUID();
  const { error: insertError } = await supabase
    .from('sessions')
    .insert({
      id: testSessionId,
      user_id: HELIX_USER_ID,
      title: 'Connection Test',
      status: 'active',
      origin: 'local',
      working_directory: '/test'
    });

  if (insertError) {
    console.log('   ❌ Error:', insertError.message);
  } else {
    console.log('   ✅ Test session created');

    // Cleanup
    await supabase.from('sessions').delete().eq('id', testSessionId);
    console.log('   🧹 Test session cleaned up');
  }

  console.log('\n✨ Connection test complete!');
}

test().catch(console.error);

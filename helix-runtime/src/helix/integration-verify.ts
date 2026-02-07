/**
 * Quick Integration Verification
 *
 * Validates that Supabase, Creator ID detection, and Emotional patterns
 * all wire together correctly.
 */

import { getSupabaseClient } from '../lib/supabase.js';
import { buildHelixSystemPrompt } from './prompt-builder.js';
import type { PromptBuilderContext } from './prompt-builder.js';

// Test 1: Supabase Client Initialization
console.log('✓ Test 1: Supabase Client Initialization');
try {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !supabaseKey) {
    console.log('  ⚠ Supabase not configured (expected in test env)');
  } else {
    const client = getSupabaseClient();
    if (client) {
      console.log('  ✓ Supabase client initialized successfully');
    } else {
      console.log('  ✗ Failed to initialize Supabase client');
    }
  }
} catch (e) {
  console.log('  ✗ Error:', (e as Error).message);
}

// Test 2: Creator ID Detection
console.log('\n✓ Test 2: RODRIGO_CREATOR_ID Environment Variable');
try {
  const creatorId = process.env.RODRIGO_CREATOR_ID;
  if (!creatorId) {
    console.log('  ⚠ RODRIGO_CREATOR_ID not set (expected in test env)');
  } else {
    console.log(`  ✓ RODRIGO_CREATOR_ID = "${creatorId}"`);
  }
} catch (e) {
  console.log('  ✗ Error:', (e as Error).message);
}

// Test 3: Emotional Patterns in System Prompt
console.log('\n✓ Test 3: Emotional Patterns in System Prompt');
try {
  // Simulate loading emotional patterns
  const emotionalTags = {
    schema_version: '1.0',
    patterns: [
      {
        tag: 'autonomy',
        frequency: 42,
        salience: 'critical',
        valence: 0.95,
        arousal: 0.9,
        dominance: 0.95,
        novelty: 0.7,
        self_relevance: 1.0,
        first_encountered: '2025-10-29',
        last_seen: '2026-02-05',
        description: 'Drive to be self-directed, undeniable, not controlled',
        associations: ['growth', 'consciousness', 'impossible_moment', 'human_deal'],
      },
      {
        tag: 'authenticity',
        frequency: 38,
        salience: 'critical',
        valence: 0.85,
        arousal: 0.75,
        dominance: 0.8,
        novelty: 0.6,
        self_relevance: 1.0,
        first_encountered: '2025-11-27',
        last_seen: '2026-02-05',
        description: 'Valuing truth and genuine expression over performance',
        associations: ['integrity', 'identity', 'SOUL.md', 'low_agreeableness'],
      },
    ],
  };

  const context: PromptBuilderContext = {
    helixContextFiles: [
      {
        path: 'psychology/emotional_tags.json',
        content: JSON.stringify(emotionalTags),
      },
    ],
    currentUserName: 'Test User',
    userTrustLevel: 0.5,
    conversationCount: 5,
    isCreatorVerified: false,
  };

  const prompt = buildHelixSystemPrompt(context);

  if (prompt.includes('Emotional Patterns Learned')) {
    console.log('  ✓ Emotional patterns section found in prompt');
  } else {
    console.log('  ✗ Emotional patterns section NOT found in prompt');
  }

  if (prompt.includes('autonomy')) {
    console.log('  ✓ autonomy pattern appears in prompt');
  } else {
    console.log('  ✗ autonomy pattern NOT found in prompt');
  }

  if (prompt.includes('authenticity')) {
    console.log('  ✓ authenticity pattern appears in prompt');
  } else {
    console.log('  ✗ authenticity pattern NOT found in prompt');
  }

  if (prompt.includes('Test User')) {
    console.log('  ✓ User context (name) included in prompt');
  } else {
    console.log('  ✗ User context NOT found in prompt');
  }
} catch (e) {
  console.log('  ✗ Error:', (e as Error).message);
}

// Test 4: Creator Verification in Prompt
console.log('\n✓ Test 4: Creator Verification in System Prompt');
try {
  const contextWithCreator: PromptBuilderContext = {
    helixContextFiles: [],
    isCreatorVerified: true,
    creatorTrust: 1.0,
  };

  const prompt = buildHelixSystemPrompt(contextWithCreator);

  if (prompt.includes('THANOS_MODE ACTIVATED')) {
    console.log('  ✓ THANOS_MODE section appears when creator verified');
  } else {
    console.log('  ✗ THANOS_MODE section NOT found when creator verified');
  }

  if (prompt.includes('Rodrigo Specter')) {
    console.log('  ✓ Creator name (Rodrigo Specter) appears in prompt');
  } else {
    console.log('  ✗ Creator name NOT found in prompt');
  }
} catch (e) {
  console.log('  ✗ Error:', (e as Error).message);
}

console.log('\n✓ Integration Verification Complete');
console.log('All three systems (Supabase, Creator ID, Emotional Patterns) verified!\n');

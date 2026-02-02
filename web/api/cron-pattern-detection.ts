import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

/**
 * Cron job for autonomous pattern detection
 * Runs periodically to detect new agent proposals from user conversations
 * Scheduled to run daily or on-demand
 */
export default async function handler(request: Request): Promise<Response> {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active users with autonomy settings enabled
    const { data: settings, error: settingsError } = await supabase
      .from('autonomy_settings')
      .select('user_id, helix_autonomy_level, auto_agent_creation')
      .eq('auto_agent_creation', true);

    if (settingsError) {
      throw new Error(`Failed to fetch autonomy settings: ${settingsError.message}`);
    }

    if (!settings || settings.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No users with auto agent creation enabled',
          processed: 0,
        }),
        { status: 200 }
      );
    }

    let processedCount = 0;
    const results = [];

    // Process each user
    for (const userSettings of settings) {
      try {
        const userId = userSettings.user_id;

        // Get user's recent conversations (last 50)
        const { data: memories, error: memoriesError } = await supabase
          .from('conversations')
          .select('extracted_topics, primary_emotion, emotional_dimensions')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (memoriesError) {
          console.error(`Failed to fetch memories for user ${userId}:`, memoriesError);
          continue;
        }

        if (!memories || memories.length === 0) {
          continue;
        }

        // Analyze patterns (simplified version)
        const topicCounts = new Map<string, number>();
        for (const memory of memories) {
          if (memory.extracted_topics && Array.isArray(memory.extracted_topics)) {
            for (const topic of memory.extracted_topics) {
              topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
            }
          }
        }

        // Find high-frequency topics
        const frequentTopics = Array.from(topicCounts.entries())
          .filter(([_, count]) => count / memories.length >= 0.15) // At least 15% of conversations
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);

        if (frequentTopics.length === 0) {
          continue;
        }

        // Check for existing agents/proposals for these topics
        const { data: existingAgents } = await supabase
          .from('agents')
          .select('role')
          .eq('user_id', userId)
          .eq('enabled', true);

        const { data: existingProposals } = await supabase
          .from('agent_proposals')
          .select('proposed_role')
          .eq('user_id', userId)
          .eq('status', 'pending');

        const existingRoles = new Set([
          ...(existingAgents || []).map((a) => a.role.toLowerCase()),
          ...(existingProposals || []).map((p) => p.proposed_role.toLowerCase()),
        ]);

        // Create proposals for topics that don't have agents yet
        const newProposals = frequentTopics
          .filter(([topic]) => !existingRoles.has(topic.toLowerCase()))
          .map(([topic, count]) => ({
            user_id: userId,
            proposed_name: `${topic.charAt(0).toUpperCase() + topic.slice(1)} Assistant`,
            proposed_role: `${topic} Specialist`,
            reason: `I noticed you discuss ${topic} frequently (${((count / memories.length) * 100).toFixed(0)}% of conversations)`,
            detected_pattern: {
              topic_cluster: [topic],
              frequency: count / memories.length,
              confidence: Math.min(1, (count / memories.length) * 2),
              context: `User discusses this topic regularly`,
            },
            status: 'pending',
          }));

        if (newProposals.length > 0) {
          const { error: insertError } = await supabase
            .from('agent_proposals')
            .insert(newProposals);

          if (insertError) {
            console.error(`Failed to insert proposals for user ${userId}:`, insertError);
          } else {
            processedCount++;
            results.push({
              userId,
              proposalsCreated: newProposals.length,
            });
          }
        }
      } catch (error) {
        console.error(
          `Error processing user ${userSettings.user_id}:`,
          error
        );
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Pattern detection cron completed',
        processedUsers: processedCount,
        results,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Cron handler error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

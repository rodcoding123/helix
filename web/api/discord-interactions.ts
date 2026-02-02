import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface DiscordInteraction {
  type: number;
  token: string;
  member?: {
    user: {
      id: string;
      username: string;
    };
  };
  data?: {
    custom_id: string;
  };
}

/**
 * Verify Discord request signature
 * Discord requires HMAC-SHA256 validation
 */
function verifyDiscordSignature(
  request: Request,
  body: string,
  publicKey: string
): boolean {
  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');

  if (!signature || !timestamp) {
    return false;
  }

  const message = timestamp + body;
  const isValid =
    signature ===
    createHmac('sha256', publicKey)
      .update(message)
      .digest('hex');

  return isValid;
}

/**
 * Parse custom_id to extract action type and ID
 * Format: approve_proposal_ID | reject_proposal_ID | approve_action_ID | reject_action_ID
 */
function parseCustomId(customId: string): {
  action: 'approve' | 'reject';
  type: 'proposal' | 'action';
  id: string;
} | null {
  const match = customId.match(/^(approve|reject)_(proposal|action)_(.+)$/);
  if (!match) return null;

  return {
    action: match[1] as 'approve' | 'reject',
    type: match[2] as 'proposal' | 'action',
    id: match[3],
  };
}

/**
 * Handle agent proposal approval/rejection
 */
async function handleProposalInteraction(
  supabase: SupabaseClient,
  userId: string,
  proposalId: string,
  action: 'approve' | 'reject'
): Promise<void> {
  // Get the proposal first
  const { data: proposal, error: getError } = await supabase
    .from('agent_proposals')
    .select()
    .eq('id', proposalId)
    .eq('user_id', userId)
    .single();

  if (getError || !proposal) {
    console.error('Proposal not found:', getError);
    return;
  }

  if (action === 'approve') {
    // Get agent service to create the agent
    // For now, just update proposal status
    const { error: updateError } = await supabase
      .from('agent_proposals')
      .update({
        status: 'approved',
        updated_at: new Date(),
      })
      .eq('id', proposalId);

    if (updateError) {
      console.error('Failed to approve proposal:', updateError);
    }
  } else {
    // Reject proposal
    const { error: updateError } = await supabase
      .from('agent_proposals')
      .update({
        status: 'rejected',
        updated_at: new Date(),
      })
      .eq('id', proposalId);

    if (updateError) {
      console.error('Failed to reject proposal:', updateError);
    }
  }
}

/**
 * Handle autonomy action approval/rejection
 */
async function handleActionInteraction(
  supabase: SupabaseClient,
  userId: string,
  actionId: string,
  action: 'approve' | 'reject'
): Promise<void> {
  if (action === 'approve') {
    const { error: updateError } = await supabase
      .from('autonomy_actions')
      .update({
        status: 'approved',
        updated_at: new Date(),
      })
      .eq('id', actionId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Failed to approve action:', updateError);
    }

    // Execute the approved action
    // TODO: Actually execute the action based on action_type
  } else {
    // Reject action
    const { error: updateError } = await supabase
      .from('autonomy_actions')
      .update({
        status: 'rejected',
        updated_at: new Date(),
      })
      .eq('id', actionId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Failed to reject action:', updateError);
    }
  }
}

export default async function handler(request: Request): Promise<Response> {
  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body = await request.text();
    const discordPublicKey = process.env.DISCORD_PUBLIC_KEY;

    if (!discordPublicKey) {
      console.error('Missing DISCORD_PUBLIC_KEY');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Verify Discord signature
    if (!verifyDiscordSignature(request, body, discordPublicKey)) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const interaction: DiscordInteraction = JSON.parse(body);

    // Handle PING interaction (Discord handshake)
    if (interaction.type === 1) {
      return new Response(JSON.stringify({ type: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle button interaction
    if (interaction.type === 3 && interaction.data?.custom_id) {
      const parsedId = parseCustomId(interaction.data.custom_id);

      if (!parsedId || !interaction.member?.user.id) {
        return new Response(
          JSON.stringify({ error: 'Invalid interaction data' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const userId = interaction.member.user.id;
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Missing Supabase configuration');
        return new Response(
          JSON.stringify({ error: 'Server configuration error' }),
          { status: 500, headers: corsHeaders }
        );
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Handle proposal or action interaction
      if (parsedId.type === 'proposal') {
        await handleProposalInteraction(supabase, userId, parsedId.id, parsedId.action);
      } else {
        await handleActionInteraction(supabase, userId, parsedId.id, parsedId.action);
      }

      // Acknowledge the interaction
      return new Response(
        JSON.stringify({
          type: 4,
          data: {
            content: `✅ ${parsedId.action === 'approve' ? 'Approved' : 'Rejected'}!`,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown interaction type' }),
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Discord interaction handler error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

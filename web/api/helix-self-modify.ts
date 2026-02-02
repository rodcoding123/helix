import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface SelfModificationRequest {
  userId: string;
  modType: 'tool' | 'skill' | 'code';
  name: string;
  description: string;
  definition?: Record<string, unknown>;
  filePath?: string;
  proposedCode?: string;
  reason: string;
}

/**
 * Handler for Helix self-modification requests
 * Creates tools, skills, and proposes code changes
 */
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
    const body: SelfModificationRequest = await request.json();
    const authHeader = request.headers.get('Authorization');

    // Verify authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (body.modType) {
      case 'tool': {
        // Log tool creation request as an autonomy action
        const { data: action, error } = await supabase
          .from('autonomy_actions')
          .insert([
            {
              user_id: body.userId,
              action_type: 'tool_creation',
              action_description: `Create tool "${body.name}": ${body.description}`,
              risk_level: 'high',
              status: 'pending',
              approval_method: 'web_ui',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ])
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to log tool creation: ${error.message}`);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Tool creation request logged. Awaiting approval.',
            actionId: action.id,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      case 'skill': {
        // Log skill registration request
        const { data: action, error } = await supabase
          .from('autonomy_actions')
          .insert([
            {
              user_id: body.userId,
              action_type: 'skill_creation',
              action_description: `Register skill "${body.name}": ${body.description}`,
              risk_level: 'medium',
              status: 'pending',
              approval_method: 'web_ui',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ])
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to log skill creation: ${error.message}`);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Skill registration request logged. Awaiting approval.',
            actionId: action.id,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      case 'code': {
        // Log code modification request
        const { data: action, error } = await supabase
          .from('autonomy_actions')
          .insert([
            {
              user_id: body.userId,
              action_type: 'code_edit',
              action_description: `Modify file "${body.filePath}": ${body.reason}`,
              risk_level: 'high',
              status: 'pending',
              approval_method: 'web_ui',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ])
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to log code modification: ${error.message}`);
        }

        // Store proposed code in a separate table for review
        await supabase
          .from('code_modification_proposals')
          .insert([
            {
              action_id: action.id,
              user_id: body.userId,
              file_path: body.filePath,
              proposed_code: body.proposedCode,
              reason: body.reason,
              created_at: new Date(),
            },
          ]);

        return new Response(
          JSON.stringify({
            success: true,
            message:
              'Code modification proposal logged. Awaiting approval and review.',
            actionId: action.id,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown modification type' }), {
          status: 400,
          headers: corsHeaders,
        });
    }
  } catch (error) {
    console.error('Self-modification handler error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

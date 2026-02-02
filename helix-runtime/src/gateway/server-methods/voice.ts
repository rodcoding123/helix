/**
 * Voice Features Gateway RPC Methods
 *
 * Phase 4.1 feature: Handles voice recording, transcription, real-time conversations,
 * voice commands, and voicemail management.
 */

import type { GatewayRequestHandlers } from './types.js';

/**
 * Voice memo upload and transcription
 *
 * params: {
 *   memoId: string (UUID)
 *   audioUrl: string (Supabase Storage URL)
 *   durationMs: number
 *   title?: string
 * }
 *
 * response: {
 *   success: boolean
 *   memoId: string
 *   status: 'pending' | 'processing' | 'completed'
 *   transcript?: string (when completed)
 * }
 */
async function handleUploadVoiceMemo(params: any, context: any, client: any): Promise<any> {
  const userId = client?.connect?.userId;
  if (!userId) {
    return {
      success: false,
      error: 'Authentication required',
    };
  }

  const { memoId, audioUrl, durationMs, title, fileSizeBytes } = params;

  if (!memoId || !audioUrl || !durationMs) {
    return {
      success: false,
      error: 'memoId, audioUrl, and durationMs are required',
    };
  }

  try {
    const db = context.db;

    // Store voice memo
    await db.query(
      `INSERT INTO voice_memos
       (id, user_id, audio_url, duration_ms, file_size_bytes, title, transcription_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
      [memoId, userId, audioUrl, durationMs, fileSizeBytes || null, title || null]
    );

    // Queue for transcription
    await db.query(
      `INSERT INTO voice_processing_queue
       (id, user_id, job_type, status, input_id, input_data)
       VALUES ($1, $2, 'transcribe', 'pending', $3, $4)`,
      [
        crypto.randomUUID(),
        userId,
        memoId,
        JSON.stringify({ audioUrl, durationMs, language: 'en-US' }),
      ]
    );

    context.logGateway.log?.('VOICE_MEMO_UPLOADED', {
      memoId,
      userId,
      durationMs,
    });

    return {
      success: true,
      memoId,
      status: 'pending',
      message: 'Voice memo uploaded. Transcription queued.',
    };
  } catch (error) {
    context.logGateway.error?.('VOICE_MEMO_UPLOAD_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Get voice transcript with search
 *
 * params: {
 *   query: string (search query)
 *   limit?: number
 *   offset?: number
 * }
 *
 * response: {
 *   results: Array<{id, text, speaker, createdAt, source}>
 *   total: number
 * }
 */
async function handleSearchTranscripts(params: any, context: any, client: any): Promise<any> {
  const userId = client?.connect?.userId;
  if (!userId) {
    return {
      success: false,
      error: 'Authentication required',
    };
  }

  const { query, limit = 20, offset = 0 } = params;

  if (!query) {
    return {
      success: false,
      error: 'query is required',
    };
  }

  try {
    const db = context.db;

    // Full-text search on transcripts
    const result = await db.query(
      `SELECT id, text, speaker, source, created_at
       FROM voice_transcripts
       WHERE user_id = $1
       AND to_tsvector('english', text) @@ plainto_tsquery('english', $2)
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, query, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total
       FROM voice_transcripts
       WHERE user_id = $1
       AND to_tsvector('english', text) @@ plainto_tsquery('english', $2)`,
      [userId, query]
    );

    const results = (result.rows || []).map((row) => ({
      id: row.id,
      text: row.text,
      speaker: row.speaker,
      source: row.source,
      createdAt: row.created_at?.toISOString(),
    }));

    context.logGateway.log?.('TRANSCRIPT_SEARCH', {
      userId,
      query,
      resultCount: results.length,
    });

    return {
      success: true,
      results,
      total: countResult.rows?.[0]?.total || 0,
    };
  } catch (error) {
    context.logGateway.error?.('TRANSCRIPT_SEARCH_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
    };
  }
}

/**
 * Create or update voice command
 *
 * params: {
 *   commandId?: string (UUID, for updates)
 *   triggerPhrase: string ("create task", "send email")
 *   toolId: string (UUID of custom tool to execute)
 *   actionConfig?: Record<string, unknown>
 * }
 *
 * response: {
 *   success: boolean
 *   commandId: string
 *   triggerPhrase: string
 * }
 */
async function handleCreateVoiceCommand(params: any, context: any, client: any): Promise<any> {
  const userId = client?.connect?.userId;
  if (!userId) {
    return {
      success: false,
      error: 'Authentication required',
    };
  }

  const { commandId, triggerPhrase, toolId, actionConfig } = params;

  if (!triggerPhrase || !toolId) {
    return {
      success: false,
      error: 'triggerPhrase and toolId are required',
    };
  }

  try {
    const db = context.db;
    const id = commandId || crypto.randomUUID();

    if (commandId) {
      // Update existing
      await db.query(
        `UPDATE voice_commands
         SET trigger_phrase = $1, tool_id = $2, action_config = $3, updated_at = NOW()
         WHERE id = $4 AND user_id = $5`,
        [triggerPhrase, toolId, JSON.stringify(actionConfig || {}), id, userId]
      );
    } else {
      // Insert new
      await db.query(
        `INSERT INTO voice_commands
         (id, user_id, trigger_phrase, tool_id, command_type, action_config, is_enabled)
         VALUES ($1, $2, $3, $4, 'tool_execution', $5, true)`,
        [id, userId, triggerPhrase, toolId, JSON.stringify(actionConfig || {})]
      );
    }

    context.logGateway.log?.('VOICE_COMMAND_CREATED', {
      commandId: id,
      userId,
      triggerPhrase,
      toolId,
    });

    return {
      success: true,
      commandId: id,
      triggerPhrase,
    };
  } catch (error) {
    context.logGateway.error?.('VOICE_COMMAND_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Command creation failed',
    };
  }
}

/**
 * List user's voice commands
 *
 * response: {
 *   commands: Array<{id, triggerPhrase, toolId, isEnabled, usageCount}>
 * }
 */
async function handleListVoiceCommands(context: any, client: any): Promise<any> {
  const userId = client?.connect?.userId;
  if (!userId) {
    return {
      success: false,
      error: 'Authentication required',
    };
  }

  try {
    const db = context.db;

    const result = await db.query(
      `SELECT id, trigger_phrase, tool_id, is_enabled, usage_count
       FROM voice_commands
       WHERE user_id = $1
       ORDER BY trigger_phrase ASC`,
      [userId]
    );

    const commands = (result.rows || []).map((row) => ({
      id: row.id,
      triggerPhrase: row.trigger_phrase,
      toolId: row.tool_id,
      isEnabled: row.is_enabled,
      usageCount: row.usage_count,
    }));

    return {
      success: true,
      commands,
      total: commands.length,
    };
  } catch (error) {
    context.logGateway.error?.('VOICE_COMMANDS_LIST_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'List failed',
    };
  }
}

/**
 * Update voice settings (STT/TTS preferences)
 *
 * params: {
 *   sttProvider?: 'deepgram' | 'google' | 'whisper'
 *   ttsProvider?: 'elevenlabs' | 'google' | 'edge-tts'
 *   ttsVoiceId?: string
 *   wakeWordEnabled?: boolean
 * }
 */
async function handleUpdateVoiceSettings(params: any, context: any, client: any): Promise<any> {
  const userId = client?.connect?.userId;
  if (!userId) {
    return {
      success: false,
      error: 'Authentication required',
    };
  }

  try {
    const db = context.db;
    const updateFields = [];
    const updateValues: any[] = [userId];
    let paramIndex = 2;

    if (params.sttProvider) {
      updateFields.push(`stt_provider = $${paramIndex}`);
      updateValues.push(params.sttProvider);
      paramIndex++;
    }

    if (params.ttsProvider) {
      updateFields.push(`tts_provider = $${paramIndex}`);
      updateValues.push(params.ttsProvider);
      paramIndex++;
    }

    if (params.ttsVoiceId) {
      updateFields.push(`tts_voice_id = $${paramIndex}`);
      updateValues.push(params.ttsVoiceId);
      paramIndex++;
    }

    if (params.wakeWordEnabled !== undefined) {
      updateFields.push(`wake_word_enabled = $${paramIndex}`);
      updateValues.push(params.wakeWordEnabled);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return {
        success: true,
        message: 'No updates provided',
      };
    }

    updateFields.push('updated_at = NOW()');

    await db.query(
      `UPDATE voice_settings
       SET ${updateFields.join(', ')}
       WHERE user_id = $1`,
      updateValues
    );

    context.logGateway.log?.('VOICE_SETTINGS_UPDATED', {
      userId,
      fieldsUpdated: updateFields.length,
    });

    return {
      success: true,
      message: 'Voice settings updated',
    };
  } catch (error) {
    context.logGateway.error?.('VOICE_SETTINGS_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Settings update failed',
    };
  }
}

/**
 * Get voice session for real-time conversation
 *
 * params: {
 *   sessionKey: string
 * }
 *
 * response: {
 *   sessionId: string
 *   status: 'active' | 'completed'
 *   inputModel: string
 *   outputModel: string
 * }
 */
async function handleGetVoiceSession(params: any, context: any, client: any): Promise<any> {
  const userId = client?.connect?.userId;
  if (!userId) {
    return {
      success: false,
      error: 'Authentication required',
    };
  }

  const { sessionKey } = params;
  if (!sessionKey) {
    return {
      success: false,
      error: 'sessionKey is required',
    };
  }

  try {
    const db = context.db;

    const result = await db.query(
      `SELECT id, status, input_model, output_model, duration_seconds, start_time
       FROM voice_sessions
       WHERE session_key = $1 AND user_id = $2`,
      [sessionKey, userId]
    );

    if (!result.rows || result.rows.length === 0) {
      // Create new session
      const sessionId = crypto.randomUUID();
      await db.query(
        `INSERT INTO voice_sessions
         (id, user_id, session_key, status, input_model, output_model)
         VALUES ($1, $2, $3, 'active', 'deepgram', 'elevenlabs')`,
        [sessionId, userId, sessionKey]
      );

      return {
        success: true,
        sessionId,
        status: 'active',
        inputModel: 'deepgram',
        outputModel: 'elevenlabs',
      };
    }

    const session = result.rows[0];
    return {
      success: true,
      sessionId: session.id,
      status: session.status,
      inputModel: session.input_model,
      outputModel: session.output_model,
      durationSeconds: session.duration_seconds,
    };
  } catch (error) {
    context.logGateway.error?.('VOICE_SESSION_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Session retrieval failed',
    };
  }
}

/**
 * Export all voice handlers
 */
export const voiceHandlers: GatewayRequestHandlers = {
  'voice.upload_memo': async ({ params, respond, context, client }) => {
    const result = await handleUploadVoiceMemo(params, context, client);
    respond(result.success, result);
  },

  'voice.search_transcripts': async ({ params, respond, context, client }) => {
    const result = await handleSearchTranscripts(params, context, client);
    respond(result.success, result);
  },

  'voice.create_command': async ({ params, respond, context, client }) => {
    const result = await handleCreateVoiceCommand(params, context, client);
    respond(result.success, result);
  },

  'voice.list_commands': async ({ respond, context, client }) => {
    const result = await handleListVoiceCommands(context, client);
    respond(result.success, result);
  },

  'voice.update_settings': async ({ params, respond, context, client }) => {
    const result = await handleUpdateVoiceSettings(params, context, client);
    respond(result.success, result);
  },

  'voice.get_session': async ({ params, respond, context, client }) => {
    const result = await handleGetVoiceSession(params, context, client);
    respond(result.success, result);
  },
};

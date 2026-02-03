/**
 * Voice Memo RPC Methods
 * Handles voice recording, transcription, and search
 */

import type { GatewayRequestHandlers } from '../protocol/types.js';

export const voiceMemoHandlers: GatewayRequestHandlers = {
  /**
   * Save voice memo after recording
   */
  'voice.save_memo': async ({ params, respond, context }) => {
    const { userId, audioUrl, duration, transcript, title, tags } = params;

    try {
      // Store memo in database
      const result = await context.db.query(
        `INSERT INTO voice_memos (user_id, audio_url, duration_ms, transcript, title, tags)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at`,
        [userId, audioUrl, duration, transcript, title, tags || []]
      );

      // Index transcript for search
      await context.db.query(
        `UPDATE voice_memos SET transcript_indexed = true WHERE id = $1`,
        [result.rows[0].id]
      );

      // Log to Discord
      await context.discord.send('commands', {
        type: 'voice_memo_saved',
        userId,
        duration,
        transcriptLength: transcript?.length || 0,
      });

      respond(true, {
        memoId: result.rows[0].id,
        savedAt: result.rows[0].created_at,
      });
    } catch (error) {
      respond(false, { error: String(error) });
    }
  },

  /**
   * Transcribe audio using STT service
   */
  'voice.transcribe': async ({ params, respond, context }) => {
    const { audioUrl, language = 'en' } = params;

    try {
      // Call STT service (Deepgram, Google Cloud, or OpenAI)
      const transcription = await transcribeAudio(audioUrl, language);

      respond(true, {
        transcript: transcription.text,
        confidence: transcription.confidence,
        language: transcription.language,
        duration: transcription.duration,
      });
    } catch (error) {
      respond(false, { error: String(error) });
    }
  },

  /**
   * Search voice transcripts
   */
  'voice.search_transcripts': async ({ params, respond, context }) => {
    const { userId, query, limit = 10, offset = 0 } = params;

    try {
      // Full-text search on transcripts
      const results = await context.db.query(
        `SELECT id, title, transcript, duration_ms, created_at,
                ts_rank(to_tsvector('english', transcript), plainto_tsquery('english', $1)) as relevance
         FROM voice_memos
         WHERE user_id = $2 AND to_tsvector('english', transcript) @@ plainto_tsquery('english', $1)
         ORDER BY relevance DESC, created_at DESC
         LIMIT $3 OFFSET $4`,
        [query, userId, limit, offset]
      );

      respond(true, {
        results: results.rows,
        total: results.rows.length,
        hasMore: results.rows.length === limit,
      });
    } catch (error) {
      respond(false, { error: String(error) });
    }
  },

  /**
   * Get voice memos list for user
   */
  'voice.list_memos': async ({ params, respond, context }) => {
    const { userId, limit = 20, offset = 0 } = params;

    try {
      const results = await context.db.query(
        `SELECT id, title, duration_ms, transcript, tags, created_at
         FROM voice_memos
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      const countResult = await context.db.query(
        `SELECT COUNT(*) as total FROM voice_memos WHERE user_id = $1`,
        [userId]
      );

      respond(true, {
        memos: results.rows,
        total: countResult.rows[0].total,
        hasMore: offset + limit < countResult.rows[0].total,
      });
    } catch (error) {
      respond(false, { error: String(error) });
    }
  },

  /**
   * Delete voice memo
   */
  'voice.delete_memo': async ({ params, respond, context }) => {
    const { memoId, userId } = params;

    try {
      // Verify ownership
      const memo = await context.db.query(
        `SELECT id FROM voice_memos WHERE id = $1 AND user_id = $2`,
        [memoId, userId]
      );

      if (memo.rows.length === 0) {
        respond(false, { error: 'Memo not found' });
        return;
      }

      // Delete from storage
      await context.storage.delete(`voice-memos/${memoId}.wav`);

      // Delete from database
      await context.db.query(`DELETE FROM voice_memos WHERE id = $1`, [memoId]);

      respond(true, { deleted: true });
    } catch (error) {
      respond(false, { error: String(error) });
    }
  },

  /**
   * Tag voice memo
   */
  'voice.tag_memo': async ({ params, respond, context }) => {
    const { memoId, userId, tags } = params;

    try {
      await context.db.query(
        `UPDATE voice_memos SET tags = $1 WHERE id = $2 AND user_id = $3`,
        [tags, memoId, userId]
      );

      respond(true, { tagged: true });
    } catch (error) {
      respond(false, { error: String(error) });
    }
  },

  /**
   * Get voice transcript with context
   */
  'voice.get_transcript': async ({ params, respond, context }) => {
    const { memoId, userId } = params;

    try {
      const result = await context.db.query(
        `SELECT id, transcript, transcript, title, duration_ms, tags, created_at
         FROM voice_memos
         WHERE id = $1 AND user_id = $2`,
        [memoId, userId]
      );

      if (result.rows.length === 0) {
        respond(false, { error: 'Memo not found' });
        return;
      }

      respond(true, result.rows[0]);
    } catch (error) {
      respond(false, { error: String(error) });
    }
  },

  /**
   * Get voice stats
   */
  'voice.get_stats': async ({ params, respond, context }) => {
    const { userId } = params;

    try {
      const stats = await context.db.query(
        `SELECT
          COUNT(*) as total_memos,
          SUM(duration_ms) as total_duration_ms,
          AVG(duration_ms) as avg_duration_ms,
          MAX(created_at) as last_memo_date
         FROM voice_memos
         WHERE user_id = $1`,
        [userId]
      );

      respond(true, stats.rows[0]);
    } catch (error) {
      respond(false, { error: String(error) });
    }
  },
};

/**
 * Transcribe audio using external STT service
 */
async function transcribeAudio(
  audioUrl: string,
  language: string
): Promise<{ text: string; confidence: number; language: string; duration: number }> {
  const provider = process.env.STT_PROVIDER || 'deepgram';

  switch (provider) {
    case 'deepgram':
      return transcribeWithDeepgram(audioUrl, language);
    case 'google':
      return transcribeWithGoogle(audioUrl, language);
    case 'openai':
      return transcribeWithOpenAI(audioUrl, language);
    default:
      // Fallback: mock transcription
      return {
        text: '[Mock transcription]',
        confidence: 0.85,
        language,
        duration: 0,
      };
  }
}

/**
 * Transcribe with Deepgram
 */
async function transcribeWithDeepgram(
  audioUrl: string,
  language: string
): Promise<{ text: string; confidence: number; language: string; duration: number }> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY not set');

  try {
    const response = await fetch(`https://api.deepgram.com/v1/listen?language=${language}`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: audioUrl }),
    });

    const data = (await response.json()) as {
      results: {
        channels: Array<{
          alternatives: Array<{ transcript: string; confidence: number }>;
        }>;
      };
      metadata: { duration: number };
    };

    const transcript = data.results.channels[0]?.alternatives[0];
    if (!transcript) throw new Error('No transcript in response');

    return {
      text: transcript.transcript,
      confidence: transcript.confidence,
      language,
      duration: data.metadata.duration,
    };
  } catch (error) {
    throw new Error(`Deepgram transcription failed: ${String(error)}`);
  }
}

/**
 * Transcribe with Google Cloud Speech
 */
async function transcribeWithGoogle(
  _audioUrl: string,
  _language: string
): Promise<{ text: string; confidence: number; language: string; duration: number }> {
  // Placeholder - implement Google Cloud Speech API
  throw new Error('Google Cloud Speech not yet implemented');
}

/**
 * Transcribe with OpenAI Whisper
 */
async function transcribeWithOpenAI(
  _audioUrl: string,
  _language: string
): Promise<{ text: string; confidence: number; language: string; duration: number }> {
  // Placeholder - implement OpenAI Whisper API
  throw new Error('OpenAI Whisper not yet implemented');
}

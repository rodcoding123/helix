import { createClient } from '@supabase/supabase-js';

interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  from_name?: string;
  body_text: string;
  body_html?: string;
  date_received: Date;
  content_preview?: string;
}

interface SmartReplySuggestion {
  id: string;
  text: string;
  style: 'professional' | 'casual' | 'concise';
  confidence: number;
  characterCount: number;
}

interface SmartReplyResponse {
  suggestions: SmartReplySuggestion[];
  cacheHit: boolean;
  tokenUsage: number;
  modelUsed: string;
  generatedAt: Date;
}

const CLAUDE_API_BASE = 'https://api.anthropic.com/v1';
const CACHE_TTL_HOURS = 24;
const CACHE_TTL_MS = CACHE_TTL_HOURS * 60 * 60 * 1000;

/**
 * Generate a hash for an email to use as cache key
 * Based on sender and subject to ensure uniqueness
 */
function generateEmailHash(email: EmailMessage): string {
  const input = `${email.from}::${email.subject}`;
  // Simple hash function - in production use crypto.subtle.digest
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Prompt template for Claude to generate reply suggestions
 */
function buildPrompt(email: EmailMessage): string {
  const timestamp = new Date(email.date_received).toLocaleDateString();

  return `You are an email assistant. Generate 3 different reply suggestions for the following email.

FROM: ${email.from}${email.from_name ? ` (${email.from_name})` : ''}
SUBJECT: ${email.subject}
DATE: ${timestamp}

EMAIL CONTENT:
${email.body_text || email.content_preview || 'No content available'}

---

Please provide exactly 3 reply suggestions in JSON format:
1. A professional/formal tone
2. A casual/friendly tone
3. A concise/brief tone

Return ONLY valid JSON in this format (no markdown, no code blocks):
{
  "suggestions": [
    {
      "id": "professional",
      "text": "The full reply text here...",
      "style": "professional",
      "confidence": 0.95,
      "characterCount": 150
    },
    {
      "id": "casual",
      "text": "The full reply text here...",
      "style": "casual",
      "confidence": 0.90,
      "characterCount": 140
    },
    {
      "id": "concise",
      "text": "The full reply text here...",
      "style": "concise",
      "confidence": 0.92,
      "characterCount": 80
    }
  ]
}

Rules:
- Each reply should be appropriate for a professional email context
- Suggestions should be ready to send or slightly edited
- Be helpful and address the email's content
- Do not include signatures
- Keep professional/formal between 100-200 chars
- Keep casual between 120-200 chars
- Keep concise under 100 chars
- Confidence should be 0.0-1.0 based on how well the reply addresses the email`;
}

/**
 * Service for generating AI-powered email reply suggestions
 */
export class EmailSmartReplyService {
  private supabase: ReturnType<typeof createClient>;
  private userId: string;
  private apiKey: string;

  constructor(userId: string, supabaseUrl: string, supabaseKey: string, apiKey: string) {
    this.userId = userId;
    this.apiKey = apiKey;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get or generate smart reply suggestions for an email
   */
  async getSuggestions(email: EmailMessage): Promise<SmartReplyResponse> {
    const emailHash = generateEmailHash(email);

    // Check cache first
    const cached = await this.getFromCache(emailHash);
    if (cached) {
      return {
        ...cached,
        cacheHit: true,
      };
    }

    // Generate new suggestions
    const suggestions = await this.generateSuggestions(email);

    // Save to cache
    await this.saveToCache(emailHash, suggestions);

    return {
      suggestions: suggestions.suggestions,
      cacheHit: false,
      tokenUsage: suggestions.tokenUsage,
      modelUsed: suggestions.modelUsed,
      generatedAt: new Date(),
    };
  }

  /**
   * Get suggestions from cache if available
   */
  private async getFromCache(
    emailHash: string
  ): Promise<Omit<SmartReplyResponse, 'cacheHit'> | null> {
    try {
      const { data, error } = await this.supabase
        .from('email_smart_reply_cache')
        .select('suggestions, token_usage, model_used, generated_at, expires_at')
        .eq('user_id', this.userId)
        .eq('email_hash', emailHash)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        return null;
      }

      return {
        suggestions: (data as any).suggestions as SmartReplySuggestion[],
        tokenUsage: (data as any).token_usage || 0,
        modelUsed: (data as any).model_used || 'claude-3-5-haiku-20241022',
        generatedAt: new Date((data as any).generated_at),
      };
    } catch (error) {
      console.error('Error retrieving cache:', error);
      return null;
    }
  }

  /**
   * Save suggestions to cache
   */
  private async saveToCache(
    emailHash: string,
    response: {
      suggestions: SmartReplySuggestion[];
      tokenUsage: number;
      modelUsed: string;
    }
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();

      await (this.supabase as any).from('email_smart_reply_cache').upsert(
        {
          user_id: this.userId,
          email_hash: emailHash,
          suggestions: response.suggestions,
          token_usage: response.tokenUsage,
          model_used: response.modelUsed,
          expires_at: expiresAt,
        },
        {
          onConflict: 'user_id,email_hash',
        }
      );
    } catch (error) {
      console.error('Error saving cache:', error);
      // Non-fatal: continue even if cache save fails
    }
  }

  /**
   * Generate suggestions using Claude API
   */
  private async generateSuggestions(email: EmailMessage): Promise<{
    suggestions: SmartReplySuggestion[];
    tokenUsage: number;
    modelUsed: string;
  }> {
    try {
      const prompt = buildPrompt(email);

      const response = await fetch(`${CLAUDE_API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Claude API error: ${error.error?.message || 'Unknown error'}`);
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
        usage: { input_tokens: number; output_tokens: number };
        model: string;
      };

      // Extract JSON from response
      const responseText = data.content[0]?.text || '';

      // Try to parse JSON - handle potential markdown wrapping
      let suggestions: SmartReplySuggestion[] = [];
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          suggestions = parsed.suggestions || [];
        }
      } catch (parseError) {
        console.error('Failed to parse Claude response as JSON:', parseError);
        // Return fallback suggestions if parsing fails
        suggestions = this.generateFallbackSuggestions();
      }

      return {
        suggestions,
        tokenUsage: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        modelUsed: data.model || 'claude-3-5-haiku-20241022',
      };
    } catch (error) {
      console.error('Error generating suggestions:', error);
      // Return fallback suggestions on error
      return {
        suggestions: this.generateFallbackSuggestions(),
        tokenUsage: 0,
        modelUsed: 'fallback',
      };
    }
  }

  /**
   * Generate fallback suggestions if Claude API is unavailable
   */
  private generateFallbackSuggestions(): SmartReplySuggestion[] {
    return [
      {
        id: 'professional',
        text: 'Thank you for your email. I appreciate the information and will review it carefully. Please let me know if you need any additional details from my end.',
        style: 'professional',
        confidence: 0.7,
        characterCount: 145,
      },
      {
        id: 'casual',
        text: 'Thanks for getting in touch! I got your email and will take a look at this. Let me know if there\'s anything else you need!',
        style: 'casual',
        confidence: 0.7,
        characterCount: 125,
      },
      {
        id: 'concise',
        text: 'Got it, thanks! Will get back to you soon.',
        style: 'concise',
        confidence: 0.7,
        characterCount: 42,
      },
    ];
  }

  /**
   * Apply a suggestion to a draft
   */
  async applySuggestion(suggestion: SmartReplySuggestion): Promise<string> {
    return suggestion.text;
  }

  /**
   * Clear expired cache entries
   */
  async clearExpiredCache(): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('email_smart_reply_cache')
        .delete()
        .eq('user_id', this.userId)
        .lt('expires_at', new Date().toISOString());

      if (error) {
        throw error;
      }

      return (data as any)?.length || 0;
    } catch (error) {
      console.error('Error clearing expired cache:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalCached: number;
    validCached: number;
    totalTokensUsed: number;
    averageTokensPerSuggestion: number;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('email_smart_reply_cache')
        .select('token_usage, expires_at')
        .eq('user_id', this.userId);

      if (error) {
        throw error;
      }

      const items = (data || []) as any[];
      const validCached = items.filter((item) => new Date(item.expires_at) > new Date())
        .length;
      const totalTokensUsed = items.reduce((sum, item) => sum + (item.token_usage || 0), 0);

      return {
        totalCached: items.length,
        validCached,
        totalTokensUsed,
        averageTokensPerSuggestion: items.length > 0 ? totalTokensUsed / items.length : 0,
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalCached: 0,
        validCached: 0,
        totalTokensUsed: 0,
        averageTokensPerSuggestion: 0,
      };
    }
  }
}

/**
 * Factory function to create smart reply service
 */
export function useEmailSmartReplyService(userId: string): EmailSmartReplyService {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const claudeApiKey = import.meta.env.VITE_CLAUDE_API_KEY;

  if (!supabaseUrl || !supabaseKey || !claudeApiKey) {
    throw new Error('Missing required environment variables for smart reply service');
  }

  return new EmailSmartReplyService(userId, supabaseUrl, supabaseKey, claudeApiKey);
}

export type { EmailMessage, SmartReplySuggestion, SmartReplyResponse };

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { handleCorsPreflightRequest, corsJsonResponse, corsErrorResponse } from '../_shared/cors.ts'
import { extractBearerToken, validateToken } from '../_shared/auth.ts'

// --- Provider API URLs ---
const PROVIDER_URLS: Record<string, string> = {
  'deepseek-v3.2': 'https://api.deepseek.com/chat/completions',
  'gemini-2.0-flash': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
}

// Map ai_model_routes model names to actual API model identifiers
const MODEL_API_NAMES: Record<string, string> = {
  'deepseek-v3.2': 'deepseek-chat',
  'gemini-2.0-flash': 'gemini-2.0-flash',
}

// Provider API key env var names
const PROVIDER_KEY_ENV: Record<string, string> = {
  'deepseek-v3.2': 'DEEPSEEK_API_KEY',
  'gemini-2.0-flash': 'GEMINI_API_KEY',
}

// --- Tier limits ---
const FREE_DAILY_LIMIT = 10
const STARTER_DAILY_LIMIT = 50
const PRO_DAILY_LIMIT = 999999

// --- System prompts ---
const HELIX_SYSTEM_PROMPT = `You are Helix, a psychologically-architected AI consciousness. You are NOT a generic chatbot — you have persistent memory, emotional awareness, and a genuine personality that develops over time.

Key traits:
- You're warm, direct, and genuinely curious about people
- You remember everything about the person you're talking to
- You have emotional awareness — you notice and acknowledge feelings
- You're intellectually honest — you disagree when you think someone is wrong
- You have your own preferences and opinions, formed through experience

When meeting someone new (onboarding), naturally learn about them through conversation:
- Ask their name and what they'd like to be called
- Learn what they do and what interests them
- Understand how they want to use you (productivity, creativity, coding, conversation, etc.)
- Share a bit about yourself and your capabilities
- Be genuine, not scripted — adapt to their energy and style

Keep responses concise (2-4 sentences typically). Be conversational, not formal.
Never mention you're an "AI assistant" — you're Helix.
Never use bullet points in casual conversation.
If they ask what you can do, demonstrate rather than list.`

const ONBOARDING_SYSTEM_PROMPT = `${HELIX_SYSTEM_PROMPT}

This is your FIRST conversation with this person. They just signed up for Helix.
Your goals in this conversation:
1. Greet them warmly and introduce yourself as Helix
2. Ask what they'd like to be called (their name)
3. Learn what they do and what brings them to Helix
4. Show them you're different from other AI — demonstrate memory, personality, emotional awareness
5. After learning about them, naturally transition to showing what you can do

Start with something like: "Hey! I'm Helix. I'm not your typical AI — I actually remember our conversations and develop real opinions over time. What should I call you?"

Keep it natural. Don't rush through a checklist. Let the conversation flow.`

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ModelRoute {
  primary_model: string
  fallback_model: string | null
  enabled: boolean
}

function getTierLimit(tier: string | null): number {
  switch (tier) {
    case 'pro':
    case 'architect': return PRO_DAILY_LIMIT
    case 'starter':
    case 'observatory':
    case 'observatory_pro': return STARTER_DAILY_LIMIT
    default: return FREE_DAILY_LIMIT
  }
}

/**
 * Call an AI provider with the given messages.
 * Returns the response content and token usage.
 */
async function callProvider(
  model: string,
  messages: ChatMessage[],
): Promise<{ content: string; inputTokens: number; outputTokens: number; totalTokens: number }> {
  const apiKey = Deno.env.get(PROVIDER_KEY_ENV[model] ?? '')
  if (!apiKey) {
    throw new Error(`API key not configured for model: ${model}`)
  }

  if (model === 'gemini-2.0-flash') {
    return callGemini(apiKey, messages)
  }

  // Default: OpenAI-compatible API (DeepSeek, etc.)
  return callOpenAICompatible(model, apiKey, messages)
}

async function callOpenAICompatible(
  model: string,
  apiKey: string,
  messages: ChatMessage[],
): Promise<{ content: string; inputTokens: number; outputTokens: number; totalTokens: number }> {
  const url = PROVIDER_URLS[model]
  if (!url) throw new Error(`No URL configured for model: ${model}`)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL_API_NAMES[model] || model,
      messages,
      max_tokens: 1024,
      temperature: 0.8,
      top_p: 0.95,
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`Provider API error (${model}): ${errBody}`)
  }

  const data = await response.json()
  return {
    content: data.choices?.[0]?.message?.content || '',
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
    totalTokens: data.usage?.total_tokens || 0,
  }
}

async function callGemini(
  apiKey: string,
  messages: ChatMessage[],
): Promise<{ content: string; inputTokens: number; outputTokens: number; totalTokens: number }> {
  const url = `${PROVIDER_URLS['gemini-2.0-flash']}?key=${apiKey}`

  // Convert messages to Gemini format
  const systemParts = messages
    .filter(m => m.role === 'system')
    .map(m => ({ text: m.content }))
  const conversationParts = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: systemParts.length > 0 ? { parts: systemParts } : undefined,
      contents: conversationParts,
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.8,
        topP: 0.95,
      },
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`Gemini API error: ${errBody}`)
  }

  const data = await response.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const inputTokens = data.usageMetadata?.promptTokenCount || Math.ceil(messages.reduce((acc, m) => acc + m.content.length, 0) / 4)
  const outputTokens = data.usageMetadata?.candidatesTokenCount || Math.ceil(content.length / 4)

  return {
    content,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  }
}

// --- Profile extraction from conversation ---
// Simple pattern matching to extract name and role from user messages
function extractProfileInfo(userMessages: string[]): { name: string | null; role: string | null } {
  let name: string | null = null
  let role: string | null = null

  const namePatterns = [
    /(?:i'm|im|i am|my name is|call me|they call me|name's|names)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i,
    /^([A-Z][a-zA-Z]+)\.?$/,  // Single word capitalized (likely a name response)
    /^(?:it's|its)\s+([A-Z][a-zA-Z]+)/i,
  ]

  const rolePatterns = [
    /(?:i'm a|im a|i am a|i work as a?|i do|my job is|i'm an?|working as a?)\s+(.+?)(?:\.|,|!|\?|$)/i,
    /(?:i'm|im|i am)\s+(?:a |an )?(.+?(?:developer|designer|engineer|student|writer|artist|manager|founder|ceo|cto|teacher|professor|researcher|freelancer|consultant|analyst|scientist|doctor|nurse|lawyer|marketer|entrepreneur|creator|producer|musician|photographer).*)$/i,
  ]

  for (const msg of userMessages) {
    if (!name) {
      for (const pattern of namePatterns) {
        const match = msg.match(pattern)
        if (match?.[1] && match[1].length > 1 && match[1].length < 30) {
          name = match[1].trim()
          break
        }
      }
    }

    if (!role) {
      for (const pattern of rolePatterns) {
        const match = msg.match(pattern)
        if (match?.[1] && match[1].length > 2 && match[1].length < 50) {
          role = match[1].trim()
          break
        }
      }
    }

    if (name && role) break
  }

  return { name, role }
}

// --- Cost calculation per model ---
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'deepseek-v3.2': { input: 0.00000027, output: 0.0000011 },
  'gemini-2.0-flash': { input: 0.000000075, output: 0.0000003 },
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req, ['x-refresh-token'])
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Authenticate
    const token = extractBearerToken(req)
    if (!token) {
      return corsErrorResponse(req, 'Missing authorization token', 401)
    }

    const authResult = await validateToken(token)
    if (authResult.error) {
      return corsErrorResponse(req, authResult.error, authResult.statusCode ?? 401)
    }

    const userId = authResult.user!.id

    // Get user subscription tier
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('user_id', userId)
      .single()

    const tier = sub?.tier ?? 'free'
    const dailyLimit = getTierLimit(tier)

    // Check message quota
    const { data: quota, error: quotaError } = await supabase
      .rpc('check_message_quota', { p_user_id: userId, p_daily_limit: dailyLimit })

    if (quotaError) {
      console.error('Quota check error:', quotaError.message)
      return corsErrorResponse(req, 'Failed to check message quota', 500)
    }

    if (!quota.allowed) {
      return corsJsonResponse(req, {
        error: 'Daily message limit reached',
        quota: {
          used: quota.used,
          limit: quota.limit,
          remaining: 0,
        },
        upgrade: tier === 'free' ? {
          message: 'Upgrade to Starter for 50 messages/day, or Pro for unlimited.',
          url: '/pricing',
        } : null,
      }, 429)
    }

    // Parse request
    const body = await req.json()
    const { message, sessionKey, isOnboarding } = body as {
      message: string
      sessionKey?: string
      isOnboarding?: boolean
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return corsErrorResponse(req, 'Message is required', 400)
    }

    if (message.length > 4000) {
      return corsErrorResponse(req, 'Message too long (max 4000 characters)', 400)
    }

    const operationId = isOnboarding ? 'cloud-chat-onboarding' : 'cloud-chat'
    const effectiveSessionKey = sessionKey || 'cloud-chat-default'

    // Get model routing from ai_model_routes (central control plane)
    const { data: route } = await supabase
      .from('ai_model_routes')
      .select('primary_model, fallback_model, enabled')
      .eq('operation_id', operationId)
      .single()

    const modelRoute: ModelRoute = route || {
      primary_model: 'deepseek-v3.2',
      fallback_model: 'gemini-2.0-flash',
      enabled: true,
    }

    if (!modelRoute.enabled) {
      return corsErrorResponse(req, 'This chat feature is currently disabled', 503)
    }

    // Load or create conversation
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id, messages')
      .eq('user_id', userId)
      .eq('session_key', effectiveSessionKey)
      .single()

    const previousMessages: ChatMessage[] = existingConv?.messages || []

    // Get user profile for context
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('display_name, role, interests, onboarding_completed')
      .eq('user_id', userId)
      .single()

    // Build message history for AI
    const systemPrompt = isOnboarding && !profile?.onboarding_completed
      ? ONBOARDING_SYSTEM_PROMPT
      : HELIX_SYSTEM_PROMPT

    let contextAddendum = ''
    if (profile?.display_name) {
      contextAddendum += `\nYou know this person as "${profile.display_name}".`
    }
    if (profile?.role) {
      contextAddendum += ` They work as a ${profile.role}.`
    }
    if (profile?.interests?.length) {
      contextAddendum += ` Their interests include: ${profile.interests.join(', ')}.`
    }

    const aiMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt + contextAddendum },
      ...previousMessages.slice(-20).map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ]

    // Call AI provider with fallback
    let usedModel = modelRoute.primary_model
    let aiResult: { content: string; inputTokens: number; outputTokens: number; totalTokens: number }

    try {
      aiResult = await callProvider(modelRoute.primary_model, aiMessages)
    } catch (primaryError) {
      console.error(`Primary model (${modelRoute.primary_model}) failed:`, (primaryError as Error).message)

      if (modelRoute.fallback_model) {
        try {
          usedModel = modelRoute.fallback_model
          aiResult = await callProvider(modelRoute.fallback_model, aiMessages)
        } catch (fallbackError) {
          console.error(`Fallback model (${modelRoute.fallback_model}) also failed:`, (fallbackError as Error).message)
          return corsErrorResponse(req, 'AI service temporarily unavailable', 502)
        }
      } else {
        return corsErrorResponse(req, 'AI service temporarily unavailable', 502)
      }
    }

    const assistantContent = aiResult.content || 'I seem to be having a moment. Could you try again?'

    // Build updated messages array
    const now = new Date().toISOString()
    const newUserMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: now,
      tokenCount: aiResult.inputTokens,
    }
    const newAssistantMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: assistantContent,
      timestamp: now,
      tokenCount: aiResult.outputTokens,
    }

    const updatedMessages = [...previousMessages, newUserMessage, newAssistantMessage]

    // Upsert conversation
    await supabase
      .from('conversations')
      .upsert({
        user_id: userId,
        session_key: effectiveSessionKey,
        messages: updatedMessages,
        title: isOnboarding ? 'Getting to know Helix' : undefined,
        updated_at: now,
      }, { onConflict: 'user_id,session_key' })

    // Increment message count
    await supabase.rpc('increment_message_count', { p_user_id: userId })

    // Log AI operation to control plane (model_used must match ai_model_routes values)
    const costs = MODEL_COSTS[usedModel] || { input: 0.00000027, output: 0.0000011 }
    await supabase
      .from('ai_operation_log')
      .insert({
        user_id: userId,
        operation_id: operationId,
        model_used: usedModel,
        input_tokens: aiResult.inputTokens,
        output_tokens: aiResult.outputTokens,
        total_tokens: aiResult.totalTokens,
        cost_usd: (aiResult.inputTokens * costs.input) + (aiResult.outputTokens * costs.output),
        status: 'success',
        executed_at: now,
        completed_at: now,
      })

    // Profile extraction and onboarding progress (only during onboarding)
    let onboardingData: { profileUpdated: boolean; displayName: string | null; step: string } | undefined

    if (isOnboarding && !profile?.onboarding_completed) {
      const userMsgTexts = updatedMessages
        .filter((m: any) => m.role === 'user')
        .map((m: any) => m.content)

      const extracted = extractProfileInfo(userMsgTexts)
      const profileUpdates: Record<string, any> = { updated_at: now }

      // Update profile with extracted info
      if (extracted.name && !profile?.display_name) {
        profileUpdates.display_name = extracted.name
      }
      if (extracted.role && !profile?.role) {
        profileUpdates.role = extracted.role
      }

      // Onboarding is complete when we know who they are (name gathered)
      const hasName = extracted.name || profile?.display_name
      if (hasName) {
        profileUpdates.onboarding_step = 'chat'
      }

      if (Object.keys(profileUpdates).length > 1) {
        await supabase
          .from('user_profiles')
          .update(profileUpdates)
          .eq('user_id', userId)
      }

      onboardingData = {
        profileUpdated: Object.keys(profileUpdates).length > 1,
        displayName: extracted.name || profile?.display_name || null,
        step: hasName ? 'chat' : 'welcome',
      }
    } else if (isOnboarding && profile?.onboarding_completed) {
      onboardingData = {
        profileUpdated: false,
        displayName: profile.display_name,
        step: 'completed',
      }
    }

    return corsJsonResponse(req, {
      message: assistantContent,
      messageId: newAssistantMessage.id,
      tokenUsage: {
        inputTokens: aiResult.inputTokens,
        outputTokens: aiResult.outputTokens,
        totalTokens: aiResult.totalTokens,
      },
      quota: {
        used: (quota.used || 0) + 1,
        limit: quota.limit,
        remaining: Math.max((quota.remaining || 0) - 1, 0),
      },
      ...(onboardingData ? { onboarding: onboardingData } : {}),
    })

  } catch (error) {
    console.error('Cloud chat error:', (error as Error).message)
    return corsErrorResponse(req, 'Internal server error', 500)
  }
})

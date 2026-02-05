// WebRTC Signaling Edge Function
// Handles voice connection signaling for Code Interface

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import {
  handleCorsPreflightRequest,
  corsJsonResponse,
  corsErrorResponse,
} from '../_shared/cors.ts'

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'hangup'
  sessionId: string
  instanceKey: string
  payload: unknown
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req)
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify authorization
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return corsErrorResponse(req, 'Unauthorized', 401)
    }

    const token = authHeader.slice(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return corsErrorResponse(req, 'Invalid token', 401)
    }

    // Check if user has Architect tier
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('user_id', user.id)
      .single()

    if (subError || subscription?.tier !== 'architect') {
      return corsErrorResponse(req, 'Architect tier required for voice', 403)
    }

    // Parse signaling message
    const message: SignalingMessage = await req.json()

    // Verify user owns the instance
    const { data: instance, error: instanceError } = await supabase
      .from('instances')
      .select('id')
      .eq('instance_key', message.instanceKey)
      .eq('user_id', user.id)
      .single()

    if (instanceError || !instance) {
      return corsErrorResponse(req, 'Instance not found or not owned', 403)
    }

    // Store signaling message in realtime channel
    // The local Helix instance will subscribe to this channel
    const channelName = `signaling:${message.instanceKey}`

    // Insert into a signaling_messages table for persistence/polling
    const { error: insertError } = await supabase
      .from('signaling_messages')
      .insert({
        session_id: message.sessionId,
        instance_key: message.instanceKey,
        user_id: user.id,
        message_type: message.type,
        payload: message.payload,
        expires_at: new Date(Date.now() + 30000).toISOString(), // 30 second TTL
      })

    if (insertError) {
      console.error('Failed to store signaling message:', insertError)
      return corsErrorResponse(req, 'Failed to relay message', 500)
    }

    // Broadcast via realtime
    const channel = supabase.channel(channelName)
    await channel.send({
      type: 'broadcast',
      event: message.type,
      payload: {
        sessionId: message.sessionId,
        ...message.payload as Record<string, unknown>,
      },
    })

    return corsJsonResponse(req, { success: true })
  } catch (error) {
    console.error('Signaling error:', error)
    return corsErrorResponse(req, 'Internal server error', 500)
  }
})

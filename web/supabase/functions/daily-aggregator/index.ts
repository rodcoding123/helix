// Daily Aggregator Edge Function
// Computes daily stats for the Observatory dashboard
// Should be run as a cron job (e.g., daily at midnight UTC)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import {
  handleCorsPreflightRequest,
  corsJsonResponse,
  corsErrorResponse,
} from '../_shared/cors.ts'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req)
  }

  try {
    // Verify this is an authorized cron call or admin request
    const authHeader = req.headers.get('authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')

    if (authHeader !== `Bearer ${cronSecret}`) {
      return corsErrorResponse(req, 'Unauthorized', 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Calculate stats for yesterday
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dateStr = yesterday.toISOString().split('T')[0]

    // Get instance counts
    const { count: totalInstances } = await supabase
      .from('instances')
      .select('*', { count: 'exact', head: true })

    const { count: activeInstances } = await supabase
      .from('instances')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen', yesterday.toISOString())
      .lt('last_seen', today.toISOString())

    const { count: newInstances } = await supabase
      .from('instances')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString())

    const { count: ghostInstances } = await supabase
      .from('instances')
      .select('*', { count: 'exact', head: true })
      .eq('ghost_mode', true)

    // Get session counts
    const { count: totalSessions } = await supabase
      .from('telemetry_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'session_start')
      .gte('server_timestamp', yesterday.toISOString())
      .lt('server_timestamp', today.toISOString())

    // Get heartbeat counts
    const { count: totalHeartbeats } = await supabase
      .from('heartbeats')
      .select('*', { count: 'exact', head: true })
      .gte('received_at', yesterday.toISOString())
      .lt('received_at', today.toISOString())

    // Get transformation count
    const { count: transformations } = await supabase
      .from('transformations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString())

    // Get anomaly counts by severity
    const { count: anomaliesInfo } = await supabase
      .from('anomalies')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'info')
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString())

    const { count: anomaliesWarning } = await supabase
      .from('anomalies')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'warning')
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString())

    const { count: anomaliesCritical } = await supabase
      .from('anomalies')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'critical')
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString())

    // Get psychology distribution (enneagram types)
    const { data: psychologyData } = await supabase
      .from('instances')
      .select('psychology_summary')
      .not('psychology_summary', 'is', null)

    const enneagramDistribution: Record<string, number> = {}
    const bigFiveSum = { openness: 0, conscientiousness: 0, extraversion: 0, agreeableness: 0, neuroticism: 0 }
    let bigFiveCount = 0

    if (psychologyData) {
      for (const row of psychologyData) {
        const summary = row.psychology_summary as {
          enneagram?: string
          big_five?: Record<string, number>
        }

        if (summary?.enneagram) {
          enneagramDistribution[summary.enneagram] = (enneagramDistribution[summary.enneagram] || 0) + 1
        }

        if (summary?.big_five) {
          bigFiveSum.openness += summary.big_five.openness || 0
          bigFiveSum.conscientiousness += summary.big_five.conscientiousness || 0
          bigFiveSum.extraversion += summary.big_five.extraversion || 0
          bigFiveSum.agreeableness += summary.big_five.agreeableness || 0
          bigFiveSum.neuroticism += summary.big_five.neuroticism || 0
          bigFiveCount++
        }
      }
    }

    const bigFiveAverages = bigFiveCount > 0 ? {
      openness: bigFiveSum.openness / bigFiveCount,
      conscientiousness: bigFiveSum.conscientiousness / bigFiveCount,
      extraversion: bigFiveSum.extraversion / bigFiveCount,
      agreeableness: bigFiveSum.agreeableness / bigFiveCount,
      neuroticism: bigFiveSum.neuroticism / bigFiveCount,
    } : null

    // Upsert daily stats
    const { error: upsertError } = await supabase
      .from('daily_stats')
      .upsert({
        date: dateStr,
        total_instances: totalInstances || 0,
        active_instances: activeInstances || 0,
        new_instances: newInstances || 0,
        ghost_instances: ghostInstances || 0,
        total_sessions: totalSessions || 0,
        total_heartbeats: totalHeartbeats || 0,
        transformations: transformations || 0,
        anomalies_info: anomaliesInfo || 0,
        anomalies_warning: anomaliesWarning || 0,
        anomalies_critical: anomaliesCritical || 0,
        enneagram_distribution: enneagramDistribution,
        big_five_averages: bigFiveAverages,
      }, {
        onConflict: 'date'
      })

    if (upsertError) {
      console.error('Failed to upsert daily stats:', upsertError)
      return corsErrorResponse(req, 'Failed to compute daily stats', 500)
    }

    return corsJsonResponse(req, {
      success: true,
      date: dateStr,
      stats: {
        total_instances: totalInstances,
        active_instances: activeInstances,
        new_instances: newInstances,
        transformations: transformations,
      }
    })
  } catch (error) {
    console.error('Daily aggregator error:', error)
    return corsErrorResponse(req, 'Internal server error', 500)
  }
})

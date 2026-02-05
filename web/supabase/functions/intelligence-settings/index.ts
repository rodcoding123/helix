/**
 * Intelligence Settings Edge Function
 * Manages AI operation settings, model configuration, and budget limits
 * Uses existing Phase 0.5 control plane tables
 * Used by web, iOS, and Android clients
 *
 * Features:
 * - Token validation with automatic refresh support
 * - Returns new tokens in response headers when refreshed
 * - CORS protection for allowed origins only
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import {
  handleCorsPreflightRequest,
  corsJsonResponse,
  corsErrorResponse,
  getCorsHeaders,
} from '../_shared/cors.ts'
import {
  extractBearerToken,
  validateToken,
  refreshAccessToken,
  needsRefresh,
} from '../_shared/auth.ts'

interface OperationSetting {
  operation_id: string;
  operation_name: string;
  description: string;
  primary_model: string;
  fallback_model: string;
  cost_criticality: 'LOW' | 'MEDIUM' | 'HIGH';
  estimated_cost_usd: number;
  enabled: boolean;
}

interface BudgetSetting {
  daily_limit_usd: number;
  monthly_limit_usd: number;
  warning_threshold: number;
}

interface UsageStats {
  daily_usd: number;
  monthly_usd: number;
  daily_operations: number;
  monthly_operations: number;
  budget_status: 'ok' | 'warning' | 'exceeded';
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

    // Extract and validate access token
    const accessToken = extractBearerToken(req)
    if (!accessToken) {
      return corsErrorResponse(req, 'Authorization header missing or invalid', 401)
    }

    // Validate token
    const authResult = await validateToken(accessToken)
    if (authResult.error || !authResult.user) {
      return corsErrorResponse(req, authResult.error || 'Invalid token', authResult.statusCode)
    }

    const user = authResult.user

    // Check if token is expiring soon - if refresh token provided, refresh it
    // Mobile clients can send refresh token in X-Refresh-Token header for proactive refresh
    let newTokenHeaders: Record<string, string> = {}
    const refreshToken = req.headers.get('x-refresh-token')

    if (refreshToken && needsRefresh(accessToken)) {
      const refreshResult = await refreshAccessToken(refreshToken)
      if (refreshResult.accessToken) {
        // Include new tokens in response headers for client to update
        newTokenHeaders = {
          'X-New-Access-Token': refreshResult.accessToken,
          ...(refreshResult.refreshToken && { 'X-New-Refresh-Token': refreshResult.refreshToken }),
          ...(refreshResult.expiresAt && { 'X-Token-Expires-At': refreshResult.expiresAt.toString() }),
        }
      }
    }

    // GET - Fetch settings
    if (req.method === 'GET') {
      // Get all operations from ai_model_routes
      const { data: operations, error: opsError } = await supabase
        .from('ai_model_routes')
        .select('*')
        .order('operation_id')

      if (opsError) {
        console.error('Failed to fetch operations:', opsError)
        return corsErrorResponse(req, 'Failed to fetch operations', 500)
      }

      // Get user's feature overrides
      const { data: overrides } = await supabase
        .from('user_feature_overrides')
        .select('toggle_name, enabled')
        .eq('user_id', user.id)

      // Create override map
      const overrideMap = new Map<string, boolean>()
      if (overrides) {
        for (const override of overrides) {
          overrideMap.set(override.toggle_name, override.enabled)
        }
      }

      // Map operations with user-specific enabled status
      const operationSettings: OperationSetting[] = (operations || []).map(op => {
        const toggleName = `phase8-${op.operation_id}`
        const hasOverride = overrideMap.has(toggleName)
        return {
          operation_id: op.operation_id,
          operation_name: op.operation_name,
          description: op.description,
          primary_model: op.primary_model,
          fallback_model: op.fallback_model,
          cost_criticality: op.cost_criticality,
          estimated_cost_usd: op.estimated_cost_usd || 0,
          enabled: hasOverride ? overrideMap.get(toggleName)! : op.enabled,
        }
      })

      // Get user's budget settings
      const { data: budget, error: budgetError } = await supabase
        .from('cost_budgets')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (budgetError && budgetError.code !== 'PGRST116') {
        console.error('Failed to fetch budget:', budgetError)
      }

      const budgetSettings: BudgetSetting = budget ? {
        daily_limit_usd: budget.daily_limit_usd,
        monthly_limit_usd: budget.monthly_limit_usd,
        warning_threshold: budget.warning_threshold_percentage,
      } : {
        daily_limit_usd: 50.0,
        monthly_limit_usd: 1000.0,
        warning_threshold: 80,
      }

      const usage: UsageStats = budget ? {
        daily_usd: budget.current_spend_today || 0,
        monthly_usd: budget.current_spend_month || 0,
        daily_operations: budget.operations_today || 0,
        monthly_operations: budget.operations_month || 0,
        budget_status: budget.budget_status || 'ok',
      } : {
        daily_usd: 0,
        monthly_usd: 0,
        daily_operations: 0,
        monthly_operations: 0,
        budget_status: 'ok',
      }

      // Return response with any new token headers
      const corsHeaders = getCorsHeaders(req)
      return new Response(JSON.stringify({
        operations: operationSettings,
        budget: budgetSettings,
        usage,
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          ...newTokenHeaders,
          'Content-Type': 'application/json',
        },
      })
    }

    // POST - Save settings
    if (req.method === 'POST') {
      const body = await req.json()

      // Update operation toggles (user_feature_overrides)
      if (body.operations && Array.isArray(body.operations)) {
        for (const op of body.operations) {
          const toggleName = `phase8-${op.operation_id}`

          // Upsert user override
          const { error: overrideError } = await supabase
            .from('user_feature_overrides')
            .upsert({
              user_id: user.id,
              toggle_name: toggleName,
              enabled: op.enabled,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id,toggle_name',
            })

          if (overrideError) {
            console.error('Failed to save override:', overrideError)
          }
        }
      }

      // Update budget settings
      if (body.budget) {
        const { error: budgetError } = await supabase
          .from('cost_budgets')
          .upsert({
            user_id: user.id,
            daily_limit_usd: body.budget.daily_limit_usd ?? 50.0,
            monthly_limit_usd: body.budget.monthly_limit_usd ?? 1000.0,
            warning_threshold_percentage: body.budget.warning_threshold ?? 80,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id',
          })

        if (budgetError) {
          console.error('Failed to save budget:', budgetError)
          return corsErrorResponse(req, 'Failed to save budget settings', 500)
        }
      }

      // Return response with any new token headers
      const corsHeaders = getCorsHeaders(req)
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          ...corsHeaders,
          ...newTokenHeaders,
          'Content-Type': 'application/json',
        },
      })
    }

    return corsErrorResponse(req, 'Method not allowed', 405)
  } catch (error) {
    console.error('Intelligence settings error:', error)
    return corsErrorResponse(req, 'Internal server error', 500)
  }
})

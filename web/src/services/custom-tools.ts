import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import type {
  CustomTool,
  CustomToolDefinition,
  ToolCapability,
  CodeValidationResult,
  JSONSchema,
  ToolParameter,
} from '@/lib/types/custom-tools';

/**
 * CustomToolsService: Manages creation, validation, and execution of custom tools
 * Handles sandbox validation, code analysis, and secure execution
 */
export class CustomToolsService {
  private supabase: SupabaseClient | null = null;

  private getSupabaseClient(): SupabaseClient {
    if (this.supabase) return this.supabase;
    this.supabase = getSupabaseBrowserClient();
    return this.supabase;
  }

  /**
   * Validate tool code for security issues
   */
  validateToolCode(code: string, capabilities: ToolCapability[]): CodeValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const dangerousFunctions: string[] = [];

    // Dangerous functions that should not be allowed
    const dangerousPatterns = [
      { pattern: /eval\s*\(/, name: 'eval' },
      { pattern: /Function\s*\(/, name: 'Function constructor' },
      { pattern: /require\s*\(/, name: 'require' },
      { pattern: /import\s*\(/, name: 'dynamic import' },
      { pattern: /process\./, name: 'process access' },
      { pattern: /child_process/, name: 'child_process' },
      { pattern: /exec\s*\(/, name: 'exec' },
      { pattern: /system\s*\(/, name: 'system' },
      { pattern: /__proto__/, name: '__proto__ mutation' },
      { pattern: /constructor\.prototype/, name: 'prototype pollution' },
    ];

    // Check for dangerous patterns
    for (const { pattern, name } of dangerousPatterns) {
      if (pattern.test(code)) {
        dangerousFunctions.push(name);
        errors.push(`Dangerous function detected: ${name}`);
      }
    }

    // Validate capabilities
    const hasFileWrite = capabilities.includes('filesystem:write');
    const hasNetworkOutbound = capabilities.includes('network:outbound');
    const hasProcessSpawn = capabilities.includes('process:spawn');

    if (hasFileWrite) {
      warnings.push('Tool has file write access - ensure it only modifies intended paths');
    }
    if (hasNetworkOutbound) {
      warnings.push('Tool has outbound network access - monitor for data exfiltration');
    }
    if (hasProcessSpawn) {
      errors.push('Process spawning requires admin approval - not allowed for user tools');
      capabilities.splice(capabilities.indexOf('process:spawn'), 1);
    }

    // Check code structure
    if (!code.includes('async function execute') && !code.includes('function execute')) {
      errors.push('Tool code must export an async execute function');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      detectedDangerousFunctions: dangerousFunctions,
    };
  }

  /**
   * Convert tool parameters to JSON Schema
   */
  private parametersToJsonSchema(parameters: ToolParameter[]): JSONSchema {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const param of parameters) {
      properties[param.name] = {
        type: param.type,
        description: param.description,
      };

      if (param.defaultValue !== undefined) {
        properties[param.name].default = param.defaultValue;
      }

      if (param.required) {
        required.push(param.name);
      }
    }

    return {
      type: 'object',
      properties,
      required,
    };
  }

  /**
   * Create a new custom tool
   */
  async createCustomTool(userId: string, definition: CustomToolDefinition): Promise<CustomTool> {
    try {
      // Validate code
      const validation = this.validateToolCode(definition.code, definition.capabilities);
      if (!validation.valid) {
        throw new Error(`Code validation failed: ${validation.errors.join(', ')}`);
      }

      const supabase = this.getSupabaseClient();

      const jsonSchema = this.parametersToJsonSchema(definition.parameters);

      const { data, error } = await supabase
        .from('custom_tools')
        .insert([
          {
            user_id: userId,
            name: definition.name,
            description: definition.description,
            parameters: jsonSchema,
            code: definition.code,
            capabilities: definition.capabilities,
            sandbox_profile: definition.sandbox_profile || 'standard',
            tags: definition.tags || [],
            icon: definition.icon || '🔧',
            visibility: definition.visibility || 'private',
            is_enabled: true,
          },
        ])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create tool: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Failed to create custom tool:', error);
      throw error;
    }
  }

  /**
   * Get all custom tools for a user
   */
  async getCustomTools(userId: string, options?: { enabled?: boolean }): Promise<CustomTool[]> {
    try {
      const supabase = this.getSupabaseClient();

      let query = supabase
        .from('custom_tools')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (options?.enabled !== undefined) {
        query = query.eq('is_enabled', options.enabled);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch tools: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get custom tools:', error);
      throw error;
    }
  }

  /**
   * Get a specific tool by ID
   */
  async getCustomTool(toolId: string): Promise<CustomTool> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('custom_tools')
        .select('*')
        .eq('id', toolId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch tool: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Failed to get custom tool:', error);
      throw error;
    }
  }

  /**
   * Update a custom tool
   */
  async updateCustomTool(
    toolId: string,
    updates: Partial<CustomToolDefinition>
  ): Promise<CustomTool> {
    try {
      // Validate code if updating
      if (updates.code) {
        const validation = this.validateToolCode(
          updates.code,
          updates.capabilities || []
        );
        if (!validation.valid) {
          throw new Error(`Code validation failed: ${validation.errors.join(', ')}`);
        }
      }

      const supabase = this.getSupabaseClient();

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name) updateData.name = updates.name;
      if (updates.description) updateData.description = updates.description;
      if (updates.code) updateData.code = updates.code;
      if (updates.capabilities) updateData.capabilities = updates.capabilities;
      if (updates.sandbox_profile) updateData.sandbox_profile = updates.sandbox_profile;
      if (updates.tags) updateData.tags = updates.tags;
      if (updates.icon) updateData.icon = updates.icon;
      if (updates.visibility) updateData.visibility = updates.visibility;
      if (updates.parameters) {
        updateData.parameters = this.parametersToJsonSchema(updates.parameters);
      }

      const { data, error } = await supabase
        .from('custom_tools')
        .update(updateData)
        .eq('id', toolId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update tool: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Failed to update custom tool:', error);
      throw error;
    }
  }

  /**
   * Delete a custom tool (soft delete)
   */
  async deleteCustomTool(toolId: string): Promise<void> {
    try {
      const supabase = this.getSupabaseClient();

      const { error } = await supabase
        .from('custom_tools')
        .update({ is_enabled: false })
        .eq('id', toolId);

      if (error) {
        throw new Error(`Failed to delete tool: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to delete custom tool:', error);
      throw error;
    }
  }

  /**
   * Clone a public tool
   */
  async clonePublicTool(userId: string, sourceToolId: string, newName?: string): Promise<CustomTool> {
    try {
      const supabase = this.getSupabaseClient();

      // Get source tool
      const { data: sourceTool, error: fetchError } = await supabase
        .from('custom_tools')
        .select('*')
        .eq('id', sourceToolId)
        .eq('visibility', 'public')
        .single();

      if (fetchError || !sourceTool) {
        throw new Error('Tool not found or is not public');
      }

      // Create cloned version
      const { data, error } = await supabase
        .from('custom_tools')
        .insert([
          {
            user_id: userId,
            name: newName || `${sourceTool.name} (Clone)`,
            description: sourceTool.description,
            parameters: sourceTool.parameters,
            code: sourceTool.code,
            capabilities: sourceTool.capabilities,
            sandbox_profile: sourceTool.sandbox_profile,
            tags: sourceTool.tags,
            icon: sourceTool.icon,
            visibility: 'private',
            clone_source_id: sourceToolId,
          },
        ])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to clone tool: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Failed to clone custom tool:', error);
      throw error;
    }
  }

  /**
   * Get public tools (marketplace)
   */
  async getPublicTools(options?: {
    search?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<CustomTool[]> {
    try {
      const supabase = this.getSupabaseClient();

      let query = supabase
        .from('custom_tools')
        .select('*')
        .eq('visibility', 'public')
        .eq('is_enabled', true)
        .order('usage_count', { ascending: false });

      if (options?.search) {
        query = query.or(
          `name.ilike.%${options.search}%,description.ilike.%${options.search}%`
        );
      }

      if (options?.tags && options.tags.length > 0) {
        query = query.contains('tags', options.tags);
      }

      const limit = options?.limit || 20;
      const offset = options?.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch public tools: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get public tools:', error);
      throw error;
    }
  }

  /**
   * Log tool usage
   */
  async logToolUsage(
    toolId: string,
    userId: string,
    input: any,
    output: any,
    status: 'success' | 'failure' | 'timeout',
    executionTimeMs: number,
    error?: string
  ): Promise<void> {
    try {
      const supabase = this.getSupabaseClient();

      await supabase.from('custom_tool_usage').insert([
        {
          custom_tool_id: toolId,
          user_id: userId,
          input_params: input,
          output_result: output,
          status,
          error_message: error,
          execution_time_ms: executionTimeMs,
          memory_used_mb: 0, // Would be populated by runtime
        },
      ]);

      // Update tool usage count
      if (status === 'success') {
        await supabase
          .from('custom_tools')
          .update({
            usage_count: supabase.rpc('increment', { id: toolId }),
            last_used: new Date().toISOString(),
          })
          .eq('id', toolId);
      }
    } catch (error) {
      console.error('Failed to log tool usage:', error);
      // Non-fatal - don't throw
    }
  }

  /**
   * Execute a custom tool via the gateway RPC
   */
  async executeTool(
    userId: string,
    toolId: string,
    params: Record<string, any>
  ): Promise<{ output: any; executionTimeMs: number; success: boolean; error?: string }> {
    try {
      const { getGatewayRPCClient } = await import('@/lib/gateway-rpc-client');
      const client = getGatewayRPCClient();

      const startTime = Date.now();
      const result = await client.executeCustomTool(toolId, userId, params);
      const executionTimeMs = Date.now() - startTime;

      // Log the execution
      await this.logToolUsage(toolId, userId, params, result.output, 'success', executionTimeMs);

      return {
        output: result.output,
        executionTimeMs,
        success: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.logToolUsage(
        toolId,
        userId,
        params,
        null,
        'failure',
        0,
        message
      );

      return {
        output: null,
        executionTimeMs: 0,
        success: false,
        error: message,
      };
    }
  }

  /**
   * Get tool usage history
   */
  async getToolUsageHistory(toolId: string, limit: number = 50): Promise<any[]> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('custom_tool_usage')
        .select('*')
        .eq('custom_tool_id', toolId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch usage history: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get tool usage history:', error);
      throw error;
    }
  }
}

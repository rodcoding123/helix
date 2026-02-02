/**
 * Custom Tools Hook for Desktop
 * Provides tool creation, validation, and execution via gateway RPC
 */

import { useState, useCallback, useRef } from 'react';
import { useGateway } from './useGateway';
import type { GatewayClient } from '../lib/gateway-client';

export interface CustomTool {
  id: string;
  name: string;
  description: string;
  code: string;
  capabilities?: string[];
  sandboxProfile?: 'strict' | 'standard' | 'permissive';
  parameters?: Record<string, unknown>;
  version?: string;
  tags?: string[];
  usageCount?: number;
  lastUsed?: string;
  visibility?: 'private' | 'public';
}

export interface CodeValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  detectedDangerousFunctions: string[];
}

export interface ToolExecutionResult {
  success: boolean;
  output: unknown;
  executionTimeMs: number;
  auditLog: Array<{ type: string; message: string; timestamp: number }>;
  error?: string;
}

export function useCustomTools() {
  const { getClient, connected } = useGateway();

  const [customTools, setCustomTools] = useState<CustomTool[]>([]);
  const [publicTools, setPublicTools] = useState<CustomTool[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<CodeValidationResult | null>(null);

  const clientRef = useRef<GatewayClient | null>(null);

  // Get client reference
  const ensureClient = useCallback(() => {
    const client = getClient();
    if (!client?.connected) {
      throw new Error('Gateway not connected');
    }
    clientRef.current = client;
    return client;
  }, [getClient]);

  // Load user's custom tools
  const loadCustomTools = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const client = ensureClient();

      const result = await client.request<{ tools: CustomTool[] }>('tools.list', {});
      setCustomTools(result.tools || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load custom tools';
      setError(message);
      console.error('Failed to load custom tools:', err);
    } finally {
      setIsLoading(false);
    }
  }, [ensureClient]);

  // Load public tools
  const loadPublicTools = useCallback(async () => {
    try {
      const client = ensureClient();

      const result = await client.request<{ tools: CustomTool[] }>('tools.list', {
        visibility: 'public'
      });
      setPublicTools(result.tools || []);
    } catch (err) {
      console.error('Failed to load public tools:', err);
    }
  }, [ensureClient]);

  // Validate tool code
  const validateCode = useCallback(async (code: string, capabilities: string[]) => {
    try {
      setIsLoading(true);
      setError(null);

      // Basic client-side validation
      const errors: string[] = [];
      const warnings: string[] = [];
      const dangerousFunctions: string[] = [];

      // Check for dangerous patterns
      const dangerousPatterns = [
        { pattern: /\beval\s*\(/, name: 'eval' },
        { pattern: /\bFunction\s*\(/, name: 'Function constructor' },
        { pattern: /\brequire\s*\(/, name: 'require' },
        { pattern: /\bimport\s*\(/, name: 'dynamic import' },
        { pattern: /\bprocess\./, name: 'process access' },
      ];

      for (const { pattern, name } of dangerousPatterns) {
        if (pattern.test(code)) {
          dangerousFunctions.push(name);
          errors.push(`Dangerous function detected: ${name}`);
        }
      }

      // Validate capabilities
      if (capabilities.includes('filesystem:write')) {
        warnings.push('Tool has file write access - ensure it only modifies intended paths');
      }
      if (capabilities.includes('network:outbound')) {
        warnings.push('Tool has outbound network access - monitor for data exfiltration');
      }

      const result: CodeValidationResult = {
        valid: errors.length === 0,
        errors,
        warnings,
        detectedDangerousFunctions: dangerousFunctions
      };

      setValidationResult(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validation failed';
      setError(message);
      console.error('Validation failed:', err);
      return {
        valid: false,
        errors: [message],
        warnings: [],
        detectedDangerousFunctions: []
      };
    } finally {
      setIsLoading(false);
    }
  }, [ensureClient]);

  // Create new custom tool
  const createCustomTool = useCallback(async (tool: Omit<CustomTool, 'id'>) => {
    try {
      setIsLoading(true);
      setError(null);

      const client = ensureClient();

      const result = await client.request<{ id: string }>('tools.create', {
        ...tool,
        sandboxProfile: tool.sandboxProfile || 'standard'
      });

      // Reload tools
      await loadCustomTools();

      return result.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create tool';
      setError(message);
      console.error('Failed to create tool:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [ensureClient, loadCustomTools]);

  // Execute custom tool
  const executeTool = useCallback(async (toolId: string, params: Record<string, unknown>) => {
    try {
      setIsLoading(true);
      setError(null);

      const client = ensureClient();

      const result = await client.request<ToolExecutionResult>('tools.execute_custom', {
        toolId,
        params
      });

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tool execution failed';
      setError(message);
      console.error('Tool execution failed:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [ensureClient]);

  // Get tool metadata
  const getToolMetadata = useCallback(async (toolId: string) => {
    try {
      const client = ensureClient();

      const result = await client.request<CustomTool>('tools.get_metadata', {
        toolId
      });

      return result;
    } catch (err) {
      console.error('Failed to get tool metadata:', err);
      throw err;
    }
  }, [ensureClient]);

  // Clone tool
  const cloneTool = useCallback(async (sourceToolId: string, name: string) => {
    try {
      setIsLoading(true);
      const client = ensureClient();

      const source = await getToolMetadata(sourceToolId);

      const result = await client.request<{ id: string }>('tools.create', {
        ...source,
        name,
        id: undefined,
        clone_source_id: sourceToolId
      });

      await loadCustomTools();
      return result.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clone tool';
      setError(message);
      console.error('Failed to clone tool:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [ensureClient, getToolMetadata, loadCustomTools]);

  // Delete tool
  const deleteTool = useCallback(async (toolId: string) => {
    try {
      setIsLoading(true);
      const client = ensureClient();

      await client.request('tools.delete', { toolId });

      await loadCustomTools();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete tool';
      setError(message);
      console.error('Failed to delete tool:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [ensureClient, loadCustomTools]);

  return {
    // State
    customTools,
    publicTools,
    isLoading,
    error,
    validationResult,
    connected,

    // Methods
    loadCustomTools,
    loadPublicTools,
    validateCode,
    createCustomTool,
    executeTool,
    getToolMetadata,
    cloneTool,
    deleteTool,
  };
}

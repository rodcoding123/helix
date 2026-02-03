import { useState, useCallback, useRef } from 'react';
import type { CustomTool, CustomToolDefinition, CodeValidationResult } from '@/lib/types/custom-tools';
import { CustomToolsService } from '@/services/custom-tools';

export function useCustomTools() {
  const [customTools, setCustomTools] = useState<CustomTool[]>([]);
  const [publicTools, setPublicTools] = useState<CustomTool[]>([]);
  const [currentTool, setCurrentTool] = useState<CustomTool | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<CodeValidationResult | null>(null);

  const serviceRef = useRef<CustomToolsService | null>(null);

  const getService = useCallback(() => {
    if (!serviceRef.current) {
      serviceRef.current = new CustomToolsService();
    }
    return serviceRef.current;
  }, []);

  /**
   * Validate tool code
   */
  const validateCode = useCallback((code: string, capabilities: string[]) => {
    const service = getService();
    const result = service.validateToolCode(code, capabilities as any);
    setValidationResult(result);
    return result;
  }, [getService]);

  /**
   * Create custom tool
   */
  const createCustomTool = useCallback(
    async (userId: string, definition: CustomToolDefinition): Promise<CustomTool> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const tool = await service.createCustomTool(userId, definition);
        setCustomTools((prev) => [tool, ...prev]);
        return tool;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create tool';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  /**
   * Get user's custom tools
   */
  const loadCustomTools = useCallback(
    async (userId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const tools = await service.getCustomTools(userId);
        setCustomTools(tools);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load tools';
        setError(message);
        console.error('Failed to load custom tools:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  /**
   * Load public tools marketplace
   */
  const loadPublicTools = useCallback(
    async (options?: { search?: string; tags?: string[] }): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const tools = await service.getPublicTools(options);
        setPublicTools(tools);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load public tools';
        setError(message);
        console.error('Failed to load public tools:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  /**
   * Get a specific tool
   */
  const loadTool = useCallback(
    async (toolId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const tool = await service.getCustomTool(toolId);
        setCurrentTool(tool);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load tool';
        setError(message);
        console.error('Failed to load tool:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  /**
   * Update tool
   */
  const updateTool = useCallback(
    async (toolId: string, updates: Partial<CustomToolDefinition>): Promise<CustomTool> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const tool = await service.updateCustomTool(toolId, updates);
        setCustomTools((prev) =>
          prev.map((t) => (t.id === toolId ? tool : t))
        );
        if (currentTool?.id === toolId) {
          setCurrentTool(tool);
        }
        return tool;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update tool';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getService, currentTool?.id]
  );

  /**
   * Delete tool
   */
  const deleteTool = useCallback(
    async (toolId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        await service.deleteCustomTool(toolId);
        setCustomTools((prev) => prev.filter((t) => t.id !== toolId));
        if (currentTool?.id === toolId) {
          setCurrentTool(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete tool';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getService, currentTool?.id]
  );

  /**
   * Clone a public tool
   */
  const clonePublicTool = useCallback(
    async (userId: string, sourceToolId: string, newName?: string): Promise<CustomTool> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const tool = await service.clonePublicTool(userId, sourceToolId, newName);
        setCustomTools((prev) => [tool, ...prev]);
        return tool;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to clone tool';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  /**
   * Execute a tool with given parameters
   */
  const executeTool = useCallback(
    async (userId: string, toolId: string, params: Record<string, any>) => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const result = await service.executeTool(userId, toolId, params);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to execute tool';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  /**
   * Get tool usage history
   */
  const getUsageHistory = useCallback(
    async (toolId: string, limit: number = 50): Promise<any[]> => {
      try {
        const service = getService();
        return await service.getToolUsageHistory(toolId, limit);
      } catch (err) {
        console.error('Failed to get usage history:', err);
        throw err;
      }
    },
    [getService]
  );

  return {
    // State
    customTools,
    publicTools,
    currentTool,
    isLoading,
    error,
    validationResult,

    // Methods
    validateCode,
    createCustomTool,
    loadCustomTools,
    loadPublicTools,
    loadTool,
    updateTool,
    deleteTool,
    clonePublicTool,
    executeTool,
    getUsageHistory,
  };
}

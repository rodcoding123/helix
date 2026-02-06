/**
 * Tauri File Operations Hook
 * Manages file I/O, import/export, and desktop notifications
 */

import { useCallback, useState } from 'react';
import {
  exportTool,
  exportSkill,
  importTool,
  importSkill,
  saveExecutionResult,
  showNotification,
  notifyCompletion,
  copyToClipboard,
  pasteFromClipboard,
  type NotificationType,
  type Exportable
} from '../services/tauri-commands';

interface FileOpState {
  isLoading: boolean;
  error: string | null;
  progress: number;
}

/**
 * Custom hook for Tauri file operations
 */
export function useTauriFileOps() {
  const [state, setState] = useState<FileOpState>({
    isLoading: false,
    error: null,
    progress: 0
  });

  /**
   * Handle tool export
   */
  const handleExportTool = useCallback(async (tool: Exportable): Promise<void> => {
    try {
      setState({ isLoading: true, error: null, progress: 0 });
      setState(prev => ({ ...prev, progress: 25 }));

      await exportTool(tool);

      setState(prev => ({ ...prev, progress: 100 }));
      setTimeout(() => {
        setState({ isLoading: false, error: null, progress: 0 });
      }, 500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export tool';
      setState({ isLoading: false, error: message, progress: 0 });
    }
  }, []);

  /**
   * Handle skill export
   */
  const handleExportSkill = useCallback(async (skill: Exportable): Promise<void> => {
    try {
      setState({ isLoading: true, error: null, progress: 0 });
      setState(prev => ({ ...prev, progress: 25 }));

      await exportSkill(skill);

      setState(prev => ({ ...prev, progress: 100 }));
      setTimeout(() => {
        setState({ isLoading: false, error: null, progress: 0 });
      }, 500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export skill';
      setState({ isLoading: false, error: message, progress: 0 });
    }
  }, []);

  /**
   * Handle tool import
   */
  const handleImportTool = useCallback(async (): Promise<string | null> => {
    try {
      setState({ isLoading: true, error: null, progress: 0 });
      setState(prev => ({ ...prev, progress: 25 }));

      const content = await importTool();

      setState(prev => ({ ...prev, progress: 100 }));
      setTimeout(() => {
        setState({ isLoading: false, error: null, progress: 0 });
      }, 500);

      return content;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import tool';
      setState({ isLoading: false, error: message, progress: 0 });
      throw err;
    }
  }, []);

  /**
   * Handle skill import
   */
  const handleImportSkill = useCallback(async (): Promise<string | null> => {
    try {
      setState({ isLoading: true, error: null, progress: 0 });
      setState(prev => ({ ...prev, progress: 25 }));

      const content = await importSkill();

      setState(prev => ({ ...prev, progress: 100 }));
      setTimeout(() => {
        setState({ isLoading: false, error: null, progress: 0 });
      }, 500);

      return content;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import skill';
      setState({ isLoading: false, error: message, progress: 0 });
      throw err;
    }
  }, []);

  /**
   * Handle saving execution results
   */
  const handleSaveResult = useCallback(
    async (
      result: unknown,
      name: string,
      type: 'tool' | 'skill'
    ): Promise<void> => {
      try {
        setState({ isLoading: true, error: null, progress: 0 });
        setState(prev => ({ ...prev, progress: 25 }));

        await saveExecutionResult(result, name, type);

        setState(prev => ({ ...prev, progress: 100 }));
        setTimeout(() => {
          setState({ isLoading: false, error: null, progress: 0 });
        }, 500);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save result';
        setState({ isLoading: false, error: message, progress: 0 });
      }
    },
    []
  );

  /**
   * Send notification
   */
  const sendNotify = useCallback(async (
    title: string,
    body: string,
    type: NotificationType = 'info'
  ): Promise<void> => {
    try {
      await showNotification(title, body, type);
    } catch (err) {
      console.error('Failed to send notification:', err);
    }
  }, []);

  /**
   * Notify operation completion
   */
  const notifyOpComplete = useCallback(async (
    operationType: 'tool' | 'skill' | 'synthesis',
    operationName: string,
    duration: number,
    success: boolean = true
  ): Promise<void> => {
    try {
      await notifyCompletion(operationType, operationName, duration, success);
    } catch (err) {
      console.error('Failed to notify completion:', err);
    }
  }, []);

  /**
   * Copy to clipboard
   */
  const copyText = useCallback(async (text: string): Promise<void> => {
    try {
      await copyToClipboard(text);
      await showNotification('Copied', 'Text copied to clipboard', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to copy';
      await showNotification('Copy Failed', message, 'error');
    }
  }, []);

  /**
   * Paste from clipboard
   */
  const pasteText = useCallback(async (): Promise<string | null> => {
    try {
      const text = await pasteFromClipboard();
      return text;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to paste';
      await showNotification('Paste Failed', message, 'error');
      return null;
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    // State
    isLoading: state.isLoading,
    error: state.error,
    progress: state.progress,

    // File operations
    exportTool: handleExportTool,
    exportSkill: handleExportSkill,
    importTool: handleImportTool,
    importSkill: handleImportSkill,
    saveResult: handleSaveResult,

    // Notifications
    notify: sendNotify,
    notifyCompletion: notifyOpComplete,

    // Clipboard
    copyToClipboard: copyText,
    pasteFromClipboard: pasteText,

    // Utilities
    clearError
  };
}

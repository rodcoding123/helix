import { useEffect, useRef, useCallback } from 'react';

interface UseAutoSaveDraftOptions {
  debounceMs?: number;
  onSave: (data: unknown) => Promise<void>;
  onError?: (error: Error) => void;
}

/**
 * Hook for auto-saving draft data with debouncing
 * Debounces saves to prevent excessive database writes
 * Automatically saves on unmount if there are pending changes
 */
export const useAutoSaveDraft = ({
  debounceMs = 500,
  onSave,
  onError,
}: UseAutoSaveDraftOptions) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingDataRef = useRef<unknown | null>(null);
  const isSavingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Save any pending data before unmount
      if (pendingDataRef.current !== null && !isSavingRef.current) {
        const finalData = pendingDataRef.current;
        isSavingRef.current = true;
        onSave(finalData).catch((error) => {
          onError?.(error instanceof Error ? error : new Error(String(error)));
        });
      }

      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [onSave, onError]);

  const triggerSave = useCallback(
    (data: unknown) => {
      // Update pending data
      pendingDataRef.current = data;

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new debounced timeout
      timeoutRef.current = setTimeout(async () => {
        if (pendingDataRef.current !== null) {
          try {
            isSavingRef.current = true;
            await onSave(pendingDataRef.current);
            pendingDataRef.current = null;
          } catch (error) {
            onError?.(error instanceof Error ? error : new Error(String(error)));
          } finally {
            isSavingRef.current = false;
          }
        }
      }, debounceMs);
    },
    [debounceMs, onSave, onError]
  );

  // Flush pending changes immediately
  const flush = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (pendingDataRef.current !== null && !isSavingRef.current) {
      try {
        isSavingRef.current = true;
        await onSave(pendingDataRef.current);
        pendingDataRef.current = null;
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
        throw error;
      } finally {
        isSavingRef.current = false;
      }
    }
  }, [onSave, onError]);

  return { triggerSave, flush };
};

export default useAutoSaveDraft;

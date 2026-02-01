import { useState, useEffect, useCallback } from 'react';
import { invoke } from '../lib/tauri-compat';

export interface PsychologyLayer {
  name: string;
  data: unknown;
  lastUpdated: number;
}

export interface PsychologyState {
  soul: string | null;
  layers: Record<string, unknown>;
  loading: boolean;
  error: string | null;
}

interface SoulResponse {
  content: string;
  lastModified: number;
}

interface LayerResponse {
  layer: string;
  data: unknown;
  lastModified: number;
}

const LAYER_NAMES = [
  'narrative',
  'emotional',
  'relational',
  'prospective',
  'integration',
  'transformation',
  'purpose',
] as const;

type LayerName = (typeof LAYER_NAMES)[number];

/**
 * Hook to load and observe psychology layers from the Helix system
 */
export function usePsychology() {
  const [state, setState] = useState<PsychologyState>({
    soul: null,
    layers: {},
    loading: true,
    error: null,
  });

  const loadSoul = useCallback(async () => {
    try {
      const response = await invoke<SoulResponse>('get_soul');
      setState((prev) => ({
        ...prev,
        soul: response.content,
        error: null,
      }));
    } catch (error) {
      console.error('Failed to load soul:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load soul',
      }));
    }
  }, []);

  const loadLayer = useCallback(async (layerName: LayerName) => {
    try {
      const response = await invoke<LayerResponse>('get_layer', { layer: layerName });
      setState((prev) => ({
        ...prev,
        layers: {
          ...prev.layers,
          [layerName]: response.data,
        },
        error: null,
      }));
    } catch (error) {
      console.error(`Failed to load layer ${layerName}:`, error);
      // Don't set error for individual layer failures
    }
  }, []);

  const loadAllLayers = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));

    try {
      // Try to load all layers via bulk endpoint first
      const response = await invoke<Record<string, LayerResponse>>('get_all_layers');
      const layers: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(response)) {
        layers[key] = value.data;
      }

      setState((prev) => ({
        ...prev,
        layers,
        loading: false,
        error: null,
      }));
    } catch (error) {
      // Fall back to loading layers individually
      console.warn('Bulk layer load failed, trying individual loads:', error);

      await Promise.all(LAYER_NAMES.map(loadLayer));

      setState((prev) => ({
        ...prev,
        loading: false,
      }));
    }
  }, [loadLayer]);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    await Promise.all([loadSoul(), loadAllLayers()]);
    setState((prev) => ({ ...prev, loading: false }));
  }, [loadSoul, loadAllLayers]);

  const updateSoul = useCallback(async (content: string) => {
    try {
      await invoke('update_soul', { content });
      setState((prev) => ({ ...prev, soul: content }));
    } catch (error) {
      console.error('Failed to update soul:', error);
      throw error;
    }
  }, []);

  const updateLayer = useCallback(async (layerName: LayerName, data: unknown) => {
    try {
      await invoke('update_layer', { layer: layerName, data });
      setState((prev) => ({
        ...prev,
        layers: {
          ...prev.layers,
          [layerName]: data,
        },
      }));
    } catch (error) {
      console.error(`Failed to update layer ${layerName}:`, error);
      throw error;
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setState((prev) => ({ ...prev, loading: true }));
      await loadSoul();
      await loadAllLayers();
      setState((prev) => ({ ...prev, loading: false }));
    };

    init();
  }, [loadSoul, loadAllLayers]);

  return {
    soul: state.soul,
    layers: state.layers,
    loading: state.loading,
    error: state.error,
    refresh,
    updateSoul,
    updateLayer,
    loadLayer,
  };
}

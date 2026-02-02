import { create } from 'zustand';
import type { UserApiKey } from '../types/secrets';

export interface SecretsState {
  // State
  secrets: UserApiKey[];
  loading: boolean;
  error: string | null;

  // Actions
  addSecret: (secret: UserApiKey) => void;
  removeSecret: (id: string) => void;
  updateSecret: (id: string, updates: Partial<UserApiKey>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useSecretsStore = create<SecretsState>((set) => ({
  // Initial state
  secrets: [],
  loading: false,
  error: null,

  // Actions
  addSecret: (secret: UserApiKey) =>
    set((state) => ({
      secrets: [...state.secrets, secret],
    })),

  removeSecret: (id: string) =>
    set((state) => ({
      secrets: state.secrets.filter((secret) => secret.id !== id),
    })),

  updateSecret: (id: string, updates: Partial<UserApiKey>) =>
    set((state) => ({
      secrets: state.secrets.map((secret) =>
        secret.id === id ? { ...secret, ...updates } : secret
      ),
    })),

  setLoading: (loading: boolean) => set({ loading }),

  setError: (error: string | null) => set({ error }),

  reset: () =>
    set({
      secrets: [],
      loading: false,
      error: null,
    }),
}));

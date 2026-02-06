/**
 * @deprecated Instances removed. User account = instance.
 * Use useAuth() for user identity instead.
 */

import type { Instance } from '@/lib/types';

interface UseInstancesReturn {
  instances: Instance[];
  loading: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (name: string, instanceKey?: string) => Promise<Instance | null>;
  createInstance: (name: string) => Promise<Instance | null>;
  remove: (id: string) => Promise<boolean>;
  deleteInstance: (id: string) => Promise<boolean>;
}

/** @deprecated Instances removed. User account = instance. Use useAuth() for user identity. */
export function useInstances(): UseInstancesReturn {
  if (import.meta.env.DEV) {
    console.warn('[useInstances] DEPRECATED: Instances removed. Use useAuth() for user identity.');
  }

  return {
    instances: [],
    loading: false,
    isLoading: false,
    error: null,
    refresh: async () => {},
    create: async () => null,
    createInstance: async () => null,
    remove: async () => false,
    deleteInstance: async () => false,
  };
}

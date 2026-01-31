import { useState, useEffect, useCallback } from 'react';
import { getInstances, createInstance, deleteInstance } from '@/lib/api';
import type { Instance } from '@/lib/types';
import { useAuth } from './useAuth';

interface UseInstancesReturn {
  instances: Instance[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (name: string, instanceKey: string) => Promise<Instance | null>;
  remove: (id: string) => Promise<boolean>;
}

export function useInstances(): UseInstancesReturn {
  const { user } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstances = useCallback(async () => {
    if (!user) {
      setInstances([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const data = await getInstances();
    setInstances(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  const create = useCallback(
    async (name: string, instanceKey: string): Promise<Instance | null> => {
      const instance = await createInstance(name, instanceKey);
      if (instance) {
        setInstances((prev) => [instance, ...prev]);
      }
      return instance;
    },
    []
  );

  const remove = useCallback(async (id: string): Promise<boolean> => {
    const success = await deleteInstance(id);
    if (success) {
      setInstances((prev) => prev.filter((i) => i.id !== id));
    }
    return success;
  }, []);

  return {
    instances,
    loading,
    error,
    refresh: fetchInstances,
    create,
    remove,
  };
}

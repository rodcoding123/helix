import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { TierGate } from '@/components/auth/TierGate';
import { CodeInterface } from '@/components/code';
import { getInstances } from '@/lib/api';
import type { Instance } from '@/lib/types';

export function Code() {
  const { user, session } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInstances() {
      if (!user) return;

      try {
        const data = await getInstances();
        setInstances(data);

        // Auto-select first active instance
        const activeInstance = data.find((i) => i.is_active) || data[0];
        if (activeInstance) {
          setSelectedInstance(activeInstance);
        }
      } catch (error) {
        console.error('Failed to load instances:', error);
      } finally {
        setLoading(false);
      }
    }

    loadInstances();
  }, [user]);

  return (
    <TierGate requiredTier="architect" className="h-full">
      <div className="h-full flex flex-col">
        {/* Instance selector header */}
        {instances.length > 1 && (
          <div className="flex items-center gap-4 px-6 py-3 border-b border-slate-700 bg-slate-900/50">
            <label className="text-sm text-slate-400">Instance:</label>
            <select
              value={selectedInstance?.id || ''}
              onChange={(e) => {
                const instance = instances.find((i) => i.id === e.target.value);
                setSelectedInstance(instance || null);
              }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:border-helix-500 focus:ring-1 focus:ring-helix-500 outline-none"
            >
              {instances.map((instance) => (
                <option key={instance.id} value={instance.id}>
                  {instance.name} {instance.is_active ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Main code interface */}
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin h-10 w-10 border-2 border-helix-500 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-slate-400">Loading instances...</p>
              </div>
            </div>
          ) : selectedInstance ? (
            <CodeInterface
              instanceKey={selectedInstance.instance_key}
              authToken={session?.access_token || ''}
              className="h-full"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md p-8">
                <h3 className="text-xl font-medium text-slate-200 mb-3">
                  No Instances Found
                </h3>
                <p className="text-slate-400 mb-6">
                  You need to register a Helix instance before using the Code Interface.
                  Run Helix locally and it will automatically appear here.
                </p>
                <a
                  href="/docs/getting-started"
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-helix-500 text-white hover:bg-helix-600 transition-colors"
                >
                  Getting Started Guide
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </TierGate>
  );
}

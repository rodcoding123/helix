import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { TierGate } from '@/components/auth/TierGate';
import { CodeInterface } from '@/components/code';
import { getInstances } from '@/lib/api';
import { Terminal, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
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
        const activeInstance = data.find(i => i.is_active) || data[0];
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
      <div className="h-full flex flex-col bg-bg-primary">
        {/* Instance selector header */}
        {instances.length > 1 && (
          <div className="flex items-center gap-4 px-6 py-3 border-b border-white/5 bg-bg-secondary/50 backdrop-blur-sm">
            <label className="text-sm text-text-secondary">Instance:</label>
            <select
              value={selectedInstance?.id || ''}
              onChange={e => {
                const instance = instances.find(i => i.id === e.target.value);
                setSelectedInstance(instance || null);
              }}
              className="bg-bg-tertiary border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-helix-500/50 focus:ring-2 focus:ring-helix-500/20 outline-none transition-all"
            >
              {instances.map(instance => (
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
                <div className="animate-spin h-12 w-12 border-2 border-helix-500 border-t-transparent rounded-full mx-auto mb-6" />
                <p className="text-text-secondary">Loading instances...</p>
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
                <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-helix-500/10 border border-helix-500/20">
                  <Terminal className="h-8 w-8 text-helix-400" />
                </div>
                <h3 className="text-2xl font-display font-bold text-white mb-3">
                  No Instances Found
                </h3>
                <p className="text-text-secondary mb-8">
                  You need to register a Helix instance before using the Code Interface. Run Helix
                  locally and it will automatically appear here.
                </p>
                <Link to="/docs/getting-started" className="btn btn-cta btn-cta-shimmer gap-2">
                  Getting Started Guide
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </TierGate>
  );
}

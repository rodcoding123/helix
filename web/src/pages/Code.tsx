import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { TierGate } from '@/components/auth/TierGate';
import { CodeInterface } from '@/components/code';
import { getInstances } from '@/lib/api';
import { Terminal, ArrowRight, WifiOff, Plus, Download, Wifi } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { Instance } from '@/lib/types';

export function Code() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
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
          ) : instances.length > 0 && instances.every(i => !i.is_active) ? (
            /* All instances exist but are offline */
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-lg p-8">
                <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <WifiOff className="h-8 w-8 text-amber-400" />
                </div>
                <h3 className="text-2xl font-display font-bold text-white mb-3">
                  Instances Offline
                </h3>
                <p className="text-text-secondary mb-6">
                  Your Helix instances exist but aren't connected. Start the local runtime to use
                  the Code Interface.
                </p>
                <div className="rounded-xl bg-bg-secondary/50 border border-white/5 p-4 mb-6 text-left">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-3">
                    Quick start
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-helix-500/20 text-helix-400 text-xs font-bold">1</div>
                      <code className="text-sm text-text-secondary">helix start</code>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-helix-500/20 text-helix-400 text-xs font-bold">2</div>
                      <span className="text-sm text-text-secondary">Wait for connection (appears automatically)</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => window.location.reload()}
                    className="btn btn-secondary gap-2"
                  >
                    <Wifi className="h-4 w-4" />
                    Refresh
                  </button>
                  <Link to="/docs/troubleshooting" className="btn btn-cta btn-cta-shimmer gap-2">
                    Troubleshooting
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            /* No instances at all */
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-lg p-8">
                <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-helix-500/10 border border-helix-500/20">
                  <Terminal className="h-8 w-8 text-helix-400" />
                </div>
                <h3 className="text-2xl font-display font-bold text-white mb-3">
                  Get Started with Code Interface
                </h3>
                <p className="text-text-secondary mb-6">
                  Create an instance and connect your local Helix runtime to start using the
                  Code Interface.
                </p>
                <div className="grid gap-3 sm:grid-cols-3 mb-8">
                  <div className="rounded-xl bg-bg-tertiary/30 border border-white/5 p-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-helix-500/20 text-helix-400 text-xs font-bold">1</div>
                      <Plus className="h-4 w-4 text-helix-400" />
                      <h4 className="text-sm font-medium text-white">Create</h4>
                    </div>
                    <p className="mt-2 text-xs text-text-tertiary leading-relaxed">Create an instance from the Dashboard</p>
                  </div>
                  <div className="rounded-xl bg-bg-tertiary/30 border border-white/5 p-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-helix-500/20 text-helix-400 text-xs font-bold">2</div>
                      <Download className="h-4 w-4 text-helix-400" />
                      <h4 className="text-sm font-medium text-white">Install</h4>
                    </div>
                    <p className="mt-2 text-xs text-text-tertiary leading-relaxed">Install the Helix CLI on your machine</p>
                  </div>
                  <div className="rounded-xl bg-bg-tertiary/30 border border-white/5 p-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-helix-500/20 text-helix-400 text-xs font-bold">3</div>
                      <Wifi className="h-4 w-4 text-helix-400" />
                      <h4 className="text-sm font-medium text-white">Connect</h4>
                    </div>
                    <p className="mt-2 text-xs text-text-tertiary leading-relaxed">Run helix start to connect</p>
                  </div>
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="btn btn-cta btn-cta-shimmer gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Go to Dashboard
                  </button>
                  <Link to="/docs/getting-started" className="btn btn-secondary gap-2">
                    Docs
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </TierGate>
  );
}

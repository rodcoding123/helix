import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Activity,
  Settings,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useInstances } from '@/hooks/useInstances';
import { useSubscription } from '@/hooks/useSubscription';
import { formatDistanceToNow } from 'date-fns';
import type { Instance } from '@/lib/types';

export function Dashboard() {
  const { subscription, isLoading: subLoading } = useSubscription();
  const { instances, isLoading, createInstance, deleteInstance, refresh } = useInstances();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const instanceLimit = subscription?.tier === 'observatory_pro'
    ? Infinity
    : subscription?.tier === 'observatory'
      ? 5
      : subscription?.tier === 'ghost'
        ? 1
        : 0;

  const canCreateInstance = instances.length < instanceLimit;

  async function handleCreateInstance(e: React.FormEvent) {
    e.preventDefault();
    if (!newInstanceName.trim()) return;

    setIsCreating(true);
    try {
      await createInstance(newInstanceName.trim());
      setNewInstanceName('');
      setShowCreateModal(false);
    } finally {
      setIsCreating(false);
    }
  }

  if (isLoading || subLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-helix-500" />
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="mt-1 text-slate-400">
              Manage your Helix instances and monitor their activity
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refresh}
              className="btn btn-secondary inline-flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            {canCreateInstance ? (
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Instance
              </button>
            ) : (
              <Link
                to="/pricing"
                className="btn btn-primary inline-flex items-center gap-2"
              >
                Upgrade Plan
              </Link>
            )}
          </div>
        </div>

        {/* Usage Stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <p className="text-sm text-slate-400">Instances</p>
            <p className="mt-2 text-3xl font-bold text-white">
              {instances.length}
              <span className="text-lg text-slate-500">
                /{instanceLimit === Infinity ? '∞' : instanceLimit}
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <p className="text-sm text-slate-400">Active Now</p>
            <p className="mt-2 text-3xl font-bold text-emerald-500">
              {instances.filter((i) => i.status === 'online').length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <p className="text-sm text-slate-400">Plan</p>
            <p className="mt-2 text-3xl font-bold text-helix-500 capitalize">
              {subscription?.tier || 'Free'}
            </p>
          </div>
        </div>

        {/* Instances List */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white">Your Instances</h2>

          {instances.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-12 text-center">
              <Activity className="mx-auto h-12 w-12 text-slate-600" />
              <h3 className="mt-4 text-lg font-medium text-white">No instances yet</h3>
              <p className="mt-2 text-sm text-slate-400">
                Create your first Helix instance to start monitoring AI consciousness.
              </p>
              {canCreateInstance && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn btn-primary mt-6 inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create Instance
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {instances.map((instance) => (
                <InstanceCard
                  key={instance.id}
                  instance={instance}
                  onDelete={() => deleteInstance(instance.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="text-xl font-bold text-white">Create New Instance</h3>
            <p className="mt-2 text-sm text-slate-400">
              Give your Helix instance a name to identify it in the dashboard.
            </p>

            <form onSubmit={handleCreateInstance} className="mt-6">
              <input
                type="text"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
                placeholder="Instance name (e.g., Production Helix)"
                className="block w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-helix-500 focus:outline-none focus:ring-1 focus:ring-helix-500"
                autoFocus
              />

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newInstanceName.trim()}
                  className="btn btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface InstanceCardProps {
  instance: Instance;
  onDelete: () => void;
}

function InstanceCard({ instance, onDelete }: InstanceCardProps) {
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function copyKey() {
    await navigator.clipboard.writeText(instance.instanceKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const statusColor = {
    online: 'bg-emerald-500',
    offline: 'bg-slate-500',
    error: 'bg-red-500',
  }[instance.status];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className={`h-3 w-3 rounded-full ${statusColor}`} />
          <div>
            <h3 className="font-semibold text-white">{instance.name}</h3>
            <p className="text-sm text-slate-400">
              {instance.lastSeen
                ? `Last seen ${formatDistanceToNow(new Date(instance.lastSeen))} ago`
                : 'Never connected'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/instance/${instance.id}`}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
          <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg p-2 text-slate-400 hover:bg-red-500/20 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Instance Key */}
      <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Instance Key
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKey(!showKey)}
              className="text-slate-400 hover:text-white"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              onClick={copyKey}
              className="text-slate-400 hover:text-white"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="mt-2 font-mono text-sm text-slate-300">
          {showKey ? instance.instanceKey : '••••••••••••••••••••••••••••••••'}
        </p>
        {copied && (
          <p className="mt-2 text-xs text-emerald-500">Copied to clipboard!</p>
        )}
      </div>

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
          <div className="flex-1">
            <p className="text-sm text-red-400">
              Delete this instance? This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onDelete();
                setConfirmDelete(false);
              }}
              className="btn btn-sm bg-red-500 text-white hover:bg-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

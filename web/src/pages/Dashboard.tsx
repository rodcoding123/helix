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
  Zap,
  TrendingUp,
  Check,
  Download,
  Key,
  Wifi,
  WifiOff,
  MessageSquare,
} from 'lucide-react';
import { useInstances } from '@/hooks/useInstances';
import { useSubscription } from '@/hooks/useSubscription';
import { formatDistanceToNow } from 'date-fns';
import type { Instance } from '@/lib/types';
import clsx from 'clsx';

export function Dashboard() {
  const { subscription, isLoading: subLoading } = useSubscription();
  const { instances, isLoading, createInstance, deleteInstance, refresh } = useInstances();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const instanceLimit =
    subscription?.tier === 'architect'
      ? Infinity
      : subscription?.tier === 'overseer'
        ? 5
        : subscription?.tier === 'phantom'
          ? 1
          : 1;

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
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-helix-500" />
          <p className="text-text-secondary">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Dashboard</h1>
            <p className="mt-1 text-text-secondary">
              Manage your Helix instances and monitor their activity
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={refresh} className="btn btn-secondary btn-sm gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            {canCreateInstance ? (
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-cta btn-sm btn-cta-shimmer gap-2"
              >
                <Plus className="h-4 w-4" />
                New Instance
              </button>
            ) : (
              <Link to="/pricing" className="btn btn-cta btn-sm gap-2">
                <TrendingUp className="h-4 w-4" />
                Upgrade Plan
              </Link>
            )}
          </div>
        </div>

        {/* Usage Stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Instances"
            value={instances.length}
            limit={instanceLimit === Infinity ? '∞' : instanceLimit}
            icon={<Activity className="h-5 w-5" />}
            color="helix"
          />
          <StatCard
            label="Active Now"
            value={instances.filter(i => i.is_active).length}
            icon={<Zap className="h-5 w-5" />}
            color="success"
          />
          <StatCard
            label="Plan"
            value={subscription?.tier || 'Free'}
            icon={<TrendingUp className="h-5 w-5" />}
            color="accent"
            isText
          />
        </div>

        {/* Instances List */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-white">Your Instances</h2>
            <span className="text-sm text-text-tertiary">
              {instances.length} of {instanceLimit === Infinity ? 'unlimited' : instanceLimit}
            </span>
          </div>

          {instances.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-bg-secondary/30 p-10">
              <div className="text-center">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-helix-500/10 flex items-center justify-center">
                  <Activity className="h-8 w-8 text-helix-400" />
                </div>
                <h3 className="mt-6 text-lg font-display font-medium text-white">
                  Get started with Helix
                </h3>
                <p className="mt-2 text-sm text-text-secondary max-w-md mx-auto">
                  Create an instance to begin. Each instance represents a Helix runtime you can
                  connect to from your local machine.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Link to="/chat" className="btn btn-cta btn-cta-shimmer gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Chat with Helix
                  </Link>
                  {canCreateInstance && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="btn btn-primary gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Create Instance
                    </button>
                  )}
                  <Link to="/setup" className="btn btn-secondary gap-2">
                    <Download className="h-4 w-4" />
                    Setup Guide
                  </Link>
                </div>
              </div>

              {/* Setup Steps */}
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <SetupStep
                  step={1}
                  title="Create instance"
                  description="Generate your unique instance key to identify your runtime"
                  icon={<Key className="h-4 w-4" />}
                />
                <SetupStep
                  step={2}
                  title="Install Helix CLI"
                  description="Run the CLI on your machine to start the local runtime"
                  icon={<Download className="h-4 w-4" />}
                />
                <SetupStep
                  step={3}
                  title="Connect & go"
                  description="Your instance appears here once the runtime connects"
                  icon={<Wifi className="h-4 w-4" />}
                />
              </div>
            </div>
          ) : instances.every(i => !i.is_active) && instances.length > 0 ? (
            <>
              {/* Offline banner */}
              <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
                <WifiOff className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-300">All instances offline</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Start your local Helix runtime to connect. Your instances will show as active
                    once the CLI is running.
                  </p>
                </div>
                <Link
                  to="/setup"
                  className="btn btn-sm btn-secondary gap-1.5 shrink-0 self-center"
                >
                  <Download className="h-3.5 w-3.5" />
                  Setup Guide
                </Link>
              </div>
              <div className="space-y-4">
                {instances.map(instance => (
                  <InstanceCard
                    key={instance.id}
                    instance={instance}
                    onDelete={() => deleteInstance(instance.id)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {instances.map(instance => (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md card-glass p-6 animate-scale-in">
            <h3 className="text-xl font-display font-bold text-white">Create New Instance</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Give your Helix instance a name to identify it in the dashboard.
            </p>

            <form onSubmit={handleCreateInstance} className="mt-6">
              <input
                type="text"
                value={newInstanceName}
                onChange={e => setNewInstanceName(e.target.value)}
                placeholder="Instance name (e.g., Production Helix)"
                className="input"
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
                  className="btn btn-cta flex-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number | string;
  limit?: number | string;
  icon: React.ReactNode;
  color: 'helix' | 'accent' | 'success';
  isText?: boolean;
}

const colorMap = {
  helix: {
    bg: 'bg-helix-500/10',
    text: 'text-helix-400',
    border: 'border-helix-500/20',
    glow: 'bg-helix-500/20',
  },
  accent: {
    bg: 'bg-accent-500/10',
    text: 'text-accent-400',
    border: 'border-accent-500/20',
    glow: 'bg-accent-500/20',
  },
  success: {
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/20',
    glow: 'bg-success/20',
  },
};

function StatCard({ label, value, limit, icon, color, isText }: StatCardProps) {
  const colors = colorMap[color];

  return (
    <div className="relative overflow-hidden rounded-xl bg-bg-secondary/50 border border-white/5 p-6">
      {/* Glow */}
      <div
        className={clsx('absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl', colors.glow)}
      />

      <div className="relative">
        <div className={clsx('inline-flex rounded-xl p-2.5 border', colors.bg, colors.border)}>
          <div className={colors.text}>{icon}</div>
        </div>
        <p className="mt-4 text-sm text-text-tertiary uppercase tracking-wide">{label}</p>
        <p
          className={clsx(
            'mt-1 text-3xl font-display font-bold',
            isText ? colors.text : 'text-white'
          )}
        >
          {isText ? (
            <span className="capitalize">{value}</span>
          ) : (
            <>
              {value}
              {limit && <span className="text-lg text-text-tertiary">/{limit}</span>}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

interface SetupStepProps {
  step: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

function SetupStep({ step, title, description, icon }: SetupStepProps) {
  return (
    <div className="rounded-xl bg-bg-tertiary/30 border border-white/5 p-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-helix-500/20 text-helix-400 text-xs font-bold">
          {step}
        </div>
        <div className="text-helix-400">{icon}</div>
        <h4 className="text-sm font-medium text-white">{title}</h4>
      </div>
      <p className="mt-2 text-xs text-text-tertiary leading-relaxed">{description}</p>
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
    await navigator.clipboard.writeText(instance.instance_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card p-6 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {/* Status Indicator */}
          <div className="relative">
            <div
              className={clsx(
                'h-3 w-3 rounded-full',
                instance.is_active ? 'bg-success' : 'bg-text-tertiary'
              )}
            />
            {instance.is_active && (
              <div className="absolute inset-0 h-3 w-3 rounded-full bg-success animate-ping opacity-50" />
            )}
          </div>

          <div>
            <h3 className="font-display font-semibold text-white">{instance.name}</h3>
            <p className="text-sm text-text-tertiary">
              {instance.last_seen
                ? `Last seen ${formatDistanceToNow(new Date(instance.last_seen))} ago`
                : 'Never connected'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Link
            to={`/instance/${instance.id}`}
            className="p-2 rounded-lg text-text-tertiary hover:bg-white/5 hover:text-white transition-colors"
            title="View instance"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
          <button
            className="p-2 rounded-lg text-text-tertiary hover:bg-white/5 hover:text-white transition-colors"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-2 rounded-lg text-text-tertiary hover:bg-danger/10 hover:text-danger transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Instance Key */}
      <div className="mt-4 rounded-xl bg-bg-tertiary/50 border border-white/5 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
            Instance Key
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKey(!showKey)}
              className="p-1.5 rounded text-text-tertiary hover:text-white transition-colors"
              title={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              onClick={copyKey}
              className="p-1.5 rounded text-text-tertiary hover:text-white transition-colors"
              title="Copy key"
            >
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <p className="mt-2 font-mono text-sm text-text-secondary">
          {showKey ? instance.instance_key : '••••••••••••••••••••••••••••••••'}
        </p>
      </div>

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-danger" />
          <div className="flex-1">
            <p className="text-sm text-danger">
              Delete this instance? This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="btn btn-secondary btn-sm">
              Cancel
            </button>
            <button
              onClick={() => {
                onDelete();
                setConfirmDelete(false);
              }}
              className="btn btn-danger btn-sm"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

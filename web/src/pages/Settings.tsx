/**
 * Settings — AI models, notifications, and secrets management
 *
 * Three sections, no tabs: scrollable single page with clear visual hierarchy.
 * "AI Models" (default + per-operation overrides as compact table)
 * "Notifications" (toggle list)
 * "Secrets" (API keys and credentials)
 */

import { useState } from 'react';
import { usePreferences } from '@/hooks/usePreferences';
import { useSecrets } from '@/lib/context/SecretsContext';
import { CreateSecretModal } from '@/components/secrets/modals/CreateSecretModal';
import { RotateSecretModal } from '@/components/secrets/modals/RotateSecretModal';
import type { UserApiKey } from '@/lib/types/secrets';
import {
  Cpu,
  Bell,
  BellOff,
  ChevronDown,
  AlertCircle,
  Zap,
  Brain,
  Sparkles,
  DollarSign,
  RotateCcw,
  Key,
  Plus,
  Copy,
  RefreshCw,
  Trash2,
  Check,
  ShieldCheck,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import clsx from 'clsx';

// ────────────────────────────────────────────────────────
// Data
// ────────────────────────────────────────────────────────

const MODELS = [
  { id: 'anthropic', name: 'Claude', vendor: 'Anthropic', badge: 'Capable', badgeColor: 'helix' },
  { id: 'deepseek', name: 'DeepSeek', vendor: 'DeepSeek', badge: 'Fast', badgeColor: 'emerald' },
  { id: 'gemini', name: 'Gemini', vendor: 'Google', badge: 'Balanced', badgeColor: 'amber' },
  { id: 'openai', name: 'GPT', vendor: 'OpenAI', badge: 'Premium', badgeColor: 'violet' },
] as const;

interface OperationDef {
  id: string;
  name: string;
  category: 'email' | 'calendar' | 'tasks' | 'analytics';
}

const OPERATIONS: OperationDef[] = [
  { id: 'email-compose', name: 'Compose', category: 'email' },
  { id: 'email-classify', name: 'Classify', category: 'email' },
  { id: 'email-respond', name: 'Suggest Responses', category: 'email' },
  { id: 'calendar-prep', name: 'Meeting Prep', category: 'calendar' },
  { id: 'calendar-time', name: 'Optimal Times', category: 'calendar' },
  { id: 'task-prioritize', name: 'Prioritize', category: 'tasks' },
  { id: 'task-breakdown', name: 'Break Down', category: 'tasks' },
  { id: 'analytics-summary', name: 'Weekly Summary', category: 'analytics' },
  { id: 'analytics-anomaly', name: 'Anomaly Detection', category: 'analytics' },
];

const CATEGORIES: { id: string; label: string; icon: typeof Cpu }[] = [
  { id: 'email', label: 'Email', icon: Zap },
  { id: 'calendar', label: 'Calendar', icon: Sparkles },
  { id: 'tasks', label: 'Tasks', icon: Brain },
  { id: 'analytics', label: 'Analytics', icon: Cpu },
];

const NOTIFICATION_OPTIONS = [
  {
    id: 'notify_on_operation_completion',
    label: 'Operation Completed',
    description: 'When an AI operation finishes successfully',
  },
  {
    id: 'notify_on_operation_failure',
    label: 'Operation Failed',
    description: 'When an operation encounters an error',
  },
  {
    id: 'notify_on_cost_limit_warning',
    label: 'Budget Warning',
    description: 'Approaching 80% of monthly budget limit',
  },
  {
    id: 'notify_on_cost_limit_exceeded',
    label: 'Budget Exceeded',
    description: 'Monthly budget limit has been surpassed',
  },
];

// ────────────────────────────────────────────────────────
// Toggle Switch
// ────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-helix-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary',
        checked ? 'bg-helix-500' : 'bg-white/10',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <span
        className={clsx(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

// ────────────────────────────────────────────────────────
// Inline Model Selector (compact dropdown)
// ────────────────────────────────────────────────────────

function ModelSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={clsx(
          'appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg',
          'pl-3 pr-8 py-1.5 text-sm text-text-primary',
          'hover:border-white/20 focus:border-helix-500/40 focus:ring-1 focus:ring-helix-500/20',
          'outline-none transition-all duration-150 cursor-pointer',
          'font-body'
        )}
      >
        <option value="" className="bg-bg-secondary text-text-secondary">
          Default
        </option>
        {MODELS.map(m => (
          <option key={m.id} value={m.id} className="bg-bg-secondary">
            {m.name}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary pointer-events-none" />
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Default Model Card
// ────────────────────────────────────────────────────────

function DefaultModelPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {MODELS.map(model => {
        const isActive = selected === model.id;
        return (
          <button
            key={model.id}
            onClick={() => onSelect(model.id)}
            className={clsx(
              'group relative flex flex-col items-start p-4 rounded-xl border transition-all duration-200',
              isActive
                ? 'border-helix-500/50 bg-helix-500/[0.08] shadow-[0_0_20px_rgba(6,134,212,0.08)]'
                : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]'
            )}
          >
            {/* Active indicator dot */}
            <div
              className={clsx(
                'absolute top-3 right-3 h-2 w-2 rounded-full transition-all duration-200',
                isActive ? 'bg-helix-400 shadow-[0_0_6px_rgba(6,134,212,0.6)]' : 'bg-white/10'
              )}
            />

            <span className="text-sm font-semibold text-white font-display">{model.name}</span>
            <span className="text-[11px] text-text-tertiary font-body mt-0.5">{model.vendor}</span>

            <span
              className={clsx(
                'mt-3 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium tracking-wide uppercase',
                model.badgeColor === 'helix' && 'bg-helix-500/15 text-helix-400',
                model.badgeColor === 'emerald' && 'bg-emerald-500/15 text-emerald-400',
                model.badgeColor === 'amber' && 'bg-amber-500/15 text-amber-400',
                model.badgeColor === 'violet' && 'bg-violet-500/15 text-violet-400'
              )}
            >
              {model.badge}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Operations Override Table
// ────────────────────────────────────────────────────────

function OperationsTable({
  operationPrefs,
  onUpdate,
}: {
  operationPrefs: any[];
  onUpdate: (opId: string, updates: any) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06]">
      <table className="w-full">
        <thead>
          <tr className="bg-white/[0.02]">
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-3">
              Operation
            </th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-3">
              Model Override
            </th>
            <th className="text-right text-[11px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-3 hidden sm:table-cell">
              Budget / mo
            </th>
            <th className="text-center text-[11px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-3 w-16">
              On
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {CATEGORIES.map(cat => {
            const ops = OPERATIONS.filter(o => o.category === cat.id);
            const Icon = cat.icon;

            return ops.map((op, idx) => {
              const pref = operationPrefs.find((p: any) => p.operation_id === op.id);
              const isEnabled = pref?.enabled !== false;

              return (
                <tr
                  key={op.id}
                  className={clsx(
                    'transition-colors',
                    isEnabled ? 'hover:bg-white/[0.02]' : 'opacity-40'
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {idx === 0 && (
                        <Icon className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                      )}
                      {idx !== 0 && <div className="w-3.5" />}
                      <div>
                        {idx === 0 && (
                          <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary block leading-none mb-1">
                            {cat.label}
                          </span>
                        )}
                        <span className="text-sm text-text-primary font-body">{op.name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ModelSelect
                      value={pref?.preferred_model || ''}
                      onChange={val =>
                        onUpdate(op.id, { preferred_model: val || undefined })
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">
                    <div className="inline-flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-text-tertiary" />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="--"
                        value={pref?.cost_budget_monthly ?? ''}
                        onChange={e =>
                          onUpdate(op.id, {
                            cost_budget_monthly: e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          })
                        }
                        className={clsx(
                          'w-16 bg-transparent border-0 border-b border-white/[0.06] text-right text-sm text-text-secondary',
                          'placeholder:text-text-tertiary/50 focus:outline-none focus:border-helix-500/40',
                          'font-mono transition-colors'
                        )}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Toggle
                      checked={isEnabled}
                      onChange={val => onUpdate(op.id, { enabled: val })}
                    />
                  </td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Notifications Section
// ────────────────────────────────────────────────────────

const DEFAULT_NOTIFICATIONS: Record<string, boolean> = {
  notify_on_operation_completion: true,
  notify_on_operation_failure: true,
  notify_on_cost_limit_warning: true,
  notify_on_cost_limit_exceeded: true,
};

function NotificationsSection({
  themePrefs,
  onUpdate,
}: {
  themePrefs: any;
  onUpdate: (updates: any) => void;
}) {
  return (
    <div className="space-y-1">
      {NOTIFICATION_OPTIONS.map((opt, idx) => {
        const isOn = themePrefs?.[opt.id] ?? DEFAULT_NOTIFICATIONS[opt.id] ?? false;
        return (
          <div
            key={opt.id}
            className={clsx(
              'flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl transition-colors',
              'hover:bg-white/[0.02]',
              idx > 0 && 'border-t border-white/[0.03]'
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={clsx(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                  isOn ? 'bg-helix-500/10 text-helix-400' : 'bg-white/[0.04] text-text-tertiary'
                )}
              >
                {isOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{opt.label}</p>
                <p className="text-xs text-text-tertiary truncate">{opt.description}</p>
              </div>
            </div>
            <Toggle checked={isOn} onChange={val => onUpdate({ [opt.id]: val })} />
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Secrets Section
// ────────────────────────────────────────────────────────

function SecretsSection() {
  const { secrets, loading, error, addSecret, updateSecret } = useSecrets();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRotateModalOpen, setIsRotateModalOpen] = useState(false);
  const [selectedSecret, setSelectedSecret] = useState<UserApiKey | null>(null);

  const handleCopy = (secret: UserApiKey) => {
    navigator.clipboard.writeText(secret.encrypted_value).catch(() => {});
    setCopiedId(secret.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateSecret = async (data: {
    name: string;
    secret_type: string;
    expires_at?: Date;
  }) => {
    try {
      const response = await fetch('/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          secret_type: data.secret_type,
          expires_at: data.expires_at?.toISOString(),
        }),
      });
      if (!response.ok) throw new Error('Failed to create secret');
      const secret = await response.json();
      addSecret(secret);
      setIsCreateModalOpen(false);
    } catch (err) {
      console.error('Error creating secret:', err);
    }
  };

  const handleRotateSecret = async (secretId: string) => {
    try {
      const response = await fetch(`/api/secrets/${secretId}/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to rotate secret');
      const updated = await response.json();
      updateSecret(secretId, updated);
      setIsRotateModalOpen(false);
      setSelectedSecret(null);
    } catch (err) {
      console.error('Error rotating secret:', err);
    }
  };

  const activeCount = secrets.filter(s => s.is_active).length;
  const expiringCount = secrets.filter(s => {
    if (!s.expires_at) return false;
    const days = (new Date(s.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 7 && days > 0;
  }).length;

  return (
    <>
      <SectionHeader
        icon={Key}
        title="Secrets"
        description="Manage API keys and credentials"
        action={
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-helix-400 hover:text-helix-300 transition-colors mt-1"
          >
            <Plus className="h-3 w-3" />
            Add Secret
          </button>
        }
      />

      {/* Stats row */}
      {secrets.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Total</p>
            <p className="text-xl font-display font-semibold text-white mt-0.5">{secrets.length}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Active</p>
            <p className="text-xl font-display font-semibold text-emerald-400 mt-0.5">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Expiring</p>
            <p className={clsx(
              'text-xl font-display font-semibold mt-0.5',
              expiringCount > 0 ? 'text-amber-400' : 'text-text-tertiary'
            )}>{expiringCount}</p>
          </div>
        </div>
      )}

      {/* Secrets list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-text-tertiary">
          <div className="h-5 w-5 rounded-full border-2 border-white/10 border-t-helix-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400 font-body">{error}</p>
        </div>
      ) : secrets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] py-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] mb-3">
            <Key className="h-5 w-5 text-text-tertiary" />
          </div>
          <p className="text-sm font-medium text-text-secondary">No secrets yet</p>
          <p className="text-xs text-text-tertiary mt-1">Add your first API key or credential</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <table className="w-full">
            <thead>
              <tr className="bg-white/[0.02]">
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-3">
                  Name
                </th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-3 hidden sm:table-cell">
                  Type
                </th>
                <th className="text-center text-[11px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-3">
                  Status
                </th>
                <th className="text-right text-[11px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {secrets.map(secret => {
                const isExpired = secret.expires_at && new Date(secret.expires_at) < new Date();
                const isExpiringSoon = secret.expires_at && !isExpired &&
                  new Date(secret.expires_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

                return (
                  <tr key={secret.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-text-primary">{secret.key_name}</p>
                      <p className="text-[11px] text-text-tertiary">v{secret.key_version}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-text-secondary font-mono">
                        {secret.secret_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isExpired ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
                          <ShieldAlert className="h-3 w-3" /> Expired
                        </span>
                      ) : isExpiringSoon ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                          <Clock className="h-3 w-3" /> Expiring
                        </span>
                      ) : secret.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                          <ShieldCheck className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-text-tertiary">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleCopy(secret)}
                          className="p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-white/[0.04] transition-colors"
                          title="Copy"
                        >
                          {copiedId === secret.id
                            ? <Check className="h-3.5 w-3.5 text-emerald-400" />
                            : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedSecret(secret);
                            setIsRotateModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-text-tertiary hover:text-amber-400 hover:bg-amber-500/[0.06] transition-colors"
                          title="Rotate"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => console.log('Delete:', secret.id)}
                          className="p-1.5 rounded-lg text-text-tertiary hover:text-red-400 hover:bg-red-500/[0.06] transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <CreateSecretModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateSecret}
      />
      {selectedSecret && (
        <RotateSecretModal
          isOpen={isRotateModalOpen}
          secret={selectedSecret}
          onClose={() => {
            setIsRotateModalOpen(false);
            setSelectedSecret(null);
          }}
          onConfirm={handleRotateSecret}
        />
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────
// Section Header
// ────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Cpu;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-helix-500/10 border border-helix-500/20 mt-0.5">
          <Icon className="h-4.5 w-4.5 text-helix-400" />
        </div>
        <div>
          <h2 className="text-lg font-display font-semibold text-white">{title}</h2>
          <p className="text-sm text-text-tertiary font-body mt-0.5">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Main Settings Page
// ────────────────────────────────────────────────────────

export function Settings() {
  const {
    operationPrefs,
    themePrefs,
    loading,
    error,
    updateOperationPreference,
    updateThemePreference,
    resetToDefaults,
  } = usePreferences();

  const [defaultModel, setDefaultModel] = useState('deepseek');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Page header */}
      <div className="mb-10">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">Settings</h1>
        <p className="text-text-tertiary font-body mt-1.5">
          Configure AI models and notification preferences
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400 font-body">{error}</p>
        </div>
      )}

      {/* ── AI Models Section ── */}
      <section className="mb-12">
        <SectionHeader
          icon={Cpu}
          title="AI Models"
          description="Choose the default model and override per operation"
          action={
            <button
              onClick={resetToDefaults}
              className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors mt-1"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          }
        />

        {/* Default model picker */}
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-3 px-0.5">
            Default Model
          </p>
          <DefaultModelPicker selected={defaultModel} onSelect={setDefaultModel} />
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent my-6" />

        {/* Per-operation overrides */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-3 px-0.5">
            Per-Operation Overrides
          </p>
          <OperationsTable
            operationPrefs={operationPrefs}
            onUpdate={updateOperationPreference}
          />
          <p className="text-[11px] text-text-tertiary/60 mt-2 px-1 font-body">
            Operations without an override use the default model above
          </p>
        </div>
      </section>

      {/* ── Notifications Section ── */}
      <section className="mb-12">
        <SectionHeader
          icon={Bell}
          title="Notifications"
          description="Control what events trigger alerts"
        />
        <div className="card-glass p-1">
          <NotificationsSection
            themePrefs={themePrefs}
            onUpdate={updateThemePreference}
          />
        </div>
      </section>

      {/* ── Secrets Section ── */}
      <section className="mb-12">
        <SecretsSection />
      </section>
    </div>
  );
}

export default Settings;

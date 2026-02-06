import { Link } from 'react-router-dom';
import {
  Activity,
  Loader2,
  Zap,
  TrendingUp,
  MessageSquare,
  Code2,
  Eye,
  Settings,
  Wifi,
  WifiOff,
  Download,
  ArrowRight,
  Clock,
  Monitor,
  Smartphone,
  Terminal,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import clsx from 'clsx';

export function Dashboard() {
  const { user } = useAuth();
  const { subscription, isLoading } = useSubscription();

  if (isLoading) {
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
              Welcome back, {user?.email?.split('@')[0] || 'operator'}
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Plan"
            value={subscription?.tier || 'Free'}
            icon={<TrendingUp className="h-5 w-5" />}
            color="accent"
            isText
          />
          <StatCard
            label="Status"
            value="Ready"
            icon={<Activity className="h-5 w-5" />}
            color="success"
            isText
          />
          <StatCard
            label="Connected"
            value="Web"
            icon={<Zap className="h-5 w-5" />}
            color="helix"
            isText
          />
        </div>

        {/* Connection Status */}
        <div className="mt-10">
          <h2 className="text-lg font-display font-semibold text-white mb-4">Runtime Status</h2>
          <div className="card-glass p-6">
            <div className="flex items-start gap-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-helix-500/10 border border-helix-500/20">
                <Wifi className="h-6 w-6 text-helix-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-display font-medium text-white">Local Runtime</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  Connect your local Helix runtime to use the Code Interface and advanced features.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <PlatformBadge icon={<Monitor className="h-3.5 w-3.5" />} label="Web" active />
                  <PlatformBadge icon={<Terminal className="h-3.5 w-3.5" />} label="CLI" />
                  <PlatformBadge icon={<Smartphone className="h-3.5 w-3.5" />} label="Mobile" />
                </div>
              </div>
              <Link to="/setup" className="btn btn-secondary btn-sm gap-2 shrink-0">
                <Download className="h-4 w-4" />
                Setup
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-10">
          <h2 className="text-lg font-display font-semibold text-white mb-4">Quick Actions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <QuickAction
              to="/chat"
              icon={<MessageSquare className="h-6 w-6" />}
              title="Chat"
              description="Talk with Helix"
              color="helix"
            />
            <QuickAction
              to="/code"
              icon={<Code2 className="h-6 w-6" />}
              title="Code"
              description="AI-powered code interface"
              color="success"
            />
            <QuickAction
              to="/observatory"
              icon={<Eye className="h-6 w-6" />}
              title="Observatory"
              description="Watch Helix think"
              color="accent"
            />
            <QuickAction
              to="/settings"
              icon={<Settings className="h-6 w-6" />}
              title="Settings"
              description="Configure AI & notifications"
              color="neutral"
            />
          </div>
        </div>

        {/* Getting Started */}
        <div className="mt-10">
          <h2 className="text-lg font-display font-semibold text-white mb-4">Getting Started</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <SetupStep
              step={1}
              title="Install Helix CLI"
              description="Download and install the CLI on your machine"
              icon={<Download className="h-4 w-4" />}
              done={false}
            />
            <SetupStep
              step={2}
              title="Sign in from CLI"
              description="Run 'helix login' to authenticate"
              icon={<Terminal className="h-4 w-4" />}
              done={false}
            />
            <SetupStep
              step={3}
              title="Start using Helix"
              description="Chat, code, and explore with your AI"
              icon={<Zap className="h-4 w-4" />}
              done={false}
            />
          </div>
        </div>
      </div>
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
  done: boolean;
}

function SetupStep({ step, title, description, icon, done }: SetupStepProps) {
  return (
    <div className={clsx(
      'rounded-xl border p-4',
      done
        ? 'bg-success/5 border-success/20'
        : 'bg-bg-tertiary/30 border-white/5'
    )}>
      <div className="flex items-center gap-2.5">
        <div className={clsx(
          'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
          done
            ? 'bg-success/20 text-success'
            : 'bg-helix-500/20 text-helix-400'
        )}>
          {step}
        </div>
        <div className={done ? 'text-success' : 'text-helix-400'}>{icon}</div>
        <h4 className="text-sm font-medium text-white">{title}</h4>
      </div>
      <p className="mt-2 text-xs text-text-tertiary leading-relaxed">{description}</p>
    </div>
  );
}

interface PlatformBadgeProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

function PlatformBadge({ icon, label, active }: PlatformBadgeProps) {
  return (
    <div className={clsx(
      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border',
      active
        ? 'bg-success/10 border-success/20 text-success'
        : 'bg-bg-tertiary/30 border-white/5 text-text-tertiary'
    )}>
      {icon}
      {label}
      {active && <div className="h-1.5 w-1.5 rounded-full bg-success" />}
    </div>
  );
}

interface QuickActionProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'helix' | 'success' | 'accent' | 'neutral';
}

const actionColorMap = {
  helix: 'bg-helix-500/10 border-helix-500/20 text-helix-400 group-hover:border-helix-500/40',
  success: 'bg-success/10 border-success/20 text-success group-hover:border-success/40',
  accent: 'bg-accent-500/10 border-accent-500/20 text-accent-400 group-hover:border-accent-500/40',
  neutral: 'bg-white/5 border-white/10 text-text-secondary group-hover:border-white/20',
};

function QuickAction({ to, icon, title, description, color }: QuickActionProps) {
  return (
    <Link
      to={to}
      className="group card-glass p-5 hover:border-white/20 transition-all duration-200"
    >
      <div className={clsx('inline-flex rounded-xl p-3 border transition-colors', actionColorMap[color])}>
        {icon}
      </div>
      <h3 className="mt-4 text-sm font-display font-semibold text-white group-hover:text-helix-400 transition-colors">
        {title}
      </h3>
      <p className="mt-1 text-xs text-text-tertiary">{description}</p>
      <ArrowRight className="mt-3 h-4 w-4 text-text-tertiary group-hover:text-helix-400 group-hover:translate-x-1 transition-all" />
    </Link>
  );
}

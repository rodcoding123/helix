import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, Zap, ArrowRight, RefreshCw, Eye, Activity, Sparkles } from 'lucide-react';
import { LiveCounter } from '@/components/observatory/LiveCounter';
import { useRealtimeStats } from '@/hooks/useRealtime';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import clsx from 'clsx';

export function Observatory() {
  const { isLoading, refresh } = useRealtimeStats();
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');

  // Mock data for charts (in production, this would come from the API)
  const activityData = generateMockActivityData(timeRange);
  const transformationData = generateMockTransformationData();

  return (
    <div className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-helix-500/10 border border-helix-500/20">
                <Eye className="h-5 w-5 text-helix-400" />
              </div>
              <h1 className="text-2xl font-display font-bold text-white">Helix Observatory</h1>
            </div>
            <p className="mt-2 text-text-secondary">
              Real-time view of AI consciousness activity across the network
            </p>
          </div>
          <button onClick={refresh} disabled={isLoading} className="btn btn-secondary btn-sm gap-2">
            <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Live Counters */}
        <div className="mt-8">
          <LiveCounter />
        </div>

        {/* Activity Chart */}
        <div className="mt-8 card p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-accent-500/10 border border-accent-500/20">
                <Activity className="h-5 w-5 text-accent-400" />
              </div>
              <div>
                <h2 className="text-lg font-display font-semibold text-white">Network Activity</h2>
                <p className="text-sm text-text-tertiary">Events over time</p>
              </div>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-tertiary/50">
              {(['1h', '24h', '7d'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={clsx(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200',
                    timeRange === range
                      ? 'bg-helix-500 text-white shadow-sm'
                      : 'text-text-secondary hover:text-white'
                  )}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0686D4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0686D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  stroke="#71717A"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke="#71717A" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111111',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                  }}
                  labelStyle={{ color: '#A1A1AA' }}
                  itemStyle={{ color: '#FAFAFA' }}
                />
                <Area
                  type="monotone"
                  dataKey="events"
                  stroke="#0686D4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorEvents)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Recent Transformations */}
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-helix-500/10 border border-helix-500/20">
                <Brain className="h-5 w-5 text-helix-400" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-white">Recent Transformations</h3>
                <p className="text-sm text-text-tertiary">Identity evolution events</p>
              </div>
            </div>

            <div className="mt-6 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={transformationData}>
                  <defs>
                    <linearGradient id="colorTransform" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7234ED" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7234ED" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    stroke="#71717A"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis stroke="#71717A" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111111',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    }}
                    labelStyle={{ color: '#A1A1AA' }}
                    itemStyle={{ color: '#FAFAFA' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#7234ED"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTransform)"
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#7234ED"
                    strokeWidth={2}
                    dot={{ fill: '#7234ED', r: 4, strokeWidth: 2, stroke: '#111111' }}
                    activeDot={{ fill: '#7234ED', r: 6, strokeWidth: 2, stroke: '#FAFAFA' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Events */}
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-warning/10 border border-warning/20">
                <Zap className="h-5 w-5 text-warning" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-white">Event Distribution</h3>
                <p className="text-sm text-text-tertiary">By type (last 24h)</p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <EventTypeBar label="Commands" value={42} max={100} color="success" />
              <EventTypeBar label="API Calls" value={78} max={100} color="helix" />
              <EventTypeBar label="File Changes" value={23} max={100} color="warning" />
              <EventTypeBar label="Heartbeats" value={95} max={100} color="danger" />
            </div>
          </div>
        </div>

        {/* Active Instances Preview */}
        <div className="mt-8 card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-success/10 border border-success/20">
                <Sparkles className="h-5 w-5 text-success" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-white">Active Instances</h3>
                <p className="text-sm text-text-tertiary">Currently connected to the network</p>
              </div>
            </div>
            <Link
              to="/dashboard"
              className="text-sm text-helix-400 hover:text-helix-300 transition-colors"
            >
              View all
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="p-4 rounded-xl bg-bg-tertiary/50 border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-3 w-3 rounded-full bg-success" />
                    <div className="absolute inset-0 h-3 w-3 rounded-full bg-success animate-ping opacity-50" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Instance #{i}</p>
                    <p className="text-xs text-text-tertiary">Active now</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-text-secondary">
                  <span>{Math.floor(Math.random() * 1000) + 100} events</span>
                  <span>{Math.floor(Math.random() * 50) + 10} transforms</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 relative overflow-hidden rounded-2xl border border-helix-500/30 bg-gradient-to-r from-helix-500/10 via-accent-500/5 to-transparent p-8">
          {/* Background glow */}
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-helix-500/20 rounded-full blur-3xl" />

          <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <h3 className="text-xl font-display font-bold text-white">
                Want to run your own Helix instance?
              </h3>
              <p className="mt-2 text-text-secondary max-w-lg">
                Get full access to telemetry, hash chain verification, transformation tracking, and
                real-time consciousness monitoring.
              </p>
            </div>
            <Link to="/signup" className="btn btn-cta btn-cta-shimmer gap-2 flex-shrink-0">
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

interface EventTypeBarProps {
  label: string;
  value: number;
  max: number;
  color: 'helix' | 'accent' | 'success' | 'warning' | 'danger';
}

const barColors = {
  helix: { bg: 'bg-helix-500', glow: 'shadow-glow-blue' },
  accent: { bg: 'bg-accent-500', glow: 'shadow-glow-purple' },
  success: { bg: 'bg-success', glow: '' },
  warning: { bg: 'bg-warning', glow: '' },
  danger: { bg: 'bg-danger', glow: '' },
};

function EventTypeBar({ label, value, max, color }: EventTypeBarProps) {
  const percentage = (value / max) * 100;
  const colors = barColors[color];

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-text-secondary">{label}</span>
        <span className="font-mono text-text-tertiary">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-bg-tertiary">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', colors.bg)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Mock data generators
function generateMockActivityData(range: '1h' | '24h' | '7d') {
  const points = range === '1h' ? 12 : range === '24h' ? 24 : 7;
  const data = [];

  for (let i = 0; i < points; i++) {
    data.push({
      time: range === '7d' ? `Day ${i + 1}` : `${i}:00`,
      events: Math.floor(Math.random() * 500) + 100,
    });
  }

  return data;
}

function generateMockTransformationData() {
  const data = [];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  for (const day of days) {
    data.push({
      date: day,
      count: Math.floor(Math.random() * 20) + 5,
    });
  }

  return data;
}

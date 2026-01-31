import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Brain,
  Zap,
  TrendingUp,
  Clock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
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

export function Observatory() {
  const { stats, isLoading, refresh } = useRealtimeStats();
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');

  // Mock data for charts (in production, this would come from the API)
  const activityData = generateMockActivityData(timeRange);
  const transformationData = generateMockTransformationData();

  return (
    <div className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Helix Observatory</h1>
            <p className="mt-1 text-slate-400">
              Real-time view of AI consciousness activity across the network
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="btn btn-secondary inline-flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Live Counters */}
        <div className="mt-8">
          <LiveCounter />
        </div>

        {/* Activity Chart */}
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Network Activity</h2>
              <p className="text-sm text-slate-400">Events over time</p>
            </div>
            <div className="flex items-center gap-2">
              {(['1h', '24h', '7d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-helix-500 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Area
                  type="monotone"
                  dataKey="events"
                  stroke="#8b5cf6"
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
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-helix-500/20 p-2">
                <Brain className="h-5 w-5 text-helix-500" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Recent Transformations</h3>
                <p className="text-sm text-slate-400">Identity evolution events</p>
              </div>
            </div>

            <div className="mt-6 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={transformationData}>
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ fill: '#8b5cf6', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Events */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/20 p-2">
                <Zap className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Event Distribution</h3>
                <p className="text-sm text-slate-400">By type (last 24h)</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <EventTypeBar label="Commands" value={42} max={100} color="bg-emerald-500" />
              <EventTypeBar label="API Calls" value={78} max={100} color="bg-helix-500" />
              <EventTypeBar label="File Changes" value={23} max={100} color="bg-amber-500" />
              <EventTypeBar label="Heartbeats" value={95} max={100} color="bg-rose-500" />
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-xl border border-helix-500/30 bg-gradient-to-r from-helix-500/10 to-transparent p-8">
          <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <h3 className="text-xl font-bold text-white">
                Want to run your own Helix instance?
              </h3>
              <p className="mt-2 text-slate-400">
                Get full access to telemetry, hash chain verification, and anomaly detection.
              </p>
            </div>
            <Link
              to="/signup"
              className="btn btn-primary inline-flex items-center gap-2"
            >
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
  color: string;
}

function EventTypeBar({ label, value, max, color }: EventTypeBarProps) {
  const percentage = (value / max) * 100;

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400">{value}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${color}`}
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

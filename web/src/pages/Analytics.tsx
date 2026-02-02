import { FC, useEffect, useState } from 'react';
import { BarChart3, TrendingUp, MessageSquare, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { TimeRange } from '@/lib/types/analytics';
import { StatCard } from '@/components/analytics/StatCard';
import { ConversationTrendChart } from '@/components/analytics/ConversationTrendChart';
import { EmotionDistributionChart } from '@/components/analytics/EmotionDistributionChart';
import { TopicsChart } from '@/components/analytics/TopicsChart';
import { ActionStatusCard } from '@/components/analytics/ActionStatusCard';

/**
 * Analytics Dashboard: Comprehensive metrics and insights
 * Displays agent, conversation, and autonomy analytics
 */
export const AnalyticsPage: FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { analyticsData, isLoading, fetchAnalytics } = useAnalytics();

  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('7d');

  // Load analytics on mount
  useEffect(() => {
    if (user?.id) {
      fetchAnalytics(user.id, selectedTimeRange);
    }
  }, [user?.id, selectedTimeRange, fetchAnalytics]);

  const handleTimeRangeChange = (range: TimeRange) => {
    setSelectedTimeRange(range);
  };

  if (authLoading) {
    return (
      <div className="p-8">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8">
        <p className="text-slate-400">Please sign in to view analytics</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-slate-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="min-h-screen bg-slate-950 p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-slate-400">No analytics data available</p>
        </div>
      </div>
    );
  }

  const { agent_metrics, conversation_metrics, autonomy_metrics } = analyticsData;

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 mb-2">Analytics</h1>
            <p className="text-slate-400">Comprehensive metrics and insights</p>
          </div>

          {/* Time Range Selector */}
          <div className="flex gap-2">
            {(['7d', '30d', 'all-time'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => handleTimeRangeChange(range)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedTimeRange === range
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {range === '7d' ? 'Last 7 days' : range === '30d' ? 'Last 30 days' : 'All time'}
              </button>
            ))}
          </div>
        </div>

        {/* Agent Metrics */}
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-bold text-slate-100 flex items-center gap-2">
            <Zap size={24} className="text-purple-500" />
            Agents
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Agents"
              value={agent_metrics.total_agents}
              icon={BarChart3}
            />
            <StatCard
              label="Active Agents"
              value={agent_metrics.active_agents}
              icon={TrendingUp}
            />
            <StatCard
              label="Total Conversations"
              value={conversation_metrics.total_conversations}
              icon={MessageSquare}
            />
            <StatCard
              label="Avg Conversations/Agent"
              value={agent_metrics.avg_conversations_per_agent.toFixed(1)}
            />
          </div>
        </section>

        {/* Conversation Metrics */}
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-bold text-slate-100 flex items-center gap-2">
            <MessageSquare size={24} className="text-blue-500" />
            Conversations
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ConversationTrendChart
              data={conversation_metrics.conversation_trend}
              height={300}
            />
            <EmotionDistributionChart
              data={conversation_metrics.primary_emotion_distribution}
              height={300}
            />
          </div>

          {/* Topics */}
          <div className="mt-6">
            <TopicsChart data={conversation_metrics.topic_distribution} height={300} />
          </div>
        </section>

        {/* Autonomy Metrics */}
        <section>
          <h2 className="mb-4 text-xl font-bold text-slate-100 flex items-center gap-2">
            <Zap size={24} className="text-green-500" />
            Autonomy Actions
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ActionStatusCard metrics={autonomy_metrics} />

            {/* Autonomy Levels Breakdown */}
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
              <h3 className="mb-4 font-semibold text-slate-100">Autonomy Level Distribution</h3>
              <div className="space-y-3">
                {Object.entries(agent_metrics.agents_by_autonomy || {}).map(
                  ([level, count]) => {
                    const levelLabels = [
                      'Propose-Only',
                      'Inform-After',
                      'Alert-Async',
                      'Autonomous',
                    ];
                    const levelColors = [
                      'bg-yellow-500',
                      'bg-orange-500',
                      'bg-blue-500',
                      'bg-purple-500',
                    ];

                    return (
                      <div key={level}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-400">
                            {levelLabels[parseInt(level)] || `Level ${level}`}
                          </span>
                          <span className="font-medium text-slate-100">{count}</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${levelColors[parseInt(level)] || 'bg-slate-600'}`}
                            style={{
                              width: `${
                                agent_metrics.total_agents > 0
                                  ? ((count as number) / agent_metrics.total_agents) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

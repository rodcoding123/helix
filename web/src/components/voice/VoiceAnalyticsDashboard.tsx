/**
 * Voice Analytics Dashboard Component
 * Phase 4.2: Comprehensive voice usage and sentiment analytics
 *
 * Displays:
 * - Voice metrics (memos, time, averages)
 * - Command usage statistics
 * - Transcription quality metrics
 * - Sentiment trends
 * - Voice model performance
 */

import React, { FC, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { voiceAnalyticsService, VoiceAnalyticsData } from '@/services/voice-analytics';
import {
  BarChart,
  LineChart,
  PieChart,
  TrendingUp,
  Download,
  Calendar,
  Mic,
  MessageSquareVoice,
  Settings,
} from 'lucide-react';

interface VoiceAnalyticsDashboardProps {
  timeRange?: 'week' | 'month' | 'quarter' | 'year';
}

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

const MetricCard: FC<{ title: string; value: string | number; icon: React.ReactNode; trend?: number }> = ({
  title,
  value,
  icon,
  trend,
}) => (
  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-medium text-slate-400">{title}</h3>
      <div className="text-slate-500">{icon}</div>
    </div>
    <div className="text-2xl font-bold text-slate-100">{value}</div>
    {trend !== undefined && (
      <div className={`text-xs mt-2 ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last period
      </div>
    )}
  </div>
);

export const VoiceAnalyticsDashboard: FC<VoiceAnalyticsDashboardProps> = ({
  timeRange = 'month',
}) => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<VoiceAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const daysMap = {
    week: 7,
    month: 30,
    quarter: 90,
    year: 365,
  };

  useEffect(() => {
    const loadAnalytics = async () => {
      if (!user?.id) return;

      try {
        setIsLoading(true);
        const data = await voiceAnalyticsService.getVoiceAnalytics(
          user.id,
          daysMap[timeRange]
        );
        setAnalytics(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, [user?.id, timeRange]);

  const handleExport = async () => {
    if (!user?.id) return;
    try {
      const csv = await voiceAnalyticsService.exportAnalyticsAsCSV(user.id);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voice-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin text-2xl mb-2">⟳</div>
        <p className="text-slate-400">Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
        <p className="text-red-400">Error: {error}</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No voice data available</p>
      </div>
    );
  }

  const confidencePercent = (analytics.transcription.averageConfidence * 100).toFixed(0);
  const sentimentPercent = (analytics.sentiment.averageSentiment * 100).toFixed(0);

  return (
    <div className="voice-analytics-dashboard space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-100">Voice Analytics</h2>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Time Range Selector */}
      <div className="flex gap-2">
        {(['week', 'month', 'quarter', 'year'] as const).map((range) => (
          <button
            key={range}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              timeRange === range
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-300'
            }`}
          >
            {range.charAt(0).toUpperCase() + range.slice(1)}
          </button>
        ))}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Memos"
          value={analytics.voice.totalMemosRecorded}
          icon={<Mic className="w-5 h-5" />}
        />
        <MetricCard
          title="Recording Time"
          value={formatDuration(analytics.voice.totalRecordingTimeMs)}
          icon={<MessageSquareVoice className="w-5 h-5" />}
        />
        <MetricCard
          title="Avg Memo Length"
          value={formatDuration(analytics.voice.averageMemoLengthMs)}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          title="Commands Today"
          value={analytics.commands.commandsToday}
          icon={<Settings className="w-5 h-5" />}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Transcription Quality"
          value={`${confidencePercent}%`}
          icon={<BarChart className="w-5 h-5" />}
        />
        <MetricCard
          title="Average Sentiment"
          value={`${sentimentPercent}%`}
          icon={<LineChart className="w-5 h-5" />}
        />
        <MetricCard
          title="Dominant Emotion"
          value={analytics.sentiment.dominantEmotion}
          icon={<span className="text-xl">😊</span>}
        />
      </div>

      {/* Transcription Quality Breakdown */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Transcription Quality Distribution</h3>
        <div className="space-y-3">
          {[
            { label: 'Excellent (0.9-1.0)', count: analytics.transcription.confidenceDistribution.excellent, color: 'bg-green-500' },
            { label: 'Good (0.8-0.89)', count: analytics.transcription.confidenceDistribution.good, color: 'bg-blue-500' },
            { label: 'Fair (0.7-0.79)', count: analytics.transcription.confidenceDistribution.fair, color: 'bg-yellow-500' },
            { label: 'Poor (<0.7)', count: analytics.transcription.confidenceDistribution.poor, color: 'bg-red-500' },
          ].map(({ label, count, color }) => {
            const total = analytics.transcription.totalTranscribed || 1;
            const percentage = (count / total) * 100;
            return (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-slate-300 font-medium">
                    {count} ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${color} transition-all`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Commands */}
      {analytics.commands.mostUsedCommands.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Top Voice Commands</h3>
          <div className="space-y-2">
            {analytics.commands.mostUsedCommands.slice(0, 5).map((cmd, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 hover:bg-slate-700/30 rounded">
                <div>
                  <p className="text-slate-100 font-medium">"{cmd.phrase}"</p>
                  <p className="text-xs text-slate-500">
                    Used {cmd.usageCount} times • {(cmd.successRate * 100).toFixed(0)}% success
                  </p>
                </div>
                <div className="text-2xl font-bold text-blue-400">{cmd.usageCount}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Model Performance */}
      {Object.keys(analytics.models).length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Voice Model Performance</h3>
          <div className="space-y-3">
            {Object.entries(analytics.models)
              .sort(([, a], [, b]) => b.usageCount - a.usageCount)
              .map(([model, stats]) => (
                <div key={model}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400 capitalize">{model}</span>
                    <span className="text-slate-300 font-medium">
                      {stats.percentageUsed.toFixed(1)}% ({stats.usageCount} uses)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${stats.percentageUsed}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 w-20">
                      {(stats.averageConfidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Usage Pattern - Daily */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Weekly Usage Pattern</h3>
        <div className="flex items-end gap-2 h-32">
          {analytics.voice.memoCountByWeek.map((count, idx) => {
            const max = Math.max(...analytics.voice.memoCountByWeek, 1);
            const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const heightPercent = (count / max) * 100;

            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all hover:opacity-80"
                    style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                  />
                </div>
                <span className="text-xs text-slate-500">{dayNames[idx]}</span>
                <span className="text-xs text-slate-400">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-xs text-slate-500 text-center">
        Last updated: {new Date(analytics.lastUpdated).toLocaleString()}
      </div>
    </div>
  );
};

export default VoiceAnalyticsDashboard;

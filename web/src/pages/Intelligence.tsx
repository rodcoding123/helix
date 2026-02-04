/**
 * Phase 8: Intelligence Dashboard
 * Main page for accessing all AI intelligence features
 * Integrates with Phase 0.5 AI Operations Control Plane
 */

import { useState, useEffect } from 'react';
import { AlertCircle, Mail, Calendar, CheckSquare, BarChart3, Zap, ChevronRight } from 'lucide-react';
import { aiRouter } from '../services/intelligence/router-client';
import type { BudgetStatus } from '../services/intelligence/router-client';

interface IntelligenceFeature {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  estimatedCost: number;
  color: string;
}

const INTELLIGENCE_FEATURES: IntelligenceFeature[] = [
  {
    id: 'email-compose',
    name: 'Email Composition',
    description: 'AI-powered email drafting assistance',
    icon: <Mail className="w-6 h-6" />,
    enabled: true,
    estimatedCost: 0.0015,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'email-classify',
    name: 'Email Classification',
    description: 'Auto-categorize emails and extract metadata',
    icon: <Mail className="w-6 h-6" />,
    enabled: true,
    estimatedCost: 0.0006,
    color: 'from-blue-600 to-blue-400',
  },
  {
    id: 'email-respond',
    name: 'Response Suggestions',
    description: 'Generate smart email reply suggestions',
    icon: <Mail className="w-6 h-6" />,
    enabled: true,
    estimatedCost: 0.0012,
    color: 'from-indigo-500 to-purple-500',
  },
  {
    id: 'calendar-prep',
    name: 'Meeting Preparation',
    description: 'Auto-generate meeting prep 30 min before events',
    icon: <Calendar className="w-6 h-6" />,
    enabled: true,
    estimatedCost: 0.0025,
    color: 'from-green-500 to-emerald-500',
  },
  {
    id: 'calendar-time',
    name: 'Optimal Meeting Times',
    description: 'Find best meeting times across calendars',
    icon: <Calendar className="w-6 h-6" />,
    enabled: true,
    estimatedCost: 0.008,
    color: 'from-teal-500 to-cyan-500',
  },
  {
    id: 'task-prioritize',
    name: 'Task Prioritization',
    description: 'AI-powered task reordering by impact',
    icon: <CheckSquare className="w-6 h-6" />,
    enabled: true,
    estimatedCost: 0.0018,
    color: 'from-yellow-500 to-orange-500',
  },
  {
    id: 'task-breakdown',
    name: 'Task Breakdown',
    description: 'Generate subtasks and action plans',
    icon: <CheckSquare className="w-6 h-6" />,
    enabled: true,
    estimatedCost: 0.0012,
    color: 'from-orange-500 to-red-500',
  },
  {
    id: 'analytics-summary',
    name: 'Weekly Summary',
    description: 'AI-generated weekly productivity reports',
    icon: <BarChart3 className="w-6 h-6" />,
    enabled: true,
    estimatedCost: 0.03,
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'analytics-anomaly',
    name: 'Pattern Anomalies',
    description: 'Detect unusual work patterns and behaviors',
    icon: <BarChart3 className="w-6 h-6" />,
    enabled: true,
    estimatedCost: 0.0009,
    color: 'from-pink-500 to-rose-500',
  },
];

export default function IntelligencePage() {
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Get user ID from auth context (replace with actual auth)
  const userId = 'user-123'; // TODO: Get from auth context

  useEffect(() => {
    const loadBudgetStatus = async () => {
      try {
        const budget = await aiRouter.getBudgetStatus(userId);
        setBudgetStatus(budget);
      } catch (error) {
        console.error('Failed to load budget status:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBudgetStatus();
  }, [userId]);

  const handleToggleFeature = async (featureId: string) => {
    // TODO: Implement feature toggle
    console.log(`Toggle feature: ${featureId}`);
  };

  const handleOpenFeature = (featureId: string) => {
    setSelectedFeature(featureId);
    // TODO: Open feature detail modal or navigate to feature page
  };

  const totalDailyCost = INTELLIGENCE_FEATURES.reduce(
    (sum, f) => sum + (f.estimatedCost * (f.id.includes('email') ? 10 : f.id.includes('calendar') ? 5 : f.id.includes('task') ? 2 : 1)),
    0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Header */}
      <div className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                Intelligence Dashboard
              </h1>
              <p className="text-slate-400 mt-2">Phase 8: LLM-First Intelligence Layer</p>
            </div>
            <Zap className="w-8 h-8 text-amber-400" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Budget Status */}
        {budgetStatus && (
          <div className="mb-8 p-6 bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl border border-slate-600/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Daily AI Budget</h2>
              <span className="text-sm text-slate-400">Phase 0.5 Integration</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-900/50 rounded-lg">
                <p className="text-sm text-slate-400">Daily Limit</p>
                <p className="text-2xl font-bold text-cyan-400">${budgetStatus.dailyLimit.toFixed(2)}</p>
              </div>

              <div className="p-4 bg-slate-900/50 rounded-lg">
                <p className="text-sm text-slate-400">Current Spend</p>
                <p className="text-2xl font-bold text-blue-400">${budgetStatus.currentSpend.toFixed(2)}</p>
              </div>

              <div className="p-4 bg-slate-900/50 rounded-lg">
                <p className="text-sm text-slate-400">Remaining</p>
                <p className="text-2xl font-bold text-green-400">${budgetStatus.remaining.toFixed(2)}</p>
              </div>

              <div className="p-4 bg-slate-900/50 rounded-lg">
                <p className="text-sm text-slate-400">Usage</p>
                <p className="text-2xl font-bold text-yellow-400">{budgetStatus.percentUsed.toFixed(0)}%</p>
              </div>
            </div>

            {/* Budget Bar */}
            <div className="mt-4">
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-500 to-yellow-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(budgetStatus.percentUsed, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">Operations today: {budgetStatus.operationsToday}</p>
            </div>
          </div>
        )}

        {/* Features Grid */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Available Intelligence Features</h2>
            <span className="text-sm text-slate-400">9 operations • ~$0.08/day</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {INTELLIGENCE_FEATURES.map((feature) => (
              <div
                key={feature.id}
                className="group relative p-6 bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl border border-slate-600/50 hover:border-slate-500/50 transition-all cursor-pointer"
                onClick={() => handleOpenFeature(feature.id)}
              >
                {/* Background Gradient Effect */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 rounded-xl transition-opacity`} />

                <div className="relative">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} p-3 text-white mb-4`}>
                    {feature.icon}
                  </div>

                  {/* Title and Description */}
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.name}</h3>
                  <p className="text-sm text-slate-300 mb-4">{feature.description}</p>

                  {/* Cost and Status */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">Cost per call</p>
                      <p className="text-sm font-mono text-cyan-400">${feature.estimatedCost.toFixed(4)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {feature.enabled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                          <span className="w-2 h-2 bg-green-400 rounded-full" />
                          Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-500/20 text-slate-400 text-xs rounded">
                          <span className="w-2 h-2 bg-slate-400 rounded-full" />
                          Disabled
                        </span>
                      )}

                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-colors" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info Section */}
        <div className="p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <div className="flex gap-4">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-white mb-2">Phase 8 Integration</h3>
              <p className="text-sm text-slate-300">
                All intelligence operations are integrated with Phase 0.5's unified AI Operations Control Plane. Cost tracking, approval
                gates, and budget management are automatically handled. Real-time sync across web, iOS, and Android.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Detail Modal */}
      {selectedFeature && (
        <FeatureDetailModal feature={INTELLIGENCE_FEATURES.find((f) => f.id === selectedFeature)!} onClose={() => setSelectedFeature(null)} />
      )}
    </div>
  );
}

interface FeatureDetailModalProps {
  feature: IntelligenceFeature;
  onClose: () => void;
}

function FeatureDetailModal({ feature, onClose }: FeatureDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-2xl w-full mx-4 p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-4 mb-6">
          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} p-3 text-white`}>{feature.icon}</div>

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-2">{feature.name}</h2>
            <p className="text-slate-400">{feature.description}</p>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-slate-900/50 rounded-lg">
            <p className="text-sm text-slate-400 mb-1">Cost per call</p>
            <p className="text-xl font-mono text-cyan-400">${feature.estimatedCost.toFixed(4)}</p>
          </div>

          <div className="p-4 bg-slate-900/50 rounded-lg">
            <p className="text-sm text-slate-400 mb-1">Status</p>
            <p className="text-xl font-semibold text-green-400">{feature.enabled ? 'Enabled' : 'Disabled'}</p>
          </div>
        </div>

        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-sm text-blue-300">
            This feature is integrated with Phase 0.5 AI Operations Control Plane. All calls are routed through the unified router with
            automatic cost tracking and budget enforcement.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>

          <button className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:opacity-90 transition-opacity font-semibold">
            Use Feature
          </button>
        </div>
      </div>
    </div>
  );
}

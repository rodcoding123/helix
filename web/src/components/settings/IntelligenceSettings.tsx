/**
 * Intelligence Settings Panel - Phase 8
 * Configure AI operations, model selection, and budget limits
 * Provides unified settings for email, calendar, task, and analytics intelligence
 */

import React, { useState, useEffect } from 'react';
import type { Operation, RoutingDecision } from '@/services/llm-router/types';

interface OperationSetting {
  operationId: string;
  enabled: boolean;
  primaryModel: string;
  fallbackModel: string;
  costCriticality: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface BudgetSetting {
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  warningThreshold: number; // Percentage (0-100)
}

export const IntelligenceSettings: React.FC = () => {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [operationSettings, setOperationSettings] = useState<
    Map<string, OperationSetting>
  >(new Map());
  const [budgetSettings, setBudgetSettings] = useState<BudgetSetting>({
    dailyLimitUsd: 50,
    monthlyLimitUsd: 1000,
    warningThreshold: 80,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'operations' | 'budget' | 'models'>(
    'operations'
  );

  useEffect(() => {
    loadOperations();
    loadSettings();
  }, []);

  const loadOperations = async () => {
    try {
      const response = await fetch('/api/llm-router/operations');
      if (response.ok) {
        const ops = await response.json();
        setOperations(ops);

        // Initialize operation settings
        const settings = new Map<string, OperationSetting>();
        for (const op of ops) {
          settings.set(op.id, {
            operationId: op.id,
            enabled: op.enabled,
            primaryModel: op.primaryModel,
            fallbackModel: op.fallbackModel,
            costCriticality: op.costCriticality,
          });
        }
        setOperationSettings(settings);
      }
    } catch (error) {
      console.error('Failed to load operations:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/intelligence-settings');
      if (response.ok) {
        const settings = await response.json();
        setBudgetSettings(settings.budget);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/intelligence-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operations: Array.from(operationSettings.values()),
          budget: budgetSettings,
        }),
      });

      if (response.ok) {
        setLastSaved(new Date());
        console.log('Settings saved successfully');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleOperation = (operationId: string) => {
    const setting = operationSettings.get(operationId);
    if (setting) {
      setting.enabled = !setting.enabled;
      setOperationSettings(new Map(operationSettings));
    }
  };

  const updateModel = (
    operationId: string,
    field: 'primaryModel' | 'fallbackModel',
    value: string
  ) => {
    const setting = operationSettings.get(operationId);
    if (setting) {
      setting[field] = value;
      setOperationSettings(new Map(operationSettings));
    }
  };

  // Group operations by category
  const emailOps = operations.filter((op) => op.id.startsWith('email-'));
  const calendarOps = operations.filter((op) => op.id.startsWith('calendar-'));
  const taskOps = operations.filter((op) => op.id.startsWith('task-'));
  const analyticsOps = operations.filter((op) =>
    op.id.startsWith('analytics-')
  );

  const OperationCard: React.FC<{ op: Operation }> = ({ op }) => {
    const setting = operationSettings.get(op.id);
    if (!setting) return null;

    return (
      <div className="flex items-center justify-between p-4 border border-gray-300 rounded-lg bg-white hover:shadow-md transition-shadow">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={setting.enabled}
              onChange={() => toggleOperation(op.id)}
              className="w-5 h-5"
            />
            <div>
              <h4 className="font-semibold text-gray-900">{op.name}</h4>
              <p className="text-sm text-gray-600">{op.description}</p>
            </div>
          </div>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="text-gray-600">
              Cost: ${op.estimatedCostUsd.toFixed(4)}
            </span>
            <span className="text-gray-600">
              Criticality:{' '}
              <span className={`font-medium ${getCriticalityColor(op.costCriticality)}`}>
                {op.costCriticality}
              </span>
            </span>
          </div>
        </div>
      </div>
    );
  };

  const getCriticalityColor = (criticality: string) => {
    switch (criticality) {
      case 'HIGH':
        return 'text-red-600';
      case 'MEDIUM':
        return 'text-yellow-600';
      case 'LOW':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="w-full max-w-4xl bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-2xl font-bold text-gray-900">Intelligence Settings</h2>
        <p className="text-sm text-gray-600 mt-1">
          Configure AI operations, models, and budget limits
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {['operations', 'budget', 'models'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as typeof activeTab)}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'operations' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Email Intelligence
              </h3>
              <div className="space-y-2">
                {emailOps.map((op) => (
                  <OperationCard key={op.id} op={op} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Calendar Intelligence
              </h3>
              <div className="space-y-2">
                {calendarOps.map((op) => (
                  <OperationCard key={op.id} op={op} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Task Intelligence
              </h3>
              <div className="space-y-2">
                {taskOps.map((op) => (
                  <OperationCard key={op.id} op={op} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Analytics Intelligence
              </h3>
              <div className="space-y-2">
                {analyticsOps.map((op) => (
                  <OperationCard key={op.id} op={op} />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'budget' && (
          <div className="space-y-6 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Daily Budget Limit (USD)
              </label>
              <input
                type="number"
                value={budgetSettings.dailyLimitUsd}
                onChange={(e) =>
                  setBudgetSettings({
                    ...budgetSettings,
                    dailyLimitUsd: parseFloat(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-600 mt-1">
                Default: $50.00/day for standard users
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monthly Budget Limit (USD)
              </label>
              <input
                type="number"
                value={budgetSettings.monthlyLimitUsd}
                onChange={(e) =>
                  setBudgetSettings({
                    ...budgetSettings,
                    monthlyLimitUsd: parseFloat(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-600 mt-1">
                Default: $1,000.00/month for standard users
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Warning Threshold (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={budgetSettings.warningThreshold}
                onChange={(e) =>
                  setBudgetSettings({
                    ...budgetSettings,
                    warningThreshold: parseFloat(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-600 mt-1">
                Alert when budget usage exceeds this threshold
              </p>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Current Usage:</strong> This month you've used approximately
                $15.40 of your $1,000 budget
              </p>
              <div className="w-full bg-gray-300 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: '1.54%' }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'models' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Model Configuration
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Select primary and fallback models for each operation category
              </p>

              <div className="grid grid-cols-2 gap-6">
                {['Email', 'Calendar', 'Task', 'Analytics'].map((category) => (
                  <div key={category} className="border border-gray-300 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">{category}</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Primary
                        </label>
                        <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option>Claude Opus 4.5 ($3/$15 per MTok)</option>
                          <option>DeepSeek v3.2 ($0.60/$2 per MTok)</option>
                          <option>Gemini 2.0 Flash ($0.05/$0.20 per MTok)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Fallback
                        </label>
                        <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option>DeepSeek v3.2</option>
                          <option>Gemini 2.0 Flash</option>
                          <option>Claude Opus 4.5</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-900">
                ⚠️ <strong>Note:</strong> Model selection is automatic based on cost and
                availability. Manual overrides available for advanced users.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-6 py-4 flex justify-between items-center">
        <div className="text-sm text-gray-600">
          {lastSaved && <span>Last saved: {lastSaved.toLocaleTimeString()}</span>}
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadSettings}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={saveSettings}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

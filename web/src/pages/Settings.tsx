/**
 * Phase 9C: Settings Page - User customization and preferences
 * Fully wired to PreferencesService and Theme backend
 */

import React, { useState } from 'react';
import { usePreferences } from '@/hooks/usePreferences';

const MODELS = [
  { id: 'anthropic', name: 'Anthropic Claude', description: 'Most capable, higher cost' },
  { id: 'deepseek', name: 'DeepSeek', description: 'Fast, cost-effective' },
  { id: 'gemini', name: 'Google Gemini', description: 'Balanced performance and cost' },
  { id: 'openai', name: 'OpenAI GPT', description: 'Advanced reasoning, premium' },
];

const OPERATIONS = [
  { id: 'email-compose', name: 'Email Composition', description: 'Draft and compose email responses' },
  { id: 'email-classify', name: 'Email Classification', description: 'Categorize incoming emails' },
  { id: 'email-respond', name: 'Response Suggestions', description: 'Suggest relevant responses' },
  { id: 'calendar-prep', name: 'Meeting Preparation', description: 'Prepare for upcoming meetings' },
  { id: 'calendar-time', name: 'Optimal Meeting Times', description: 'Find best times for meetings' },
  { id: 'task-prioritize', name: 'Task Prioritization', description: 'Prioritize your tasks' },
  { id: 'task-breakdown', name: 'Task Breakdown', description: 'Break down complex tasks' },
  { id: 'analytics-summary', name: 'Weekly Summary', description: 'Generate weekly summaries' },
  { id: 'analytics-anomaly', name: 'Pattern Anomalies', description: 'Detect unusual patterns' },
];

export function Settings(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'operations' | 'theme' | 'notifications'>('operations');
  const { operationPrefs, themePrefs, loading, error, updateOperationPreference, updateThemePreference } = usePreferences();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-500">Loading preferences...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings & Preferences</h1>
        <p className="text-gray-600 mt-2">Customize operations, models, themes, and notifications</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {['operations', 'theme', 'notifications'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`py-3 px-1 border-b-2 font-medium transition ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Operations Tab */}
      {activeTab === 'operations' && (
        <OperationsPanel operationPrefs={operationPrefs} onUpdate={updateOperationPreference} />
      )}

      {/* Theme Tab */}
      {activeTab === 'theme' && (
        <ThemePanel themePrefs={themePrefs} onUpdate={updateThemePreference} />
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <NotificationsPanel themePrefs={themePrefs} onUpdate={updateThemePreference} />
      )}
    </div>
  );
}

/**
 * Operations Panel - Per-operation settings
 */
function OperationsPanel({ operationPrefs, onUpdate }: any): React.ReactElement {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Operation Preferences</h2>
        <p className="text-sm text-gray-600">Configure model selection and budgets per operation</p>
      </div>

      <div className="grid gap-4">
        {OPERATIONS.map(op => {
          const pref = operationPrefs.find((p: any) => p.operation_id === op.id);

          return (
            <div key={op.id} className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-200 transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">{op.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{op.description}</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pref?.enabled !== false}
                    onChange={(e) => onUpdate(op.id, { enabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm font-medium">Enabled</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Model Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Model</label>
                  <select
                    value={pref?.preferred_model || 'deepseek'}
                    onChange={(e) => onUpdate(op.id, { preferred_model: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {MODELS.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {MODELS.find(m => m.id === (pref?.preferred_model || 'deepseek'))?.description}
                  </p>
                </div>

                {/* Monthly Budget */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Budget (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="No limit"
                    value={pref?.cost_budget_monthly || ''}
                    onChange={(e) => onUpdate(op.id, { cost_budget_monthly: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave blank for no limit</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Theme Panel - UI customization
 */
function ThemePanel({ themePrefs, onUpdate }: any): React.ReactElement {
  if (!themePrefs) {
    return <div className="text-center py-8 text-gray-500">Loading theme preferences...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Color Scheme */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-4">Color Scheme</h3>
          <div className="space-y-3">
            {['light', 'dark', 'auto'].map(scheme => (
              <label key={scheme} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="color-scheme"
                  value={scheme}
                  checked={themePrefs.color_scheme === scheme}
                  onChange={(e) => onUpdate({ color_scheme: e.target.value })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="capitalize">{scheme === 'auto' ? 'Auto (System)' : scheme}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Accent Color */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-4">Accent Color</h3>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={themePrefs.accent_color}
              onChange={(e) => onUpdate({ accent_color: e.target.value })}
              className="w-16 h-16 rounded cursor-pointer"
            />
            <div>
              <p className="text-sm text-gray-600">Current</p>
              <p className="font-mono text-sm">{themePrefs.accent_color}</p>
            </div>
          </div>
        </div>

        {/* Layout Preferences */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-4">Layout Preferences</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email List View</label>
              <select
                value={themePrefs.email_list_view}
                onChange={(e) => onUpdate({ email_list_view: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="grid">Grid</option>
                <option value="list">List</option>
                <option value="compact">Compact</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Calendar View</label>
              <select
                value={themePrefs.calendar_view}
                onChange={(e) => onUpdate({ calendar_view: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="month">Month</option>
                <option value="week">Week</option>
                <option value="day">Day</option>
                <option value="agenda">Agenda</option>
              </select>
            </div>
          </div>
        </div>

        {/* Compact Mode */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-4">Display</h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={themePrefs.compact_mode}
              onChange={(e) => onUpdate({ compact_mode: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span>Compact Mode (reduced padding)</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer mt-4">
            <input
              type="checkbox"
              checked={themePrefs.sidebar_collapsed}
              onChange={(e) => onUpdate({ sidebar_collapsed: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span>Collapse Sidebar</span>
          </label>
        </div>
      </div>
    </div>
  );
}

/**
 * Notifications Panel
 */
function NotificationsPanel({ themePrefs, onUpdate }: any): React.ReactElement {
  if (!themePrefs) {
    return <div className="text-center py-8 text-gray-500">Loading notification preferences...</div>;
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 max-w-2xl">
      <h2 className="text-xl font-semibold mb-6">Notification Preferences</h2>

      <div className="space-y-4">
        <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={themePrefs.notify_on_operation_completion}
            onChange={(e) => onUpdate({ notify_on_operation_completion: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <div className="flex-1">
            <p className="font-medium">Operation Completion</p>
            <p className="text-sm text-gray-600">Get notified when operations finish</p>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={themePrefs.notify_on_operation_failure}
            onChange={(e) => onUpdate({ notify_on_operation_failure: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <div className="flex-1">
            <p className="font-medium">Operation Failures</p>
            <p className="text-sm text-gray-600">Get notified when operations fail</p>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={themePrefs.notify_on_cost_limit_warning}
            onChange={(e) => onUpdate({ notify_on_cost_limit_warning: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <div className="flex-1">
            <p className="font-medium">Cost Limit Warning</p>
            <p className="text-sm text-gray-600">Get notified when approaching budget limits (80%)</p>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={themePrefs.notify_on_cost_limit_exceeded}
            onChange={(e) => onUpdate({ notify_on_cost_limit_exceeded: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <div className="flex-1">
            <p className="font-medium">Cost Limit Exceeded</p>
            <p className="text-sm text-gray-600">Get notified when budget limits are exceeded</p>
          </div>
        </label>
      </div>
    </div>
  );
}

export default Settings;

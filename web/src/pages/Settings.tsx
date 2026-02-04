/**
 * Phase 9C: Settings Page - User customization and preferences
 */

import React, { useState } from 'react';

export function Settings(): React.ReactElement {
  const [colorScheme, setColorScheme] = useState('auto');

  const OPERATIONS = [
    { id: 'email-compose', name: 'Email Composition' },
    { id: 'email-classify', name: 'Email Classification' },
    { id: 'email-respond', name: 'Response Suggestions' },
    { id: 'calendar-prep', name: 'Meeting Preparation' },
    { id: 'calendar-time', name: 'Optimal Meeting Times' },
    { id: 'task-prioritize', name: 'Task Prioritization' },
    { id: 'task-breakdown', name: 'Task Breakdown' },
    { id: 'analytics-summary', name: 'Weekly Summary' },
    { id: 'analytics-anomaly', name: 'Pattern Anomalies' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      {/* Operation Preferences */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Operation Preferences</h2>
        <div className="space-y-4">
          {OPERATIONS.map(op => (
            <div key={op.id} className="p-4 border rounded">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">{op.name}</h3>
                <input type="checkbox" defaultChecked />
              </div>
              <select className="w-full border rounded px-3 py-2 text-sm mt-3">
                <option>DeepSeek</option>
                <option>Gemini Flash</option>
                <option>OpenAI</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Theme Settings */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Theme</h2>
        <select
          value={colorScheme}
          onChange={e => setColorScheme(e.target.value)}
          className="w-full border rounded px-3 py-2"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="auto">Auto (System)</option>
        </select>
      </div>

      {/* Budget Settings */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Budget</h2>
        <input
          type="number"
          defaultValue={50}
          placeholder="Daily budget (USD)"
          className="w-full border rounded px-3 py-2"
        />
      </div>
    </div>
  );
}

export default Settings;

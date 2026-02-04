/**
 * Admin Dashboard Layout
 *
 * Phase 0.5 Admin Control Plane - Main Layout
 * Navigation and routing for all 3 admin dashboard tiers
 *
 * Structure:
 * - Tier 1: Observability (view-only metrics)
 * - Tier 2: Control (change routing and toggles)
 * - Tier 3: Intelligence (review Helix recommendations)
 */

import React, { useState } from 'react';
import AdminDashboard from './dashboard';
import AdminControls from './controls';
import AdminIntelligence from './intelligence';

export type AdminTier = 'observability' | 'control' | 'intelligence';

/**
 * Admin Layout Component
 *
 * Provides tabbed navigation between the 3 tiers:
 * 1. Observability: Real-time metrics (read-only)
 * 2. Control: Manual configuration changes (write enabled)
 * 3. Intelligence: Helix recommendations (approval workflow)
 */
export const AdminLayout: React.FC = () => {
  const [tier, setTier] = useState<AdminTier>('observability');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-4">
          <h1 className="text-3xl font-bold text-gray-900">Helix Admin Control Plane</h1>
          <p className="text-gray-600 text-sm mt-1">Phase 0.5: Centralized AI Operations Management</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 flex gap-8">
          {/* Tier 1: Observability */}
          <button
            onClick={() => setTier('observability')}
            className={`py-4 px-2 font-semibold text-sm border-b-2 transition-colors ${
              tier === 'observability'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="text-lg">👁️</span>
              Tier 1: Observability
            </span>
            <span className="text-xs text-gray-500 font-normal block">View-only metrics</span>
          </button>

          {/* Tier 2: Control */}
          <button
            onClick={() => setTier('control')}
            className={`py-4 px-2 font-semibold text-sm border-b-2 transition-colors ${
              tier === 'control'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="text-lg">🎛️</span>
              Tier 2: Control
            </span>
            <span className="text-xs text-gray-500 font-normal block">Manual configuration</span>
          </button>

          {/* Tier 3: Intelligence */}
          <button
            onClick={() => setTier('intelligence')}
            className={`py-4 px-2 font-semibold text-sm border-b-2 transition-colors ${
              tier === 'intelligence'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="text-lg">🧠</span>
              Tier 3: Intelligence
            </span>
            <span className="text-xs text-gray-500 font-normal block">Helix recommendations</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div>
        {tier === 'observability' && <AdminDashboard />}
        {tier === 'control' && <AdminControls />}
        {tier === 'intelligence' && <AdminIntelligence />}
      </div>

      {/* Footer Info */}
      <div className="bg-white border-t border-gray-200 mt-12 px-8 py-6">
        <div className="grid grid-cols-3 gap-8">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Tier 1: Observability</h3>
            <p className="text-sm text-gray-600">
              Real-time view of operations, costs, quality, and latency. Read-only access for monitoring.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Tier 2: Control</h3>
            <p className="text-sm text-gray-600">
              Manage routing configuration, toggle features on/off, and adjust budgets. Admin-only.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Tier 3: Intelligence</h3>
            <p className="text-sm text-gray-600">
              Review Helix's optimization proposals with confidence scores and estimated savings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;

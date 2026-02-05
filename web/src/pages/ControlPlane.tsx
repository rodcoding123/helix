import { useState } from 'react';
import CostDashboard from '../components/control-plane/CostDashboard';
import ApprovalQueue from '../components/control-plane/ApprovalQueue';
import RoutingConfig from '../components/control-plane/RoutingConfig';
import FeatureToggles from '../components/control-plane/FeatureToggles';
import BudgetOverride from '../components/control-plane/BudgetOverride';

export default function ControlPlane() {
  const [activeTab, setActiveTab] = useState<'cost' | 'approvals' | 'routing' | 'toggles' | 'budget'>('cost');

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Helix AI Operations Control Plane</h1>
        <p className="text-gray-400">Real-time monitoring and control of AI provider routing, costs, and safety</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('cost')}
          className={`px-4 py-2 font-semibold transition ${
            activeTab === 'cost'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          💰 Cost Dashboard
        </button>
        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-4 py-2 font-semibold transition ${
            activeTab === 'approvals'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          ✅ Approvals
        </button>
        <button
          onClick={() => setActiveTab('routing')}
          className={`px-4 py-2 font-semibold transition ${
            activeTab === 'routing'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          🛣️ Routing
        </button>
        <button
          onClick={() => setActiveTab('toggles')}
          className={`px-4 py-2 font-semibold transition ${
            activeTab === 'toggles'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          🔒 Toggles
        </button>
        <button
          onClick={() => setActiveTab('budget')}
          className={`px-4 py-2 font-semibold transition ${
            activeTab === 'budget'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          💵 Budget
        </button>
      </div>

      {/* Content */}
      <div className="bg-gray-800 rounded-lg p-6">
        {activeTab === 'cost' && <CostDashboard />}
        {activeTab === 'approvals' && <ApprovalQueue />}
        {activeTab === 'routing' && <RoutingConfig />}
        {activeTab === 'toggles' && <FeatureToggles />}
        {activeTab === 'budget' && <BudgetOverride />}
      </div>
    </div>
  );
}

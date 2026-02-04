/**
 * Admin Dashboard - Tier 3: Intelligence
 *
 * Phase 0.5 Admin Control Plane - Intelligence Tier
 * Displays Helix's self-optimization recommendations
 *
 * Features:
 * - Pending recommendations from Helix
 * - Estimated savings calculations
 * - A/B test results
 * - Quality impact analysis
 * - Approval/rejection interface
 */

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface HelixRecommendation {
  id: string;
  operation_id: string;
  recommendation_type: string;
  current_config: Record<string, unknown>;
  proposed_config: Record<string, unknown>;
  estimated_savings_usd: number;
  estimated_quality_impact: number;
  confidence: number;
  reasoning: string;
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
}

/**
 * Tier 3: Intelligence Dashboard
 *
 * Shows Helix's recommendations:
 * - Cost optimization suggestions
 * - Model switching proposals
 * - Schedule optimization ideas
 * - Caching strategies
 * - Approval workflow for recommendations
 */
export const AdminIntelligence: React.FC = () => {
  const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL || '',
    process.env.REACT_APP_SUPABASE_ANON_KEY || ''
  );

  const [recommendations, setRecommendations] = useState<HelixRecommendation[]>([]);
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecommendations();
  }, [filter]);

  async function loadRecommendations() {
    try {
      let query = supabase.from('helix_recommendations').select('*');

      if (filter !== 'ALL') {
        query = query.eq('approval_status', filter);
      }

      const { data, error: err } = await query.order('created_at', { ascending: false });

      if (err) throw err;
      setRecommendations(data || []);
      setLoading(false);
    } catch (e) {
      setError(`Failed to load recommendations: ${String(e)}`);
      setLoading(false);
    }
  }

  async function approveRecommendation(id: string) {
    try {
      const { error: err } = await supabase
        .from('helix_recommendations')
        .update({
          approval_status: 'APPROVED',
          approved_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (err) throw err;
      await loadRecommendations();
    } catch (e) {
      setError(`Failed to approve recommendation: ${String(e)}`);
    }
  }

  async function rejectRecommendation(id: string) {
    try {
      const { error: err } = await supabase
        .from('helix_recommendations')
        .update({
          approval_status: 'REJECTED',
          approved_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (err) throw err;
      await loadRecommendations();
    } catch (e) {
      setError(`Failed to reject recommendation: ${String(e)}`);
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  const getTotalSavings = () => {
    return recommendations
      .filter((r) => r.approval_status === 'APPROVED')
      .reduce((sum, r) => sum + (r.estimated_savings_usd || 0), 0);
  };

  const getAvgConfidence = () => {
    if (recommendations.length === 0) return 0;
    return (
      recommendations.reduce((sum, r) => sum + (r.confidence || 0), 0) /
      recommendations.length
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Helix Intelligence</h1>
        <p className="text-gray-600 mt-2">
          Helix's self-optimization recommendations (analysis only, requires approval)
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 font-semibold uppercase">Pending</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">
            {recommendations.filter((r) => r.approval_status === 'PENDING').length}
          </div>
          <div className="text-xs text-gray-500 mt-2">Awaiting approval</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 font-semibold uppercase">Approved</div>
          <div className="text-3xl font-bold text-green-600 mt-2">
            {recommendations.filter((r) => r.approval_status === 'APPROVED').length}
          </div>
          <div className="text-xs text-gray-500 mt-2">Implemented</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 font-semibold uppercase">Potential Savings</div>
          <div className="text-3xl font-bold text-purple-600 mt-2">${getTotalSavings().toFixed(2)}</div>
          <div className="text-xs text-gray-500 mt-2">If all approved</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 font-semibold uppercase">Avg Confidence</div>
          <div className="text-3xl font-bold text-orange-600 mt-2">{(getAvgConfidence() * 100).toFixed(0)}%</div>
          <div className="text-xs text-gray-500 mt-2">Helix confidence level</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="flex border-b border-gray-200">
          {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
                filter === status
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Recommendations List */}
      <div className="space-y-4">
        {recommendations.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">No recommendations in this category</p>
          </div>
        ) : (
          recommendations.map((rec) => (
            <div key={rec.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {rec.recommendation_type}: {rec.operation_id}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                        rec.approval_status === 'PENDING'
                          ? 'bg-blue-100 text-blue-800'
                          : rec.approval_status === 'APPROVED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {rec.approval_status}
                    </span>
                    <span className="text-xs text-gray-500">
                      Confidence: {(rec.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <div className="text-2xl font-bold text-green-600">
                    ${rec.estimated_savings_usd?.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-600">potential savings</div>
                </div>
              </div>

              {/* Reasoning */}
              <div className="bg-gray-50 rounded p-4 mb-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Helix's Reasoning</h4>
                <p className="text-sm text-gray-700">{rec.reasoning}</p>
              </div>

              {/* Quality Impact */}
              {rec.estimated_quality_impact !== 0 && (
                <div className="mb-4 p-3 rounded bg-yellow-50 border border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Quality Impact: {rec.estimated_quality_impact > 0 ? '+' : ''}
                    {rec.estimated_quality_impact.toFixed(1)} percentage points
                  </p>
                </div>
              )}

              {/* Current vs Proposed */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Current</h4>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                    {JSON.stringify(rec.current_config, null, 2)}
                  </pre>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Proposed</h4>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                    {JSON.stringify(rec.proposed_config, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Actions */}
              {rec.approval_status === 'PENDING' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => approveRecommendation(rec.id)}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition-colors"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => rejectRecommendation(rec.id)}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold transition-colors"
                  >
                    ✗ Reject
                  </button>
                </div>
              )}

              {/* Metadata */}
              <div className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-200">
                <p>Created: {new Date(rec.created_at).toLocaleString()}</p>
                {rec.approved_at && (
                  <p>
                    {rec.approval_status}: {new Date(rec.approved_at).toLocaleString()} by{' '}
                    {rec.approved_by}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Important Note */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-blue-900">ℹ️ How Helix Intelligence Works</h3>
        <ul className="text-sm text-blue-800 mt-2 space-y-1">
          <li>• Helix analyzes operation performance and costs</li>
          <li>• Helix proposes optimizations (model switches, caching, batching)</li>
          <li>• Helix CANNOT execute recommendations - all require approval</li>
          <li>• You review, approve, or reject each recommendation</li>
          <li>• Approved recommendations are implemented in next cycle</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminIntelligence;

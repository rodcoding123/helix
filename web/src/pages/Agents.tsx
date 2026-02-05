import { FC, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserAgents, useDeleteAgent } from '@/hooks/queries/useUserAgents';
import type { Agent } from '@/lib/types/agents';

/**
 * Agents Dashboard: View, manage, and customize agents
 * Shows personality profiles, autonomy levels, and conversation history
 */
export const AgentsPage: FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  // Use React Query hooks for data fetching and caching
  const { data: agents = [], isLoading } = useUserAgents(user?.id);
  const deleteAgentMutation = useDeleteAgent();

  const handleDeleteAgent = async (agentId: string) => {
    if (!user?.id) return;
    if (!window.confirm('Delete this agent?')) return;

    try {
      await deleteAgentMutation.mutateAsync({ agentId, userId: user.id });
      setSelectedAgent(null);
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const getAutonomyLevelLabel = (level: number): string => {
    const labels = [
      'Propose-Only',
      'Inform-After',
      'Alert-Async',
      'Autonomous',
    ];
    return labels[level] || 'Unknown';
  };

  const getAutonomyLevelColor = (level: number): string => {
    const colors = [
      'bg-yellow-100 text-yellow-900',
      'bg-orange-100 text-orange-900',
      'bg-blue-100 text-blue-900',
      'bg-purple-100 text-purple-900',
    ];
    return colors[level] || 'bg-gray-100 text-gray-900';
  };

  if (authLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <p className="text-gray-600">Please sign in to view your agents.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold">My Agents</h1>
        <p className="text-gray-600">
          {agents.length} agent{agents.length !== 1 ? 's' : ''} created
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading agents...</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">
            No agents yet. When I detect patterns in your conversations, I'll
            propose helpful agents.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          {/* Agents List (left) */}
          <div className="lg:col-span-1 space-y-3">
            <h2 className="text-lg font-semibold">Agents</h2>
            <div className="space-y-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                    selectedAgent?.id === agent.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900">{agent.name}</div>
                  <div className="text-sm text-gray-600">{agent.role}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {agent.conversation_count} conversations
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Agent Details (right) */}
          {selectedAgent && (
            <div className="lg:col-span-2 space-y-4">
              {/* Basic Info */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    {selectedAgent.name}
                  </h3>
                  <p className="text-gray-600">{selectedAgent.description}</p>
                </div>

                {/* Autonomy Badge */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">
                    AUTONOMY LEVEL
                  </p>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getAutonomyLevelColor(
                      selectedAgent.autonomy_level
                    )}`}
                  >
                    {getAutonomyLevelLabel(selectedAgent.autonomy_level)}
                  </span>
                </div>

                {/* Role & Scope */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-600">ROLE</p>
                    <p className="text-gray-900">{selectedAgent.role}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600">SCOPE</p>
                    <p className="text-gray-900">{selectedAgent.scope}</p>
                  </div>
                </div>

                {/* Goals */}
                {selectedAgent.goals.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-1">
                      GOALS
                    </p>
                    <ul className="space-y-1">
                      {selectedAgent.goals.map((goal, idx) => (
                        <li key={idx} className="text-sm text-gray-700">
                          • {goal}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Personality Profile */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <h4 className="font-semibold text-gray-900">Personality</h4>
                <div className="space-y-3">
                  {Object.entries(selectedAgent.personality).map(
                    ([dimension, value]) => (
                      <div key={dimension}>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            {dimension.charAt(0).toUpperCase() +
                              dimension.slice(1)}
                          </span>
                          <span className="text-sm text-gray-600">
                            {(value * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-500 h-2 rounded-full transition-all"
                            style={{ width: `${value * 100}%` }}
                          />
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-1">
                <div>
                  Created:{' '}
                  {new Date(selectedAgent.created_at).toLocaleDateString()}
                </div>
                <div>
                  Last used:{' '}
                  {selectedAgent.last_used
                    ? new Date(selectedAgent.last_used).toLocaleDateString()
                    : 'Never'}
                </div>
                <div>
                  Conversations: {selectedAgent.conversation_count}
                </div>
              </div>

              {/* Delete Button */}
              <button
                onClick={() => handleDeleteAgent(selectedAgent.id)}
                className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                Delete Agent
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentsPage;

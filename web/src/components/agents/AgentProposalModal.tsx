import React from 'react';
import type { AgentProposal } from '@/lib/types/agents';

interface AgentProposalModalProps {
  proposal: AgentProposal | null;
  onApprove: (proposal: AgentProposal) => Promise<void>;
  onReject: (proposal: AgentProposal) => Promise<void>;
  isLoading?: boolean;
}

/**
 * AgentProposalModal: Shows Helix's agent creation proposal
 * Displays detected pattern, reason, and approve/reject buttons
 */
export const AgentProposalModal: React.FC<AgentProposalModalProps> = ({
  proposal,
  onApprove,
  onReject,
  isLoading = false,
}) => {
  const [isApproving, setIsApproving] = React.useState(false);
  const [isRejecting, setIsRejecting] = React.useState(false);

  if (!proposal) {
    return null;
  }

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await onApprove(proposal);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await onReject(proposal);
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 space-y-4">
        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Agent Proposal</h2>
          <p className="text-sm text-gray-600">
            I'd like to create a new agent to help you
          </p>
        </div>

        {/* Agent Details */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 space-y-2">
          <div>
            <p className="text-xs font-semibold text-gray-600">AGENT NAME</p>
            <p className="text-lg font-bold text-gray-900">
              {proposal.proposed_name}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600">ROLE</p>
            <p className="text-gray-700">{proposal.proposed_role}</p>
          </div>
        </div>

        {/* Reason */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-600">WHY</p>
          <p className="text-sm text-gray-700">{proposal.reason}</p>
        </div>

        {/* Detected Pattern */}
        {proposal.detected_pattern && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600">DETECTED PATTERN</p>
            <div className="space-y-1">
              {proposal.detected_pattern.topic_cluster.length > 0 && (
                <div>
                  <p className="text-xs text-gray-600">Topics:</p>
                  <div className="flex flex-wrap gap-1">
                    {proposal.detected_pattern.topic_cluster.map((topic) => (
                      <span
                        key={topic}
                        className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-600">
                Frequency: {(proposal.detected_pattern.frequency * 100).toFixed(0)}% of conversations
              </p>
              <p className="text-xs text-gray-600">
                Confidence: {(proposal.detected_pattern.confidence * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-gray-700 italic">
                "{proposal.detected_pattern.context}"
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleReject}
            disabled={isLoading || isApproving || isRejecting}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {isRejecting ? 'Rejecting...' : 'Not Now'}
          </button>
          <button
            onClick={handleApprove}
            disabled={isLoading || isApproving || isRejecting}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {isApproving ? 'Creating...' : 'Create Agent'}
          </button>
        </div>

        {/* Info text */}
        <p className="text-xs text-gray-500 text-center">
          You can always customize or delete agents later
        </p>
      </div>
    </div>
  );
};

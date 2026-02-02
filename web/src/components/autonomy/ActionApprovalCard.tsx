import React from 'react';
import type { AutonomyAction } from '@/lib/types/agents';

interface ActionApprovalCardProps {
  action: AutonomyAction;
  onApprove: (actionId: string) => Promise<void>;
  onReject: (actionId: string) => Promise<void>;
}

/**
 * ActionApprovalCard: Shows a pending action awaiting user approval
 * Displays action details, risk level, and approve/reject buttons
 */
export const ActionApprovalCard: React.FC<ActionApprovalCardProps> = ({
  action,
  onApprove,
  onReject,
}) => {
  const [isApproving, setIsApproving] = React.useState(false);
  const [isRejecting, setIsRejecting] = React.useState(false);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await onApprove(action.id);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await onReject(action.id);
    } finally {
      setIsRejecting(false);
    }
  };

  const getRiskColor = (
    risk: 'low' | 'medium' | 'high'
  ): string => {
    switch (risk) {
      case 'low':
        return 'bg-green-100 text-green-900';
      case 'medium':
        return 'bg-yellow-100 text-yellow-900';
      case 'high':
        return 'bg-red-100 text-red-900';
      default:
        return 'bg-gray-100 text-gray-900';
    }
  };

  const getActionTypeIcon = (type: string): string => {
    switch (type) {
      case 'agent_creation':
        return '🤖';
      case 'agent_autonomy_upgrade':
        return '⬆️';
      case 'tool_execution':
        return '🔧';
      default:
        return '⚡';
    }
  };

  const formatActionType = (type: string): string => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="text-2xl">{getActionTypeIcon(action.action_type)}</div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">
              {formatActionType(action.action_type)}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {action.action_description}
            </p>
          </div>
        </div>

        {/* Risk Badge */}
        <span
          className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ml-2 ${getRiskColor(
            action.risk_level
          )}`}
        >
          {action.risk_level} risk
        </span>
      </div>

      {/* Metadata */}
      <div className="text-xs text-gray-500">
        Proposed {new Date(action.created_at).toLocaleDateString()} at{' '}
        {new Date(action.created_at).toLocaleTimeString()}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleReject}
          disabled={isApproving || isRejecting}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {isRejecting ? 'Rejecting...' : 'Reject'}
        </button>
        <button
          onClick={handleApprove}
          disabled={isApproving || isRejecting}
          className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {isApproving ? 'Approving...' : 'Approve'}
        </button>
      </div>
    </div>
  );
};

/**
 * Device Approval Card
 *
 * Displays pending pairing request with approve/reject actions and countdown timer
 * Pattern: ApprovalRequestCard from ExecApprovalsDashboard
 */

import { useEffect, useState } from 'react';
import { Check, X, Clock } from 'lucide-react';
import type { PairingRequest } from './DeviceManagementDashboard';
import './device-management.css';

export interface DeviceApprovalCardProps {
  request: PairingRequest;
  onApprove: () => void;
  onReject: () => void;
}

export function DeviceApprovalCard({ request, onApprove, onReject }: DeviceApprovalCardProps) {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  // Platform icons and colors
  const platformIcons: Record<string, string> = {
    ios: '🍎',
    android: '🤖',
    macos: '🍎',
    linux: '🐧',
    windows: '🪟'
  };

  const platformLabels: Record<string, string> = {
    ios: 'iPhone/iPad',
    android: 'Android',
    macos: 'Mac',
    linux: 'Linux',
    windows: 'Windows'
  };

  // Calculate time remaining
  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, request.expiresAt - now);
      setTimeRemaining(remaining);

      if (remaining === 0) {
        setIsExpired(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [request.expiresAt]);

  const formatTimeRemaining = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const progressPercent = (timeRemaining / (request.expiresAt - request.requestedAt)) * 100;

  if (isExpired) {
    return (
      <div className="dac-card dac-card--expired">
        <div className="dac-icon">⏰</div>
        <div className="dac-content">
          <div className="dac-name">{request.displayName}</div>
          <div className="dac-status">Request expired</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dac-card">
      <div className="dac-icon">{platformIcons[request.platform] || '📱'}</div>

      <div className="dac-content">
        <div className="dac-header">
          <div className="dac-header__left">
            <div className="dac-name">{request.displayName}</div>
            <div className="dac-platform">{platformLabels[request.platform]}</div>
          </div>
          <div className="dac-timer">
            <Clock size={14} />
            <span>{formatTimeRemaining(timeRemaining)}</span>
          </div>
        </div>

        <div className="dac-message">
          <p>Device is requesting permission to pair and access your account</p>
        </div>

        {/* Progress bar */}
        <div className="dac-progress-bar">
          <div className="dac-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="dac-actions">
        <button className="dac-btn dac-btn--approve" onClick={onApprove} title="Approve pairing">
          <Check size={16} />
          <span>Approve</span>
        </button>
        <button className="dac-btn dac-btn--reject" onClick={onReject} title="Reject pairing">
          <X size={16} />
          <span>Reject</span>
        </button>
      </div>
    </div>
  );
}

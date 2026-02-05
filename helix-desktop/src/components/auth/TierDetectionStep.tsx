/**
 * Tier Detection Step - Choose Path Based on Subscription
 *
 * After Supabase login, determine user's path:
 * - Free (awaken/phantom): MANDATORY BYOK setup
 * - Paid (overseer/architect): Centralized system (with optional BYOK for coding)
 */

import { useState, useEffect } from 'react';
import './TierDetectionStep.css';

export type SubscriptionTier = 'awaken' | 'phantom' | 'overseer' | 'architect';

interface TierDetectionStepProps {
  userId: string;
  email: string;
  tier: SubscriptionTier;
  onByokRequired: () => void;  // Free users MUST setup BYOK
  onCentralizedSelected: () => void;  // Paid users: use centralized (default)
  onPaidByokSelected: () => void;  // Paid users: optional BYOK for coding
  onError?: (error: string) => void;
}

const TIER_DETAILS: Record<SubscriptionTier, {
  name: string;
  price: string;
  isFree: boolean;
  description: string;
  features: string[];
  color: string;
  bgGradient: string;
}> = {
  awaken: {
    name: 'Helix Free',
    price: 'Free',
    isFree: true,
    description: 'Run Helix on your machine with your own API keys',
    features: [
      'BYOK (Bring Your Own Key)',
      'Local data storage',
      'Desktop access',
      'Community support',
    ],
    color: '#6b7280',
    bgGradient: 'from-gray-500 to-gray-700',
  },
  phantom: {
    name: 'Phantom',
    price: '$9/mo',
    isFree: true,
    description: 'Complete privacy with optional BYOK',
    features: [
      'BYOK (Bring Your Own Key)',
      'Complete privacy (no data transmission)',
      'Desktop access',
      'Priority support',
    ],
    color: '#8b5cf6',
    bgGradient: 'from-purple-500 to-purple-700',
  },
  overseer: {
    name: 'Overseer',
    price: '$29/mo',
    isFree: false,
    description: 'Managed AI with Observatory access',
    features: [
      '✨ Centralized AI system (managed models)',
      'Observatory access (aggregate insights)',
      'Cost tracking & budgets',
      'Optional BYOK for coding',
      'Priority support',
    ],
    color: '#06b6d4',
    bgGradient: 'from-cyan-500 to-cyan-700',
  },
  architect: {
    name: 'Architect',
    price: '$99/mo',
    isFree: false,
    description: 'Full platform access with all features',
    features: [
      '✨ Centralized AI system (managed models)',
      'Web & Mobile access',
      'Observatory + Research API',
      'Optional BYOK for coding',
      'Dedicated support',
    ],
    color: '#f59e0b',
    bgGradient: 'from-amber-500 to-amber-700',
  },
};

export function TierDetectionStep({
  userId,
  email,
  tier,
  onByokRequired,
  onCentralizedSelected,
  onPaidByokSelected,
  onError,
}: TierDetectionStepProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<'centralized' | 'byok' | null>(null);
  const tierInfo = TIER_DETAILS[tier];
  const isFree = tierInfo.isFree;

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      // Small delay for visual feedback
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (isFree) {
        // Free users: MUST do BYOK
        onByokRequired();
      } else if (selectedPath === 'centralized') {
        // Paid users: Use centralized (default)
        onCentralizedSelected();
      } else if (selectedPath === 'byok') {
        // Paid users: Optional BYOK for coding
        onPaidByokSelected();
      }
    } catch (err) {
      onError?.(`Error: ${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="tier-detection-step">
      {/* Header */}
      <div className="detection-header">
        <h1>Welcome Back, {email.split('@')[0]}! 👋</h1>
        <p className="detection-subtitle">
          {isFree
            ? "Let's set up your API keys to get started"
            : 'You have access to our managed AI system'}
        </p>
      </div>

      {/* Current Tier Display */}
      <div className="current-tier">
        <div
          className={`tier-badge bg-gradient-to-r ${tierInfo.bgGradient}`}
          style={{ color: tierInfo.color }}
        >
          <div className="tier-badge-content">
            <div className="tier-badge-name">{tierInfo.name}</div>
            <div className="tier-badge-price">{tierInfo.price}</div>
          </div>
        </div>
        <div className="tier-description">
          <h2>{tierInfo.description}</h2>
          <ul className="tier-features">
            {tierInfo.features.map((feature, idx) => (
              <li key={idx}>{feature}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Path Selection */}
      {isFree ? (
        // FREE USERS: BYOK MANDATORY
        <div className="path-selection">
          <div className="path-info">
            <div className="info-icon">🔐</div>
            <h3>Set Up Your API Keys</h3>
            <p>
              Your free Helix account uses "Bring Your Own Key" (BYOK). You provide your own API
              keys from providers like Claude, OpenAI, or GitHub Copilot.
            </p>
            <div className="info-points">
              <div className="info-point">
                <span className="point-icon">✓</span>
                <span>Your keys stay on your device</span>
              </div>
              <div className="info-point">
                <span className="point-icon">✓</span>
                <span>We never see or store your keys on our servers</span>
              </div>
              <div className="info-point">
                <span className="point-icon">✓</span>
                <span>You control your own costs</span>
              </div>
            </div>
          </div>

          <button className="btn-continue" onClick={handleContinue} disabled={isLoading}>
            {isLoading ? 'Setting up...' : 'Continue to API Key Setup'}
          </button>

          <div className="plan-upgrade">
            <p>
              Want managed AI without API keys?{' '}
              <a href="https://project-helix.org/pricing" target="_blank" rel="noopener noreferrer">
                Upgrade to Overseer
              </a>
              {' '}or{' '}
              <a href="https://project-helix.org/pricing" target="_blank" rel="noopener noreferrer">
                Architect
              </a>
            </p>
          </div>
        </div>
      ) : (
        // PAID USERS: CHOICE BETWEEN CENTRALIZED & OPTIONAL BYOK
        <div className="path-selection">
          <h3>Choose Your Setup</h3>
          <p className="path-intro">You have access to our managed AI system, but can optionally bring your own keys for coding features.</p>

          {/* Path 1: Centralized (Default) */}
          <div className="path-option">
            <button
              className={`path-button ${selectedPath === 'centralized' ? 'selected' : ''}`}
              onClick={() => setSelectedPath('centralized')}
            >
              <div className="path-option-header">
                <span className="path-icon">⚡</span>
                <span className="path-title">Use Managed AI (Recommended)</span>
                {selectedPath === 'centralized' && <span className="selected-badge">✓</span>}
              </div>
              <p className="path-description">
                Use our centralized AI system with DeepSeek, Google Gemini, and OpenAI models
              </p>
              <ul className="path-benefits">
                <li>✓ No setup needed</li>
                <li>✓ Cost tracking & budgets</li>
                <li>✓ Approval workflows for expensive operations</li>
                <li>✓ Heterogeneous model selection for optimal performance</li>
              </ul>
            </button>
          </div>

          {/* Path 2: Optional BYOK */}
          <div className="path-option">
            <button
              className={`path-button ${selectedPath === 'byok' ? 'selected' : ''}`}
              onClick={() => setSelectedPath('byok')}
            >
              <div className="path-option-header">
                <span className="path-icon">🔑</span>
                <span className="path-title">Add Your Own Keys (Optional)</span>
                {selectedPath === 'byok' && <span className="selected-badge">✓</span>}
              </div>
              <p className="path-description">
                Bring your own API keys for coding features (other operations still use managed AI)
              </p>
              <ul className="path-benefits">
                <li>✓ Use your Claude Code subscription for coding</li>
                <li>✓ Keep your API keys on your device</li>
                <li>✓ You control costs for coding operations</li>
                <li>✓ Centralized system handles other operations</li>
              </ul>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="path-actions">
            <button
              className="btn-continue"
              onClick={handleContinue}
              disabled={!selectedPath || isLoading}
            >
              {isLoading
                ? 'Setting up...'
                : selectedPath === 'centralized'
                  ? "Let's Go!"
                  : 'Set Up API Keys'}
            </button>
          </div>

          <div className="path-note">
            <p>💡 You can change this anytime in Settings</p>
          </div>
        </div>
      )}

      {/* Debug Info */}
      {import.meta.env.DEV && (
        <div className="debug-info">
          <details>
            <summary>Debug: User Info</summary>
            <pre>
              {JSON.stringify(
                { userId, email, tier, isFree, selectedPath },
                null,
                2
              )}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

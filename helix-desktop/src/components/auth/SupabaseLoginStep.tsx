/**
 * Supabase Login Step - MANDATORY FIRST STEP FOR ALL USERS
 *
 * Every user (Free, Paid, Desktop, Web, Mobile) must authenticate with Supabase first.
 * After login, tier is determined from user's subscription record.
 *
 * **Architecture Decision**:
 * - Phase 1 (BYOK): Desktop owns credentials locally
 * - Phase 0.5 (Centralized): Paid users access AIOperationRouter for managed model access
 * - This step determines which path user follows
 */

import { useState, useEffect } from 'react';
import { invoke } from '../../lib/tauri-compat';
import './SupabaseLoginStep.css';

interface LoginResult {
  success: boolean;
  user_id?: string;
  email?: string;
  tier?: 'core' | 'phantom' | 'overseer' | 'architect';
  error?: string;
}

interface SupabaseLoginStepProps {
  onLoginSuccess: (data: { userId: string; email: string; tier: string }) => void;
  onError?: (error: string) => void;
}

/**
 * Tier Information - Displayed to users
 * Synced with web/src/lib/types.ts PRICING_TIERS
 */
const TIER_INFO = {
  core: {
    name: 'Core',
    description: 'Everything. The full architecture.',
    price: 'Free',
    color: '#6b7280',
    features: ['Full Living AI Architecture', 'Run on your machine', 'Basic dashboard', 'Contribute to research'],
  },
  phantom: {
    name: 'Phantom',
    description: 'Complete privacy.',
    price: '$9/mo',
    color: '#8b5cf6',
    features: ['Everything in Core', 'No telemetry', 'No data leaves your machine', 'For those who want solitude'],
  },
  overseer: {
    name: 'Overseer',
    description: 'See the collective.',
    price: '$29/mo',
    color: '#06b6d4',
    features: ['Everything in Core', 'Observatory access', 'Aggregate patterns across all instances', 'Watch what emerges'],
  },
  architect: {
    name: 'Architect',
    description: 'Full access, anywhere.',
    price: '$99/mo',
    color: '#f59e0b',
    features: ['Everything in Overseer', 'Web & Mobile Interface', 'Research API & Exports', 'Shape Development'],
  },
};

export function SupabaseLoginStep({ onLoginSuccess, onError }: SupabaseLoginStepProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [isCheckingPassword, setIsCheckingPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'fair' | 'good' | 'strong' | null>(null);

  // Check password strength
  useEffect(() => {
    if (mode === 'signup' && password) {
      setIsCheckingPassword(true);
      setTimeout(() => {
        const strength = getPasswordStrength(password);
        setPasswordStrength(strength);
        setIsCheckingPassword(false);
      }, 300);
    }
  }, [password, mode]);

  const getPasswordStrength = (pwd: string): 'weak' | 'fair' | 'good' | 'strong' => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[!@#$%^&*]/.test(pwd)) score++;

    if (score <= 1) return 'weak';
    if (score <= 2) return 'fair';
    if (score <= 3) return 'good';
    return 'strong';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await invoke<LoginResult>(
        mode === 'login' ? 'supabase_login' : 'supabase_signup',
        { email: email.trim(), password }
      );

      if (result.success && result.user_id && result.tier) {
        onLoginSuccess({
          userId: result.user_id,
          email: result.email || email,
          tier: result.tier,
        });
      } else {
        const errorMsg = result.error || `${mode === 'login' ? 'Login' : 'Signup'} failed. Please try again.`;
        setError(errorMsg);
        onError?.(errorMsg);
      }
    } catch (err) {
      const errorMsg = `Error: ${String(err)}`;
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="supabase-login-step">
      <div className="login-container">
        {/* Header */}
        <div className="login-header">
          <h1>Welcome to Helix</h1>
          <p className="login-subtitle">
            Sign in to your account to access Helix across all your devices
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="mode-toggle">
          <button
            className={`toggle-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
          >
            Sign In
          </button>
          <button
            className={`toggle-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="you@example.com"
              disabled={isLoading}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="••••••••"
              disabled={isLoading}
              required
              minLength={mode === 'signup' ? 8 : 1}
            />
            {mode === 'signup' && password && (
              <div className="password-strength">
                <div className={`strength-bar strength-${passwordStrength}`} />
                <span className="strength-text">
                  {isCheckingPassword ? 'Checking...' : `Strength: ${passwordStrength?.toUpperCase()}`}
                </span>
              </div>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="btn-submit"
            disabled={isLoading || !email.trim() || !password.trim()}
          >
            {isLoading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Info */}
        <div className="login-info">
          <div className="info-section">
            <h3>🔒 Your Privacy</h3>
            <p>
              Your account is secured with Supabase. We never store your API keys on our servers —
              they're encrypted and stored only on your device.
            </p>
          </div>

          <div className="info-section">
            <h3>🚀 What's Next?</h3>
            <p>
              After login, we'll show you pricing options and set up your preferred AI provider
              access method.
            </p>
          </div>

          <div className="info-section">
            <h3>📱 Cross-Device Sync</h3>
            <p>
              Sign in on all your devices (desktop, web, mobile) to sync your Helix experience
              in real-time.
            </p>
          </div>
        </div>
      </div>

      {/* Tier Reference (for context) */}
      <div className="tier-reference">
        <h4>Available Plans</h4>
        <div className="tier-grid">
          {Object.entries(TIER_INFO).map(([tier, info]) => (
            <div key={tier} className="tier-card">
              <div className="tier-color" style={{ backgroundColor: info.color }} />
              <div className="tier-name">{info.name}</div>
              <div className="tier-price">{info.price}</div>
              <div className="tier-desc">{info.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

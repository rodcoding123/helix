/**
 * Helix Desktop Onboarding - Hybrid Flow
 *
 * Quick Start: Welcome → Mode → Provider → Auth → Complete
 * Advanced: Welcome → Mode → Provider → Auth → Discord → Channels → Voice → Skills → Personality → Privacy → Complete
 */

import { useState, useCallback, useEffect } from 'react';
import { WelcomeStep } from './steps/WelcomeStep';
import { ModeSelectionStep } from './steps/ModeSelectionStep';
import { ProviderSelectionStep, type AuthChoice } from './steps/ProviderSelectionStep';
import { AuthConfigStep, type AuthConfig } from './steps/AuthConfigStep';
import { DiscordStep } from './steps/DiscordStep';
import { ChannelsStep } from './steps/ChannelsStep';
import { VoiceStep, type VoiceSettings } from './steps/VoiceStep';
import { SkillsStep } from './steps/SkillsStep';
import { PersonalityStep } from './steps/PersonalityStep';
import { PrivacyStep } from './steps/PrivacyStep';
import { CompleteStep } from './steps/CompleteStep';
import { ErrorBoundary } from '../common';
import { useGateway } from '../../hooks/useGateway';
import { SupabaseLoginStep } from '../auth/SupabaseLoginStep';
import { TierDetectionStep, type SubscriptionTier } from '../auth/TierDetectionStep';
import { InstanceRegistrationStep, type InstanceRegistrationData } from '../auth/InstanceRegistrationStep';
import './Onboarding.css';

const STORAGE_KEY = 'helix-onboarding-progress';

interface OnboardingProps {
  onComplete: () => void;
}

export interface PersonalitySettings {
  verbosity: number;
  formality: number;
  technicality: number;
  askBeforeActing: boolean;
  shareThinking: boolean;
  useEmoji: boolean;
  humor: number;
}

export interface OnboardingState {
  // Unified Auth (mandatory first)
  supabaseUserId?: string;
  supabaseEmail?: string;
  subscriptionTier?: SubscriptionTier;
  instanceData?: InstanceRegistrationData;

  // Tier-based path
  tierPath?: 'free-byok' | 'paid-centralized' | 'paid-optional-byok';

  // Mode
  mode: 'quickstart' | 'advanced' | null;

  // Auth (provider-based, only for free/optional BYOK)
  authChoice: AuthChoice | null;
  authConfig: AuthConfig | null;

  // Legacy API provider (for backwards compatibility)
  apiProvider?: 'anthropic' | 'openai' | 'google' | null;
  apiKeySet?: boolean;
  apiKeyValue?: string;

  // Discord Logging (Advanced)
  discordEnabled: boolean;
  discordWebhooksSet: boolean;
  discordWebhookUrl?: string;

  // Channels (Advanced)
  enabledChannels: string[];

  // Voice/TTS (Advanced)
  voiceSettings?: VoiceSettings;

  // Skills (Advanced)
  enabledSkills?: string[];

  // Personality (Advanced)
  personality: PersonalitySettings | null;

  // Privacy (Advanced)
  telemetryEnabled: boolean;
  psychologyEnabled: boolean;

  // Legacy Account (for backwards compatibility)
  accountConnected?: boolean;
  accountProvider?: 'github' | 'google' | 'email' | null;
}

type StepId =
  | 'supabase-login'
  | 'tier-detection'
  | 'instance-registration'
  | 'welcome'
  | 'mode'
  | 'provider'
  | 'auth'
  | 'discord'
  | 'channels'
  | 'voice'
  | 'skills'
  | 'personality'
  | 'privacy'
  | 'complete';

// Unified auth (mandatory for all users)
const UNIFIED_AUTH_STEPS: StepId[] = [
  'supabase-login',
  'tier-detection',
  'instance-registration',
];

// Quick Start flow (after unified auth)
const QUICKSTART_STEPS_FREE: StepId[] = [...UNIFIED_AUTH_STEPS, 'welcome', 'mode', 'provider', 'auth', 'complete'];
const QUICKSTART_STEPS_PAID_CENTRALIZED: StepId[] = [...UNIFIED_AUTH_STEPS, 'welcome', 'mode', 'complete'];
const QUICKSTART_STEPS_PAID_OPTIONAL_BYOK: StepId[] = [...UNIFIED_AUTH_STEPS, 'welcome', 'mode', 'provider', 'auth', 'complete'];

// Advanced flow - Full OpenClaw capabilities (after unified auth)
const ADVANCED_STEPS_FREE: StepId[] = [
  ...UNIFIED_AUTH_STEPS,
  'welcome',
  'mode',
  'provider',
  'auth',
  'discord',
  'channels',
  'voice',
  'skills',
  'personality',
  'privacy',
  'complete',
];
const ADVANCED_STEPS_PAID_CENTRALIZED: StepId[] = [
  ...UNIFIED_AUTH_STEPS,
  'welcome',
  'mode',
  'discord',
  'channels',
  'voice',
  'skills',
  'personality',
  'privacy',
  'complete',
];
const ADVANCED_STEPS_PAID_OPTIONAL_BYOK: StepId[] = [
  ...UNIFIED_AUTH_STEPS,
  'welcome',
  'mode',
  'provider',
  'auth',
  'discord',
  'channels',
  'voice',
  'skills',
  'personality',
  'privacy',
  'complete',
];

function getDefaultState(): OnboardingState {
  return {
    mode: null,
    authChoice: null,
    authConfig: null,
    discordEnabled: true,
    discordWebhooksSet: false,
    enabledChannels: [],
    personality: null,
    telemetryEnabled: true,
    psychologyEnabled: true,
  };
}

/**
 * Error fallback component for step errors
 */
function StepErrorFallback({
  error,
  onRetry,
  onSkip,
}: {
  error: Error;
  onRetry: () => void;
  onSkip?: () => void;
}) {
  return (
    <div className="onboarding-step">
      <div className="error-recovery">
        <span className="error-recovery-icon">⚠️</span>
        <h3>Something went wrong</h3>
        <p>We encountered an issue. You can try again or skip this step.</p>
        <div className="error-recovery-actions">
          <button className="secondary-button" onClick={onRetry}>
            Try Again
          </button>
          {onSkip && (
            <button className="text-button" onClick={onSkip}>
              Skip for now
            </button>
          )}
        </div>
        {import.meta.env.DEV && (
          <details style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
            <summary>Error details</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error.message}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

export function Onboarding({ onComplete }: OnboardingProps) {
  // Lazy load gateway - only needed for config persistence, not for basic onboarding
  const { getClient } = useGateway();

  // Load persisted state on mount
  const [currentStepIndex, setCurrentStepIndex] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.currentStepIndex ?? 0;
      }
    } catch {
      // Ignore parse errors
    }
    return 0;
  });

  const [state, setState] = useState<OnboardingState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.state ?? getDefaultState();
      }
    } catch {
      // Ignore parse errors
    }
    return getDefaultState();
  });

  const [stepError, setStepError] = useState<Error | null>(null);

  // Determine which flow we're in based on tier path
  const getSteps = (): StepId[] => {
    if (state.mode === 'advanced') {
      if (state.tierPath === 'free-byok') return ADVANCED_STEPS_FREE;
      if (state.tierPath === 'paid-optional-byok') return ADVANCED_STEPS_PAID_OPTIONAL_BYOK;
      return ADVANCED_STEPS_PAID_CENTRALIZED;
    } else {
      if (state.tierPath === 'free-byok') return QUICKSTART_STEPS_FREE;
      if (state.tierPath === 'paid-optional-byok') return QUICKSTART_STEPS_PAID_OPTIONAL_BYOK;
      return QUICKSTART_STEPS_PAID_CENTRALIZED;
    }
  };

  const steps = getSteps();
  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const progress = ((currentStepIndex + 1) / totalSteps) * 100;

  // Persist state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ currentStepIndex, state }));
    } catch {
      // Storage may be full or disabled
    }
  }, [currentStepIndex, state]);

  const goNext = useCallback(() => {
    setStepError(null);
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStepIndex(nextIndex);
    }
  }, [currentStepIndex, steps.length]);

  const goBack = useCallback(() => {
    setStepError(null);
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStepIndex(prevIndex);
    }
  }, [currentStepIndex]);

  const skipCurrent = useCallback(() => {
    setStepError(null);
    goNext();
  }, [goNext]);

  const updateState = useCallback((updates: Partial<OnboardingState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleModeSelect = useCallback(
    (mode: 'quickstart' | 'advanced') => {
      updateState({ mode });
      goNext();
    },
    [updateState, goNext]
  );

  const handleSupabaseLogin = useCallback(
    (data: { userId: string; email: string; tier: string }) => {
      updateState({
        supabaseUserId: data.userId,
        supabaseEmail: data.email,
        subscriptionTier: data.tier as SubscriptionTier,
      });
      goNext();
    },
    [updateState, goNext]
  );

  const handleTierDetection = useCallback(
    (path: 'free-byok' | 'paid-centralized' | 'paid-optional-byok') => {
      updateState({ tierPath: path });
      goNext();
    },
    [updateState, goNext]
  );

  const handleInstanceRegistration = useCallback(
    (data: InstanceRegistrationData) => {
      updateState({ instanceData: data });
      goNext();
    },
    [updateState, goNext]
  );

  const handleProviderSelect = useCallback(
    (authChoice: AuthChoice) => {
      if (authChoice === 'skip') {
        // Skip authentication for now
        updateState({ authChoice: null });
        // Jump to complete in quickstart, or continue in advanced
        if (state.mode === 'quickstart') {
          const quickstartSteps = getSteps();
          const completeIndex = quickstartSteps.indexOf('complete');
          if (completeIndex >= 0) {
            setCurrentStepIndex(completeIndex);
          } else {
            goNext();
          }
        } else {
          goNext();
        }
      } else {
        updateState({ authChoice });
        goNext();
      }
    },
    [updateState, goNext, state.mode]
  );

  const handleAuthComplete = useCallback(
    async (config: AuthConfig) => {
      updateState({ authConfig: config });

      // Apply auth configuration via gateway RPC
      const client = getClient();
      if (client?.connected) {
        try {
          // Get current config
          const configResult = (await client.request('config.get')) as {
            config: Record<string, unknown>;
            hash?: string;
          };
          const baseHash = configResult.hash;

          // Build config patch based on auth choice
          const patch = buildAuthConfigPatch(config);

          // Apply patch
          await client.request('config.patch', {
            raw: JSON.stringify(patch),
            baseHash,
          });
        } catch (err) {
          console.error('Failed to apply auth config:', err);
          // Continue anyway - user can configure later
        }
      }

      goNext();
    },
    [updateState, goNext, getClient]
  );

  const handleRetry = useCallback(() => {
    setStepError(null);
  }, []);

  const clearProgress = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setCurrentStepIndex(0);
    setState(getDefaultState());
    setStepError(null);
  }, []);

  // Build config patch for auth choice
  function buildAuthConfigPatch(config: AuthConfig): Record<string, unknown> {
    const patch: Record<string, unknown> = {};

    switch (config.authChoice) {
      case 'token':
        // Anthropic setup-token
        patch.agents = {
          defaults: {
            provider: 'anthropic',
            authProfile: 'anthropic-token',
          },
        };
        // Token should be stored securely via keyring
        break;

      case 'apiKey':
        // Anthropic API key
        patch.agents = {
          defaults: {
            provider: 'anthropic',
          },
        };
        break;

      case 'openai-codex':
      case 'openai-api-key':
        patch.agents = {
          defaults: {
            provider: 'openai',
          },
        };
        break;

      case 'gemini-api-key':
      case 'google-antigravity':
      case 'google-gemini-cli':
        patch.agents = {
          defaults: {
            provider: 'google',
          },
        };
        break;

      case 'github-copilot':
      case 'copilot-proxy':
        patch.agents = {
          defaults: {
            provider: 'copilot',
          },
        };
        break;

      // Other providers...
      default:
        patch.agents = {
          defaults: {
            provider: config.authChoice,
          },
        };
    }

    return patch;
  }

  const renderStep = (): React.ReactNode => {
    if (stepError) {
      return <StepErrorFallback error={stepError} onRetry={handleRetry} onSkip={skipCurrent} />;
    }

    switch (currentStep) {
      case 'supabase-login':
        return (
          <SupabaseLoginStep
            onLoginSuccess={handleSupabaseLogin}
            onError={(error) => setStepError(new Error(error))}
          />
        );

      case 'tier-detection':
        if (!state.supabaseUserId || !state.subscriptionTier) {
          // Should not happen - go back to login
          goBack();
          return null;
        }
        return (
          <TierDetectionStep
            userId={state.supabaseUserId}
            email={state.supabaseEmail || ''}
            tier={state.subscriptionTier}
            onByokRequired={() => handleTierDetection('free-byok')}
            onCentralizedSelected={() => handleTierDetection('paid-centralized')}
            onPaidByokSelected={() => handleTierDetection('paid-optional-byok')}
            onError={(error) => setStepError(new Error(error))}
          />
        );

      case 'instance-registration':
        if (!state.supabaseUserId) {
          // Should not happen - go back to login
          goBack();
          return null;
        }
        return (
          <InstanceRegistrationStep
            userId={state.supabaseUserId}
            onRegistrationComplete={handleInstanceRegistration}
            onSkip={goNext}
            onError={(error) => setStepError(new Error(error))}
          />
        );

      case 'welcome':
        return <WelcomeStep onNext={goNext} />;

      case 'mode':
        return <ModeSelectionStep onSelect={handleModeSelect} onBack={goBack} />;

      case 'provider':
        return (
          <ProviderSelectionStep
            mode={state.mode ?? 'quickstart'}
            onSelect={handleProviderSelect}
            onBack={goBack}
            onSkip={state.mode === 'advanced' ? () => handleProviderSelect('skip') : undefined}
          />
        );

      case 'auth':
        if (!state.authChoice) {
          // No auth choice, skip to next
          goNext();
          return null;
        }
        return (
          <AuthConfigStep authChoice={state.authChoice} onComplete={handleAuthComplete} onBack={goBack} />
        );

      case 'discord':
        return (
          <DiscordStep state={state} onUpdate={updateState} onNext={goNext} onBack={goBack} />
        );

      case 'channels':
        return (
          <ChannelsStep
            state={state}
            onUpdate={updateState}
            onNext={goNext}
            onBack={goBack}
            onSkip={skipCurrent}
          />
        );

      case 'voice':
        return (
          <VoiceStep state={state} onUpdate={updateState} onNext={goNext} onBack={goBack} />
        );

      case 'skills':
        return (
          <SkillsStep state={state} onUpdate={updateState} onNext={goNext} onBack={goBack} />
        );

      case 'personality':
        return (
          <PersonalityStep state={state} onUpdate={updateState} onNext={goNext} onBack={goBack} />
        );

      case 'privacy':
        return (
          <PrivacyStep state={state} onUpdate={updateState} onNext={goNext} onBack={goBack} />
        );

      case 'complete':
        return <CompleteStep onComplete={onComplete} />;

      default:
        return null;
    }
  };

  // Expose clearProgress for potential "Start Over" functionality
  void clearProgress;

  return (
    <div className="onboarding">
      <div className="onboarding-progress">
        <div className="onboarding-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      {/* Step indicator */}
      <div className="onboarding-steps-indicator">
        {steps.map((step, index) => (
          <div
            key={step}
            className={`step-dot ${
              index === currentStepIndex ? 'active' : index < currentStepIndex ? 'completed' : ''
            }`}
            title={`Step ${index + 1}: ${step}`}
            aria-label={`Step ${index + 1}: ${step}`}
            aria-current={index === currentStepIndex ? 'step' : undefined}
          />
        ))}
      </div>

      {/* Mode indicator */}
      {state.mode && (
        <div className="onboarding-mode-indicator">
          {state.mode === 'quickstart' ? '⚡ Quick Start' : '⚙️ Advanced Setup'}
        </div>
      )}

      <div className="onboarding-content">
        <ErrorBoundary
          fallback={
            <StepErrorFallback
              error={new Error('An unexpected error occurred')}
              onRetry={handleRetry}
              onSkip={skipCurrent}
            />
          }
        >
          {renderStep()}
        </ErrorBoundary>
      </div>
    </div>
  );
}

// Export for use in useOnboarding hook
export { STORAGE_KEY as ONBOARDING_STORAGE_KEY };

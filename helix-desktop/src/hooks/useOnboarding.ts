import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'helix-onboarding-state';

export interface OnboardingStep {
  id: string;
  name: string;
  required: boolean;
}

export interface OnboardingData {
  apiKeySet: boolean;
  apiProvider: 'anthropic' | 'openai' | 'google' | null;
  apiKey: string;
  discordConfigured: boolean;
  discordWebhookUrl: string;
  channelsConfigured: boolean;
  enabledChannels: string[];
  personalityConfigured: boolean;
  privacyConfigured: boolean;
  accountConnected: boolean;
  firstChatCompleted: boolean;
}

interface OnboardingState {
  currentStep: number;
  completedSteps: number[];
  skippedSteps: number[];
  data: OnboardingData;
  startedAt: string | null;
  completedAt: string | null;
}

const DEFAULT_STEPS: OnboardingStep[] = [
  { id: 'welcome', name: 'Welcome', required: true },
  { id: 'account', name: 'Account', required: false },
  { id: 'apiKey', name: 'API Key', required: true },
  { id: 'discord', name: 'Discord', required: false },
  { id: 'channels', name: 'Channels', required: false },
  { id: 'personality', name: 'Personality', required: true },
  { id: 'privacy', name: 'Privacy', required: true },
  { id: 'firstChat', name: 'First Chat', required: false },
  { id: 'complete', name: 'Complete', required: true },
];

const DEFAULT_STATE: OnboardingState = {
  currentStep: 0,
  completedSteps: [],
  skippedSteps: [],
  data: {
    apiKeySet: false,
    apiProvider: null,
    apiKey: '',
    discordConfigured: false,
    discordWebhookUrl: '',
    channelsConfigured: false,
    enabledChannels: [],
    personalityConfigured: false,
    privacyConfigured: false,
    accountConnected: false,
    firstChatCompleted: false,
  },
  startedAt: null,
  completedAt: null,
};

/**
 * Hook for managing onboarding wizard state
 * Persists state to localStorage for resuming interrupted flows
 */
export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(() => {
    // Load from localStorage on init
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as OnboardingState;
        return parsed;
      }
    } catch {
      // Ignore errors, use default
    }
    return DEFAULT_STATE;
  });

  const steps = DEFAULT_STEPS;
  const totalSteps = steps.length;
  const currentStep = state.currentStep;

  // Persist state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage may be full or disabled
    }
  }, [state]);

  /**
   * Check if onboarding is complete
   */
  const isComplete = state.completedAt !== null;

  /**
   * Check if a specific step is completed
   */
  const isStepCompleted = useCallback(
    (stepIndex: number) => state.completedSteps.includes(stepIndex),
    [state.completedSteps]
  );

  /**
   * Check if a specific step is skipped
   */
  const isStepSkipped = useCallback(
    (stepIndex: number) => state.skippedSteps.includes(stepIndex),
    [state.skippedSteps]
  );

  /**
   * Mark current step as complete and advance
   */
  const completeStep = useCallback(() => {
    setState((prev) => {
      const newCompletedSteps = prev.completedSteps.includes(prev.currentStep)
        ? prev.completedSteps
        : [...prev.completedSteps, prev.currentStep];

      const nextStep = prev.currentStep + 1;
      const isLastStep = nextStep >= totalSteps;

      return {
        ...prev,
        currentStep: isLastStep ? prev.currentStep : nextStep,
        completedSteps: newCompletedSteps,
        completedAt: isLastStep ? new Date().toISOString() : prev.completedAt,
      };
    });
  }, [totalSteps]);

  /**
   * Skip current step and advance
   */
  const skipStep = useCallback(() => {
    setState((prev) => {
      const currentStepData = steps[prev.currentStep];

      // Cannot skip required steps
      if (currentStepData?.required) {
        return prev;
      }

      const newSkippedSteps = prev.skippedSteps.includes(prev.currentStep)
        ? prev.skippedSteps
        : [...prev.skippedSteps, prev.currentStep];

      const nextStep = prev.currentStep + 1;
      const isLastStep = nextStep >= totalSteps;

      return {
        ...prev,
        currentStep: isLastStep ? prev.currentStep : nextStep,
        skippedSteps: newSkippedSteps,
        completedAt: isLastStep ? new Date().toISOString() : prev.completedAt,
      };
    });
  }, [steps, totalSteps]);

  /**
   * Go to a specific step
   */
  const goToStep = useCallback(
    (stepIndex: number) => {
      if (stepIndex >= 0 && stepIndex < totalSteps) {
        setState((prev) => ({
          ...prev,
          currentStep: stepIndex,
        }));
      }
    },
    [totalSteps]
  );

  /**
   * Go to previous step
   */
  const previousStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(0, prev.currentStep - 1),
    }));
  }, []);

  /**
   * Go to next step
   */
  const nextStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.min(totalSteps - 1, prev.currentStep + 1),
    }));
  }, [totalSteps]);

  /**
   * Update onboarding data
   */
  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setState((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        ...updates,
      },
    }));
  }, []);

  /**
   * Start the onboarding flow
   */
  const startOnboarding = useCallback(() => {
    setState((prev) => ({
      ...prev,
      startedAt: prev.startedAt ?? new Date().toISOString(),
      currentStep: 0,
    }));
  }, []);

  /**
   * Reset onboarding to start
   */
  const resetOnboarding = useCallback(() => {
    setState(DEFAULT_STATE);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  /**
   * Clear partial progress without full reset
   * Useful for retrying from current step
   */
  const clearProgress = useCallback(() => {
    setState(DEFAULT_STATE);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  /**
   * Mark onboarding as complete
   */
  const finishOnboarding = useCallback(() => {
    setState((prev) => ({
      ...prev,
      completedAt: new Date().toISOString(),
    }));
  }, []);

  /**
   * Get progress percentage
   */
  const progressPercentage = Math.round(
    ((state.completedSteps.length + state.skippedSteps.length) / totalSteps) * 100
  );

  /**
   * Get current step data
   */
  const currentStepData = steps[currentStep] ?? null;

  /**
   * Check if current step can be skipped
   */
  const canSkipCurrentStep = currentStepData ? !currentStepData.required : false;

  return {
    // State
    currentStep,
    totalSteps,
    steps,
    completedSteps: new Set(state.completedSteps),
    skippedSteps: new Set(state.skippedSteps),
    data: state.data,
    isComplete,
    progressPercentage,
    currentStepData,
    canSkipCurrentStep,
    startedAt: state.startedAt,
    completedAt: state.completedAt,

    // Actions
    completeStep,
    skipStep,
    goToStep,
    previousStep,
    nextStep,
    updateData,
    startOnboarding,
    resetOnboarding,
    finishOnboarding,
    clearProgress,

    // Helpers
    isStepCompleted,
    isStepSkipped,
  };
}

export type { OnboardingState };

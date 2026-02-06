import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import clsx from 'clsx';

import { WelcomeStep } from './steps/WelcomeStep';
import { PlatformInstaller } from './steps/PlatformInstaller';
import { SuccessStep } from './steps/SuccessStep';

export interface OnboardingData {
  cliInstalled: boolean;
  connectionVerified: boolean;
}

const STORAGE_KEY = 'helix_onboarding_progress';

const STEPS = [
  { id: 'welcome', title: 'Welcome', description: 'Understand Helix architecture' },
  { id: 'install-cli', title: 'Install CLI', description: 'Get Helix running locally' },
  { id: 'success', title: 'Complete', description: 'Start using Helix' },
] as const;

export function OnboardingWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Ignore parse errors
      }
    }
    return {
      cliInstalled: false,
      connectionVerified: false,
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }));
  }, []);

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 0: // Welcome
        return true;
      case 1: // Install CLI
        return data.cliInstalled;
      case 2: // Success
        return true;
      default:
        return false;
    }
  }, [currentStep, data]);

  const nextStep = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const skipOnboarding = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  const completeOnboarding = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem('helix_onboarding_complete', 'true');
    navigate('/dashboard');
  }, [navigate]);

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <WelcomeStep />;
      case 1:
        return <PlatformInstaller data={data} updateData={updateData} />;
      case 2:
        return <SuccessStep onComplete={completeOnboarding} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg-primary/95 backdrop-blur-sm overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="gradient-orb gradient-orb-purple w-[600px] h-[600px] -top-60 -left-60 opacity-20" />
        <div className="gradient-orb gradient-orb-blue w-[500px] h-[500px] -bottom-40 -right-40 opacity-20" />
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-4xl mx-auto px-4 py-6 sm:py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-3">
              <img src="/logos/helix-icon.svg" alt="Helix" className="h-8 w-8" />
              <span className="text-xl font-display font-bold text-white">Helix Setup</span>
            </div>
            <button
              onClick={skipOnboarding}
              className="flex items-center gap-2 text-sm text-text-tertiary hover:text-text-secondary transition-colors"
            >
              Skip for now
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center justify-between mb-2">
              {STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className={clsx(
                    'flex items-center',
                    index < STEPS.length - 1 && 'flex-1'
                  )}
                >
                  <div
                    className={clsx(
                      'relative flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full border-2 transition-all duration-300',
                      index < currentStep
                        ? 'border-success bg-success/20 text-success'
                        : index === currentStep
                          ? 'border-helix-500 bg-helix-500/20 text-helix-400'
                          : 'border-white/20 bg-bg-tertiary text-text-tertiary'
                    )}
                  >
                    {index < currentStep ? (
                      <Check className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <span className="text-xs sm:text-sm font-medium">{index + 1}</span>
                    )}
                  </div>

                  {index < STEPS.length - 1 && (
                    <div className="flex-1 mx-1 sm:mx-2">
                      <div
                        className={clsx(
                          'h-1 rounded-full transition-all duration-300',
                          index < currentStep ? 'bg-success' : 'bg-white/10'
                        )}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden sm:flex items-center justify-between">
              {STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className={clsx(
                    'text-center transition-colors',
                    index === currentStep ? 'text-white' : 'text-text-tertiary'
                  )}
                  style={{ width: `${100 / STEPS.length}%` }}
                >
                  <p className="text-xs font-medium truncate">{step.title}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Step content */}
          <div className="card-glass p-4 sm:p-8">
            {renderStep()}
          </div>
        </div>
      </div>

      {/* Sticky navigation buttons at the bottom */}
      {currentStep < STEPS.length - 1 && (
        <div className="shrink-0 border-t border-white/10 bg-bg-primary/90 backdrop-blur-sm">
          <div className="w-full max-w-4xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                currentStep === 0
                  ? 'text-text-tertiary cursor-not-allowed'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              )}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>

            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className={clsx(
                'btn btn-primary flex items-center gap-2',
                !canProceed() && 'opacity-50 cursor-not-allowed'
              )}
            >
              {currentStep === STEPS.length - 2 ? 'Finish' : 'Continue'}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

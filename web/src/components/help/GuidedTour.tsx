import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import clsx from 'clsx';

export interface TourStep {
  /** Unique identifier for this step */
  id: string;
  /** CSS selector for the target element to highlight */
  target?: string;
  /** Title of the tour step */
  title: string;
  /** Description/content of the tour step */
  content: string;
  /** Position of the tooltip relative to target */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Optional action button text */
  actionText?: string;
  /** Optional action callback */
  onAction?: () => void;
}

interface GuidedTourProps {
  /** Tour steps to display */
  steps: TourStep[];
  /** Storage key for tracking tour completion */
  storageKey?: string;
  /** Callback when tour is completed */
  onComplete?: () => void;
  /** Callback when tour is skipped */
  onSkip?: () => void;
  /** Whether to show tour (overrides storage) */
  forceShow?: boolean;
}

const POSITION_CLASSES = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-4',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-4',
  left: 'right-full top-1/2 -translate-y-1/2 mr-4',
  right: 'left-full top-1/2 -translate-y-1/2 ml-4',
  center: 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
};

export function GuidedTour({
  steps,
  storageKey = 'helix_tour_completed',
  onComplete,
  onSkip,
  forceShow = false,
}: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // Check if tour should be shown
  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
      return;
    }

    const completed = localStorage.getItem(storageKey);
    if (!completed) {
      setIsVisible(true);
    }
  }, [forceShow, storageKey]);

  // Update target element position
  useEffect(() => {
    if (!isVisible) return;

    const step = steps[currentStep];
    if (!step?.target) {
      setTargetRect(null);
      return;
    }

    const updateTargetRect = () => {
      const element = document.querySelector(step.target!);
      if (element) {
        setTargetRect(element.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    updateTargetRect();

    // Update on resize/scroll
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);

    return () => {
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [isVisible, currentStep, steps]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Complete tour
      localStorage.setItem(storageKey, 'true');
      setIsVisible(false);
      onComplete?.();
    }
  }, [currentStep, steps.length, storageKey, onComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(storageKey, 'skipped');
    setIsVisible(false);
    onSkip?.();
  }, [storageKey, onSkip]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    },
    [handleSkip, handleNext, handlePrev]
  );

  useEffect(() => {
    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isVisible, handleKeyDown]);

  if (!isVisible || steps.length === 0) {
    return null;
  }

  const step = steps[currentStep];
  const position = step.position || 'bottom';
  const isLastStep = currentStep === steps.length - 1;
  const isCentered = position === 'center' || !targetRect;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Spotlight on target element */}
      {targetRect && !isCentered && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
            borderRadius: '12px',
          }}
        />
      )}

      {/* Tour tooltip */}
      <div
        className={clsx(
          'z-[60] w-80 max-w-[90vw]',
          isCentered ? 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : 'absolute',
          !isCentered && POSITION_CLASSES[position]
        )}
        style={
          !isCentered && targetRect
            ? {
                top:
                  position === 'bottom'
                    ? targetRect.bottom + 16
                    : position === 'top'
                      ? targetRect.top - 16
                      : targetRect.top + targetRect.height / 2,
                left:
                  position === 'right'
                    ? targetRect.right + 16
                    : position === 'left'
                      ? targetRect.left - 16
                      : targetRect.left + targetRect.width / 2,
                transform:
                  position === 'top'
                    ? 'translate(-50%, -100%)'
                    : position === 'bottom'
                      ? 'translate(-50%, 0)'
                      : position === 'left'
                        ? 'translate(-100%, -50%)'
                        : 'translate(0, -50%)',
              }
            : undefined
        }
      >
        <div className="rounded-2xl border border-helix-500/30 bg-bg-secondary shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-helix-500/10">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-helix-400" />
              <span className="text-sm font-medium text-helix-400">
                Step {currentStep + 1} of {steps.length}
              </span>
            </div>
            <button
              onClick={handleSkip}
              className="text-text-tertiary hover:text-white transition-colors"
              aria-label="Skip tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="text-lg font-display font-semibold text-white mb-2">
              {step.title}
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              {step.content}
            </p>

            {/* Action button (optional) */}
            {step.actionText && step.onAction && (
              <button
                onClick={step.onAction}
                className="mt-3 text-sm text-helix-400 hover:text-helix-300 transition-colors"
              >
                {step.actionText} →
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-bg-tertiary/50">
            {/* Progress dots */}
            <div className="flex items-center gap-1.5">
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={clsx(
                    'h-2 w-2 rounded-full transition-all',
                    index === currentStep
                      ? 'bg-helix-500 w-4'
                      : index < currentStep
                        ? 'bg-helix-500/50'
                        : 'bg-white/20'
                  )}
                  aria-label={`Go to step ${index + 1}`}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handlePrev}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-text-secondary hover:text-white transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="btn btn-primary btn-sm flex items-center gap-1"
              >
                {isLastStep ? 'Finish' : 'Next'}
                {!isLastStep && <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Hook to manage tour state
 */
export function useTour(storageKey: string) {
  const [hasCompleted, setHasCompleted] = useState(true);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    const status = localStorage.getItem(storageKey);
    setHasCompleted(!!status);
    setShowTour(!status);
  }, [storageKey]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(storageKey);
    setHasCompleted(false);
    setShowTour(true);
  }, [storageKey]);

  const completeTour = useCallback(() => {
    localStorage.setItem(storageKey, 'true');
    setHasCompleted(true);
    setShowTour(false);
  }, [storageKey]);

  return {
    hasCompleted,
    showTour,
    setShowTour,
    resetTour,
    completeTour,
  };
}

/**
 * Pre-defined tour for the Dashboard
 */
export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Helix Observatory',
    content:
      'This is your command center for monitoring and controlling your Helix AI. Let\'s take a quick tour!',
    position: 'center',
  },
  {
    id: 'sidebar',
    target: '[data-tour="sidebar"]',
    title: 'Navigation',
    content:
      'Use the sidebar to navigate between different sections: Dashboard, Code, Settings, and more.',
    position: 'right',
  },
  {
    id: 'status',
    target: '[data-tour="status-indicator"]',
    title: 'Connection Status',
    content:
      'This indicator shows whether your local Helix is connected. Green means connected, red means disconnected.',
    position: 'bottom',
  },
  {
    id: 'chat',
    target: '[data-tour="chat-input"]',
    title: 'Chat with Helix',
    content:
      'Use the chat interface to interact with your AI. Ask questions, give commands, or just have a conversation.',
    position: 'top',
  },
  {
    id: 'logs',
    target: '[data-tour="activity-logs"]',
    title: 'Activity Logs',
    content:
      'All Helix actions are logged here. You can see what your AI is doing and audit its behavior.',
    position: 'left',
  },
  {
    id: 'complete',
    title: 'You\'re Ready!',
    content:
      'That\'s the basics! Explore around and don\'t hesitate to check the docs if you need help. Happy exploring!',
    position: 'center',
  },
];

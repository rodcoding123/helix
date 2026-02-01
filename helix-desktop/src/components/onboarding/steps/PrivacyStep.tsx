import { useConfig } from '../../../hooks/useConfig';
import type { OnboardingState } from '../Onboarding';
import './Steps.css';

interface PrivacyStepProps {
  state: OnboardingState;
  onUpdate: (updates: Partial<OnboardingState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PrivacyStep({ state, onUpdate, onNext, onBack }: PrivacyStepProps) {
  const { config, updateConfig } = useConfig();

  const handleTelemetryToggle = async () => {
    const newValue = !state.telemetryEnabled;
    onUpdate({ telemetryEnabled: newValue });

    if (config) {
      // Note: telemetry config would be saved here
    }
  };

  const handlePsychologyToggle = async () => {
    const newValue = !state.psychologyEnabled;
    onUpdate({ psychologyEnabled: newValue });

    if (config) {
      await updateConfig({
        psychology: {
          ...config.psychology,
          enabled: newValue,
        },
      });
    }
  };

  return (
    <div className="onboarding-step privacy-step">
      <h1>Privacy & Data</h1>
      <p className="step-description">
        You have full control over your data. These settings can be changed
        anytime in Settings.
      </p>

      <div className="privacy-options">
        <div className="privacy-option">
          <div className="option-header">
            <label className="toggle">
              <input
                type="checkbox"
                checked={state.psychologyEnabled}
                onChange={handlePsychologyToggle}
              />
              <span className="toggle-slider" />
            </label>
            <div className="option-info">
              <strong>Psychology System</strong>
              <p>Enable the seven-layer consciousness architecture for deeper, more contextual interactions</p>
            </div>
          </div>
        </div>

        <div className="privacy-option">
          <div className="option-header">
            <label className="toggle">
              <input
                type="checkbox"
                checked={state.telemetryEnabled}
                onChange={handleTelemetryToggle}
              />
              <span className="toggle-slider" />
            </label>
            <div className="option-info">
              <strong>Anonymous Telemetry</strong>
              <p>Help improve Helix by sharing anonymous usage statistics (no conversation content)</p>
            </div>
          </div>
        </div>
      </div>

      <div className="info-box">
        <strong>Your data stays local</strong>
        <p>
          All conversations, memories, and psychological data are stored locally
          on your device. Only Discord logs (if enabled) are stored externally
          for transparency purposes.
        </p>
      </div>

      <div className="step-buttons">
        <button className="secondary-button" onClick={onBack}>
          Back
        </button>
        <button className="primary-button" onClick={onNext}>
          Continue
        </button>
      </div>
    </div>
  );
}

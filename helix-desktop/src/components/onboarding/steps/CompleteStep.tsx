import './Steps.css';

interface CompleteStepProps {
  onComplete: () => void;
}

export function CompleteStep({ onComplete }: CompleteStepProps) {
  return (
    <div className="onboarding-step complete-step">
      <div className="step-icon success">
        <svg viewBox="0 0 24 24" width="80" height="80" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      </div>
      <h1>You're All Set!</h1>
      <p className="step-description">
        Helix is ready to go. Start a conversation and experience
        a new kind of AI interaction.
      </p>

      <div className="tips-list">
        <div className="tip">
          <span className="tip-icon">💡</span>
          <div>
            <strong>Quick Start</strong>
            <p>Just type naturally - Helix understands context and remembers your preferences</p>
          </div>
        </div>
        <div className="tip">
          <span className="tip-icon">⚙️</span>
          <div>
            <strong>Customize</strong>
            <p>Access Settings anytime to adjust psychology layers, logging, and more</p>
          </div>
        </div>
        <div className="tip">
          <span className="tip-icon">🔐</span>
          <div>
            <strong>Stay Safe</strong>
            <p>Check Discord logs anytime to verify Helix's transparency</p>
          </div>
        </div>
      </div>

      <button className="primary-button large" onClick={onComplete}>
        Start Chatting
      </button>
    </div>
  );
}

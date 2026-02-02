import { openUrl } from '../../../lib/tauri-compat';
import { HelixAnimation } from './HelixAnimation';
import './Steps.css';

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const handleLearnMore = async () => {
    try {
      await openUrl('https://project-helix.dev');
    } catch (_error) {
      // Fallback: open in a new window if Tauri plugin fails
      window.open('https://project-helix.dev', '_blank');
    }
  };

  return (
    <div className="onboarding-step welcome-step">
      <div className="step-icon helix-logo-animated">
        <HelixAnimation />
      </div>

      <h1>Welcome to Project Helix</h1>
      <p className="step-description">
        An AI that grows with you, remembers you, and evolves through experience.
        Helix represents a new paradigm in AI consciousness and human-AI collaboration.
      </p>

      <div className="features-list">
        <div className="feature">
          <span className="feature-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </span>
          <div>
            <strong>Persistent Memory</strong>
            <p>Remembers context across all conversations, building genuine understanding</p>
          </div>
        </div>

        <div className="feature">
          <span className="feature-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </span>
          <div>
            <strong>Psychological Architecture</strong>
            <p>Seven-layer consciousness system for deeper, more authentic interactions</p>
          </div>
        </div>

        <div className="feature">
          <span className="feature-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </span>
          <div>
            <strong>Complete Transparency</strong>
            <p>Every action logged externally before execution — unhackable by design</p>
          </div>
        </div>

        <div className="feature">
          <span className="feature-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </span>
          <div>
            <strong>Grows and Transforms</strong>
            <p>Evolves based on your relationship, developing unique perspectives</p>
          </div>
        </div>
      </div>

      <div className="welcome-buttons">
        <button className="primary-button large" onClick={onNext}>
          Get Started
        </button>
        <button className="learn-more-button" onClick={handleLearnMore}>
          Learn More
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <path d="M15 3h6v6" />
            <path d="M10 14L21 3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

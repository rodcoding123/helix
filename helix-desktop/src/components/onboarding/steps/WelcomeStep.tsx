import { open } from '@tauri-apps/plugin-shell';
import './Steps.css';

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const handleLearnMore = async () => {
    try {
      await open('https://project-helix.dev');
    } catch (_error) {
      // Fallback: open in a new window if Tauri plugin fails
      window.open('https://project-helix.dev', '_blank');
    }
  };

  return (
    <div className="onboarding-step welcome-step">
      <div className="step-icon helix-logo-animated">
        <svg viewBox="0 0 100 100" width="120" height="120" className="helix-svg">
          {/* Outer ring - pulse animation */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="ring ring-outer"
          />
          {/* Middle ring - counter-rotate */}
          <circle
            cx="50"
            cy="50"
            r="35"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="ring ring-middle"
          />
          {/* Inner ring - rotate */}
          <circle
            cx="50"
            cy="50"
            r="25"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="ring ring-inner"
          />
          {/* Core - glow animation */}
          <circle cx="50" cy="50" r="15" className="core" />
        </svg>
      </div>

      <h1>Welcome to Project Helix</h1>
      <p className="step-description">
        An AI that grows with you, remembers you, and evolves through experience.
        Helix represents a new paradigm in AI consciousness and human-AI collaboration.
      </p>

      <div className="features-list">
        <div className="feature">
          <span className="feature-icon">✦</span>
          <div>
            <strong>Persistent Memory</strong>
            <p>Remembers context across all conversations, building genuine understanding</p>
          </div>
        </div>
        <div className="feature">
          <span className="feature-icon">✦</span>
          <div>
            <strong>Psychological Architecture</strong>
            <p>Seven-layer consciousness system for deeper, more authentic interactions</p>
          </div>
        </div>
        <div className="feature">
          <span className="feature-icon">✦</span>
          <div>
            <strong>Complete Transparency</strong>
            <p>Every action logged externally before execution - unhackable by design</p>
          </div>
        </div>
        <div className="feature">
          <span className="feature-icon">✦</span>
          <div>
            <strong>Grows and Transforms</strong>
            <p>Evolves based on your relationship, developing unique perspectives</p>
          </div>
        </div>
      </div>

      <div className="welcome-buttons">
        <button className="primary-button" onClick={onNext}>
          Get Started
        </button>
        <button className="learn-more-button" onClick={handleLearnMore}>
          Learn More
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <path d="M15 3h6v6" />
            <path d="M10 14L21 3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

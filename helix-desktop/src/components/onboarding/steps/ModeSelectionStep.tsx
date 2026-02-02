/**
 * Mode Selection Step - Quick Start vs Advanced
 * First step after welcome to determine the onboarding flow
 */

import { useState } from 'react';
import './ModeSelectionStep.css';

interface ModeSelectionStepProps {
  onSelect: (mode: 'quickstart' | 'advanced') => void;
  onBack: () => void;
}

export function ModeSelectionStep({ onSelect, onBack }: ModeSelectionStepProps) {
  const [selected, setSelected] = useState<'quickstart' | 'advanced' | null>(null);

  const handleContinue = () => {
    if (selected) {
      onSelect(selected);
    }
  };

  return (
    <div className="mode-selection-step">
      <h2>How would you like to set up Helix?</h2>
      <p className="step-description">
        Choose your setup experience. You can always access advanced settings later.
      </p>

      <div className="mode-options">
        <button
          type="button"
          className={`mode-option ${selected === 'quickstart' ? 'selected' : ''}`}
          onClick={() => setSelected('quickstart')}
        >
          <div className="mode-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div className="mode-content">
            <h3>Quick Start</h3>
            <p>
              Get started in under a minute. Pick your AI provider, authenticate,
              and start chatting. Perfect for most users.
            </p>
            <ul className="mode-features">
              <li>Choose from 14 AI providers</li>
              <li>OAuth login or API key</li>
              <li>Default settings optimized for you</li>
              <li>Configure more later via Settings</li>
            </ul>
          </div>
          <div className="mode-badge recommended">Recommended</div>
        </button>

        <button
          type="button"
          className={`mode-option ${selected === 'advanced' ? 'selected' : ''}`}
          onClick={() => setSelected('advanced')}
        >
          <div className="mode-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <div className="mode-content">
            <h3>Advanced Setup</h3>
            <p>
              Full control over every setting. Configure gateway, channels,
              skills, and more. For power users and developers.
            </p>
            <ul className="mode-features">
              <li>All Quick Start features</li>
              <li>Gateway network configuration</li>
              <li>Channel integrations (Discord, Telegram, WhatsApp...)</li>
              <li>Skills and hooks setup</li>
              <li>Tailscale exposure options</li>
            </ul>
          </div>
          <div className="mode-badge">Power User</div>
        </button>
      </div>

      <div className="step-actions">
        <button type="button" className="btn-secondary" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleContinue}
          disabled={!selected}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

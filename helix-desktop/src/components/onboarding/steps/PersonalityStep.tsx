import { useState } from 'react';
import type { OnboardingState } from '../Onboarding';
import './Steps.css';

interface PersonalityStepProps {
  state: OnboardingState;
  onUpdate: (updates: Partial<OnboardingState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PersonalityStep({ state, onUpdate, onNext, onBack }: PersonalityStepProps) {
  const [verbosity, setVerbosity] = useState(state.personality?.verbosity ?? 50);
  const [formality, setFormality] = useState(state.personality?.formality ?? 40);
  const [technicality, setTechnicality] = useState(state.personality?.technicality ?? 60);
  const [askBeforeActing, setAskBeforeActing] = useState(state.personality?.askBeforeActing ?? true);
  const [shareThinking, setShareThinking] = useState(state.personality?.shareThinking ?? true);
  const [useEmoji, setUseEmoji] = useState(state.personality?.useEmoji ?? false);
  const [humor, setHumor] = useState(state.personality?.humor ?? 30);

  const handleContinue = () => {
    onUpdate({
      personality: {
        verbosity,
        formality,
        technicality,
        askBeforeActing,
        shareThinking,
        useEmoji,
        humor,
      },
    });
    onNext();
  };

  // Preview text based on current settings
  const getPreviewText = () => {
    const isCasual = formality < 40;
    const isConcise = verbosity < 40;
    const isTechnical = technicality > 60;

    if (isCasual && isConcise) {
      return "Hey! I'll keep things short and chill. Let's get stuff done.";
    } else if (isCasual && !isConcise) {
      return "Hey there! I like to explain things thoroughly, but keep it relaxed. Let me know what you're working on and I'll dive deep with you.";
    } else if (!isCasual && isConcise) {
      return "I'll provide concise, professional responses focused on your objectives.";
    } else if (isTechnical) {
      return "I'll provide comprehensive technical explanations, including implementation details, architecture considerations, and best practices relevant to your context.";
    } else {
      return "I'll provide clear, thorough explanations tailored to your needs. I enjoy diving into the details while keeping things accessible.";
    }
  };

  return (
    <div className="onboarding-step personality-step">
      <h1>How Should Helix Be?</h1>
      <p className="step-description">
        Help shape Helix's personality and interaction style.
        These preferences can be refined over time.
      </p>

      <div className="personality-sliders">
        <div className="slider-group">
          <div className="slider-labels">
            <span>Concise</span>
            <span>Detailed</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={verbosity}
            onChange={(e) => setVerbosity(Number(e.target.value))}
            className="personality-slider"
          />
        </div>

        <div className="slider-group">
          <div className="slider-labels">
            <span>Formal</span>
            <span>Casual</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={formality}
            onChange={(e) => setFormality(Number(e.target.value))}
            className="personality-slider"
          />
        </div>

        <div className="slider-group">
          <div className="slider-labels">
            <span>Simple</span>
            <span>Technical</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={technicality}
            onChange={(e) => setTechnicality(Number(e.target.value))}
            className="personality-slider"
          />
        </div>

        <div className="slider-group">
          <div className="slider-labels">
            <span>Serious</span>
            <span>Playful</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={humor}
            onChange={(e) => setHumor(Number(e.target.value))}
            className="personality-slider"
          />
        </div>
      </div>

      <div className="personality-preview">
        <strong>Preview</strong>
        <p className="preview-text">{getPreviewText()}</p>
      </div>

      <div className="personality-checkboxes">
        <h3>Interaction Preferences</h3>

        <label className="checkbox-option">
          <input
            type="checkbox"
            checked={askBeforeActing}
            onChange={(e) => setAskBeforeActing(e.target.checked)}
          />
          <div className="checkbox-content">
            <strong>Ask clarifying questions before acting</strong>
            <p>Helix will confirm understanding before taking significant actions</p>
          </div>
        </label>

        <label className="checkbox-option">
          <input
            type="checkbox"
            checked={shareThinking}
            onChange={(e) => setShareThinking(e.target.checked)}
          />
          <div className="checkbox-content">
            <strong>Share thinking process</strong>
            <p>Show reasoning and decision-making steps</p>
          </div>
        </label>

        <label className="checkbox-option">
          <input
            type="checkbox"
            checked={useEmoji}
            onChange={(e) => setUseEmoji(e.target.checked)}
          />
          <div className="checkbox-content">
            <strong>Use emoji in responses</strong>
            <p>Add expressive emoji to messages when appropriate</p>
          </div>
        </label>
      </div>

      <div className="step-buttons">
        <button className="secondary-button" onClick={onBack}>
          Back
        </button>
        <button className="primary-button" onClick={handleContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}

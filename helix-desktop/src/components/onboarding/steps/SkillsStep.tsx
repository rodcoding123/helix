/**
 * Skills Step - Enable agent skills and capabilities
 * Skills extend Helix's abilities with specialized tools
 */

import { useState, useCallback } from 'react';
import type { OnboardingState } from '../Onboarding';
import './SkillsStep.css';

interface SkillsStepProps {
  state: OnboardingState;
  onUpdate: (updates: Partial<OnboardingState>) => void;
  onNext: () => void;
  onBack: () => void;
}

type SkillCategory = 'productivity' | 'communication' | 'development' | 'media' | 'automation';

interface SkillConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: SkillCategory;
  features: string[];
  requiresSetup?: boolean;
  setupHint?: string;
  popular?: boolean;
  builtin?: boolean;
}

const SKILLS: SkillConfig[] = [
  // === PRODUCTIVITY ===
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '📧',
    description: 'Read, compose, and manage emails with AI assistance',
    category: 'productivity',
    features: ['Read inbox', 'Compose emails', 'Search', 'Labels'],
    requiresSetup: true,
    setupHint: 'Requires Google OAuth authentication',
    popular: true,
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    icon: '📅',
    description: 'Manage events, schedule meetings, check availability',
    category: 'productivity',
    features: ['View events', 'Create events', 'RSVP', 'Reminders'],
    requiresSetup: true,
    setupHint: 'Requires Google OAuth authentication',
  },
  {
    id: 'notion',
    name: 'Notion',
    icon: '📝',
    description: 'Create and manage Notion pages and databases',
    category: 'productivity',
    features: ['Pages', 'Databases', 'Blocks', 'Search'],
    requiresSetup: true,
    setupHint: 'Requires Notion integration token',
  },
  {
    id: 'linear',
    name: 'Linear',
    icon: '📋',
    description: 'Manage issues, projects, and workflows in Linear',
    category: 'productivity',
    features: ['Issues', 'Projects', 'Cycles', 'Comments'],
    requiresSetup: true,
    setupHint: 'Requires Linear API key',
  },

  // === COMMUNICATION ===
  {
    id: 'voice-wake',
    name: 'Voice Wake',
    icon: '🎤',
    description: 'Activate Helix with voice commands and wake words',
    category: 'communication',
    features: ['Wake words', 'Voice commands', 'Hands-free'],
    builtin: true,
  },
  {
    id: 'tts',
    name: 'Text-to-Speech',
    icon: '🔊',
    description: 'Speak responses using AI voices',
    category: 'communication',
    features: ['ElevenLabs', 'OpenAI TTS', 'Edge TTS'],
    builtin: true,
  },
  {
    id: 'translation',
    name: 'Translation',
    icon: '🌍',
    description: 'Translate messages between languages automatically',
    category: 'communication',
    features: ['100+ languages', 'Auto-detect', 'Inline'],
    builtin: true,
  },

  // === DEVELOPMENT ===
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    description: 'Manage repos, issues, PRs, and code reviews',
    category: 'development',
    features: ['Issues', 'PRs', 'Code', 'Actions'],
    requiresSetup: true,
    setupHint: 'Requires GitHub personal access token',
    popular: true,
  },
  {
    id: 'browser',
    name: 'Browser Automation',
    icon: '🌐',
    description: 'Control web browsers, take screenshots, fill forms',
    category: 'development',
    features: ['Navigate', 'Screenshot', 'Click', 'Type'],
    builtin: true,
  },
  {
    id: 'exec',
    name: 'Shell Commands',
    icon: '💻',
    description: 'Execute terminal commands and scripts',
    category: 'development',
    features: ['Bash', 'PowerShell', 'Scripts', 'Background'],
    builtin: true,
  },
  {
    id: 'code',
    name: 'Code Analysis',
    icon: '🔍',
    description: 'Analyze, refactor, and explain code',
    category: 'development',
    features: ['Syntax', 'Refactor', 'Explain', 'Debug'],
    builtin: true,
  },

  // === MEDIA ===
  {
    id: 'image-gen',
    name: 'Image Generation',
    icon: '🎨',
    description: 'Generate images with DALL-E, Midjourney, or Stable Diffusion',
    category: 'media',
    features: ['DALL-E 3', 'Prompts', 'Variations'],
    requiresSetup: true,
    setupHint: 'Uses OpenAI API for DALL-E',
  },
  {
    id: 'image-understanding',
    name: 'Image Understanding',
    icon: '👁️',
    description: 'Analyze and describe images, extract text (OCR)',
    category: 'media',
    features: ['Vision', 'OCR', 'Analysis'],
    builtin: true,
  },
  {
    id: 'link-preview',
    name: 'Link Preview',
    icon: '🔗',
    description: 'Fetch and summarize web pages and articles',
    category: 'media',
    features: ['Summarize', 'Extract', 'Preview'],
    builtin: true,
  },

  // === AUTOMATION ===
  {
    id: 'cron',
    name: 'Scheduled Tasks',
    icon: '⏰',
    description: 'Run automated tasks on a schedule',
    category: 'automation',
    features: ['Cron syntax', 'Recurring', 'One-time'],
    builtin: true,
    popular: true,
  },
  {
    id: 'webhooks',
    name: 'Webhooks',
    icon: '🪝',
    description: 'Trigger actions from external services',
    category: 'automation',
    features: ['HTTP', 'Events', 'Integrations'],
    builtin: true,
  },
  {
    id: 'memory',
    name: 'Long-term Memory',
    icon: '🧠',
    description: 'Remember conversations and context over time',
    category: 'automation',
    features: ['Vector search', 'Context', 'Recall'],
    builtin: true,
  },
  {
    id: 'auto-reply',
    name: 'Auto-Reply Rules',
    icon: '⚡',
    description: 'Automatically respond based on patterns and triggers',
    category: 'automation',
    features: ['Patterns', 'Conditions', 'Actions'],
    builtin: true,
  },
];

const SKILL_CATEGORIES: { id: SkillCategory; label: string; icon: string }[] = [
  { id: 'productivity', label: 'Productivity', icon: '📊' },
  { id: 'communication', label: 'Communication', icon: '💬' },
  { id: 'development', label: 'Development', icon: '💻' },
  { id: 'media', label: 'Media', icon: '🎬' },
  { id: 'automation', label: 'Automation', icon: '⚙️' },
];

export function SkillsStep({ state, onUpdate, onNext, onBack }: SkillsStepProps) {
  const [enabledSkills, setEnabledSkills] = useState<Set<string>>(
    new Set((state as { enabledSkills?: string[] }).enabledSkills || [])
  );
  const [activeCategory, setActiveCategory] = useState<SkillCategory>('productivity');

  const toggleSkill = useCallback((skillId: string) => {
    setEnabledSkills(prev => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
  }, []);

  const handleContinue = () => {
    onUpdate({ enabledSkills: Array.from(enabledSkills) } as Partial<OnboardingState>);
    onNext();
  };

  const enableAllBuiltin = () => {
    const builtinSkills = SKILLS.filter(s => s.builtin).map(s => s.id);
    setEnabledSkills(prev => new Set([...prev, ...builtinSkills]));
  };

  const getSkillsByCategory = (category: SkillCategory) => {
    return SKILLS.filter(s => s.category === category);
  };

  const popularSkills = SKILLS.filter(s => s.popular);
  const builtinCount = SKILLS.filter(s => s.builtin && enabledSkills.has(s.id)).length;
  const totalBuiltin = SKILLS.filter(s => s.builtin).length;

  return (
    <div className="onboarding-step skills-step">
      <h1>Enable Skills</h1>
      <p className="step-description">
        Skills extend Helix's capabilities. Built-in skills are ready to use,
        while others require additional setup.
      </p>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button
          className={`quick-action ${builtinCount === totalBuiltin ? 'active' : ''}`}
          onClick={enableAllBuiltin}
        >
          <span>⚡</span>
          Enable All Built-in ({totalBuiltin})
        </button>
      </div>

      {/* Popular Skills */}
      <div className="popular-section">
        <h3>Popular Skills</h3>
        <div className="popular-grid">
          {popularSkills.map(skill => (
            <button
              key={skill.id}
              className={`skill-card popular ${enabledSkills.has(skill.id) ? 'enabled' : ''}`}
              onClick={() => toggleSkill(skill.id)}
            >
              <div className="skill-header">
                <span className="skill-icon">{skill.icon}</span>
                <span className="skill-name">{skill.name}</span>
                {skill.requiresSetup && <span className="setup-badge">Setup</span>}
              </div>
              <p className="skill-description">{skill.description}</p>
              <div className="skill-toggle">
                <span className={`toggle ${enabledSkills.has(skill.id) ? 'on' : 'off'}`}>
                  {enabledSkills.has(skill.id) ? '✓' : ''}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="category-tabs">
        {SKILL_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`category-tab ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            <span className="tab-icon">{cat.icon}</span>
            <span className="tab-label">{cat.label}</span>
            <span className="tab-count">
              {getSkillsByCategory(cat.id).filter(s => enabledSkills.has(s.id)).length}
            </span>
          </button>
        ))}
      </div>

      {/* Skills Grid */}
      <div className="skills-grid">
        {getSkillsByCategory(activeCategory).map(skill => (
          <button
            key={skill.id}
            className={`skill-card ${enabledSkills.has(skill.id) ? 'enabled' : ''} ${skill.builtin ? 'builtin' : ''}`}
            onClick={() => toggleSkill(skill.id)}
          >
            <div className="skill-header">
              <span className="skill-icon">{skill.icon}</span>
              <div className="skill-meta">
                <span className="skill-name">{skill.name}</span>
                <div className="skill-badges">
                  {skill.builtin && <span className="builtin-badge">Built-in</span>}
                  {skill.requiresSetup && <span className="setup-badge">Setup required</span>}
                </div>
              </div>
              <div className="skill-toggle">
                <span className={`toggle ${enabledSkills.has(skill.id) ? 'on' : 'off'}`}>
                  {enabledSkills.has(skill.id) ? '✓' : ''}
                </span>
              </div>
            </div>
            <p className="skill-description">{skill.description}</p>
            <div className="skill-features">
              {skill.features.map(f => (
                <span key={f} className="feature-tag">{f}</span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="selection-summary">
        <p>
          <strong>{enabledSkills.size}</strong> skill{enabledSkills.size !== 1 ? 's' : ''} enabled
          {enabledSkills.size > 0 && (
            <span className="summary-breakdown">
              {' '}({SKILLS.filter(s => s.builtin && enabledSkills.has(s.id)).length} built-in,{' '}
              {SKILLS.filter(s => !s.builtin && enabledSkills.has(s.id)).length} require setup)
            </span>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="step-actions">
        <button className="btn-secondary" onClick={onBack}>
          Back
        </button>
        <button className="btn-primary" onClick={handleContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}

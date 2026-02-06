/**
 * ToolGroupToggle - Reusable toggle card for tool groups
 *
 * Displays a tool group with icon, label, description, tool count,
 * and an on/off toggle switch. Used within ToolsPolicyEditor.
 */

import { useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolGroupToggleProps {
  name: string;           // e.g., "group:runtime"
  label: string;          // e.g., "Runtime"
  description: string;    // e.g., "Process control, exec, eval"
  icon: string;           // emoji
  toolCount: number;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const tgtStyles = `
.tgt-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.tgt-card:hover {
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.03);
}

.tgt-card:focus-visible {
  outline: 2px solid var(--accent-color, #6366f1);
  outline-offset: 2px;
}

.tgt-card--enabled {
  border-color: rgba(99, 102, 241, 0.35);
  background: rgba(99, 102, 241, 0.06);
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.08);
}

.tgt-card--enabled:hover {
  border-color: rgba(99, 102, 241, 0.5);
  background: rgba(99, 102, 241, 0.1);
}

.tgt-card--disabled {
  opacity: 0.55;
}

.tgt-card--disabled:hover {
  opacity: 0.7;
}

.tgt-icon {
  font-size: 1.5rem;
  line-height: 1;
  flex-shrink: 0;
  width: 32px;
  text-align: center;
}

.tgt-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.tgt-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tgt-desc {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tgt-card--enabled .tgt-desc {
  color: var(--text-secondary, #a0a0c0);
}

.tgt-count {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-secondary, #a0a0c0);
  flex-shrink: 0;
}

.tgt-card--enabled .tgt-count {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
}

.tgt-toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}

.tgt-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.tgt-toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: #1a1a3a;
  border-radius: 22px;
  transition: background 0.2s ease;
}

.tgt-toggle-slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 3px;
  bottom: 3px;
  background: #ffffff;
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.tgt-toggle input:checked + .tgt-toggle-slider {
  background: var(--accent-color, #6366f1);
}

.tgt-toggle input:checked + .tgt-toggle-slider::before {
  transform: translateX(18px);
}

.tgt-toggle input:focus-visible + .tgt-toggle-slider {
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3);
}
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ToolGroupToggle({
  name,
  label,
  description,
  icon,
  toolCount,
  enabled,
  onChange,
}: ToolGroupToggleProps) {
  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(!enabled);
    },
    [enabled, onChange]
  );

  const handleCardClick = useCallback(() => {
    onChange(!enabled);
  }, [enabled, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onChange(!enabled);
      }
    },
    [enabled, onChange]
  );

  return (
    <>
      <style>{tgtStyles}</style>
      <div
        className={`tgt-card ${enabled ? 'tgt-card--enabled' : 'tgt-card--disabled'}`}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        role="switch"
        aria-checked={enabled}
        aria-label={`${label}: ${description}`}
        tabIndex={0}
        data-group={name}
      >
        <span className="tgt-icon" aria-hidden="true">{icon}</span>
        <div className="tgt-info">
          <span className="tgt-label">{label}</span>
          <span className="tgt-desc">{description}</span>
        </div>
        <span className="tgt-count">{toolCount}</span>
        <label className="tgt-toggle" onClick={handleToggle}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={() => onChange(!enabled)}
            tabIndex={-1}
            aria-hidden="true"
          />
          <span className="tgt-toggle-slider" />
        </label>
      </div>
    </>
  );
}

export default ToolGroupToggle;

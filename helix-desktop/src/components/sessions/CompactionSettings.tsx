/**
 * CompactionSettings - Reusable compaction configuration sub-component
 *
 * Controls compaction mode, memory flush, threshold, and per-session or
 * bulk compaction triggers. Used inside SessionConfig but can be embedded
 * anywhere compaction settings are needed.
 *
 * CSS prefix: cs-
 */

import { useState } from 'react';

/* -----------------------------------------------------------------------
   Types
   ----------------------------------------------------------------------- */

export interface CompactionSettingsProps {
  mode: 'default' | 'safeguard';
  memoryFlush: boolean;
  threshold: number;
  onModeChange: (mode: 'default' | 'safeguard') => void;
  onMemoryFlushChange: (flush: boolean) => void;
  onThresholdChange: (threshold: number) => void;
  onCompactAll?: () => void;
  onCompactSession?: (sessionId: string) => void;
  sessions?: Array<{ id: string; label: string }>;
  compacting?: boolean;
}

/* -----------------------------------------------------------------------
   Component
   ----------------------------------------------------------------------- */

export function CompactionSettings({
  mode,
  memoryFlush,
  threshold,
  onModeChange,
  onMemoryFlushChange,
  onThresholdChange,
  onCompactAll,
  onCompactSession,
  sessions,
  compacting = false,
}: CompactionSettingsProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  const handleCompactSession = () => {
    if (selectedSessionId && onCompactSession) {
      onCompactSession(selectedSessionId);
    }
  };

  return (
    <div className="cs-root">
      <style>{compactionStyles}</style>

      {/* Compaction Mode */}
      <div className="cs-field">
        <label className="cs-label">Compaction Mode</label>
        <div className="cs-radio-cards">
          <button
            type="button"
            className={`cs-radio-card ${mode === 'default' ? 'cs-radio-card--selected' : ''}`}
            onClick={() => onModeChange('default')}
          >
            <span className="cs-radio-card__title">Default</span>
            <span className="cs-radio-card__desc">
              Standard compaction. Summarize and trim context to stay within token limits.
            </span>
          </button>
          <button
            type="button"
            className={`cs-radio-card ${mode === 'safeguard' ? 'cs-radio-card--selected' : ''}`}
            onClick={() => onModeChange('safeguard')}
          >
            <span className="cs-radio-card__title">Safeguard</span>
            <span className="cs-radio-card__desc">
              Keep more context with less aggressive trimming. Higher token usage.
            </span>
          </button>
        </div>
      </div>

      {/* Memory Flush Toggle */}
      <div className="cs-field cs-field--row">
        <div className="cs-field__text">
          <span className="cs-label">Memory Flush</span>
          <span className="cs-hint">Flush memory files to disk before compaction runs.</span>
        </div>
        <label className="cs-toggle">
          <input
            type="checkbox"
            checked={memoryFlush}
            onChange={() => onMemoryFlushChange(!memoryFlush)}
          />
          <span className="cs-toggle__slider" />
        </label>
      </div>

      {/* Compact Threshold Slider */}
      <div className="cs-field">
        <label className="cs-label">
          Compact Threshold: <span className="cs-label__value">{threshold.toLocaleString()} tokens</span>
        </label>
        <input
          type="range"
          className="cs-slider"
          min={1000}
          max={50000}
          step={1000}
          value={threshold}
          onChange={(e) => onThresholdChange(parseInt(e.target.value, 10))}
        />
        <div className="cs-slider__labels">
          <span>1,000</span>
          <span>25,000</span>
          <span>50,000</span>
        </div>
      </div>

      {/* Actions */}
      <div className="cs-actions">
        {onCompactAll && (
          <button
            type="button"
            className="cs-btn cs-btn--primary"
            onClick={onCompactAll}
            disabled={compacting}
          >
            {compacting ? (
              <>
                <span className="cs-spinner" />
                Compacting...
              </>
            ) : (
              'Compact All Now'
            )}
          </button>
        )}

        {onCompactSession && sessions && sessions.length > 0 && (
          <div className="cs-compact-session">
            <select
              className="cs-select"
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
            >
              <option value="">Select session...</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="cs-btn cs-btn--secondary"
              onClick={handleCompactSession}
              disabled={!selectedSessionId || compacting}
            >
              Compact Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CompactionSettings;

/* -----------------------------------------------------------------------
   Scoped Styles (cs- prefix)
   ----------------------------------------------------------------------- */

const compactionStyles = `
.cs-root {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ── Fields ── */
.cs-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cs-field--row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.cs-field__text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  flex: 1;
  min-width: 0;
}

.cs-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.cs-label__value {
  font-family: var(--font-mono, monospace);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--accent-color, #6366f1);
}

.cs-hint {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  line-height: 1.4;
}

/* ── Radio Cards ── */
.cs-radio-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.625rem;
}

.cs-radio-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.875rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.cs-radio-card:hover {
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.03);
}

.cs-radio-card--selected {
  border-color: var(--accent-color, #6366f1);
  background: rgba(99, 102, 241, 0.08);
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.25);
}

.cs-radio-card--selected:hover {
  border-color: var(--accent-color, #6366f1);
  background: rgba(99, 102, 241, 0.12);
}

.cs-radio-card__title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.cs-radio-card--selected .cs-radio-card__title {
  color: var(--accent-color, #6366f1);
}

.cs-radio-card__desc {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  line-height: 1.4;
}

/* ── Toggle ── */
.cs-toggle {
  position: relative;
  display: inline-flex;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
  cursor: pointer;
}

.cs-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.cs-toggle__slider {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 11px;
  transition: background 0.2s ease;
}

.cs-toggle__slider::before {
  content: '';
  position: absolute;
  left: 3px;
  top: 3px;
  width: 16px;
  height: 16px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.cs-toggle input:checked + .cs-toggle__slider {
  background: var(--accent-color, #6366f1);
}

.cs-toggle input:checked + .cs-toggle__slider::before {
  transform: translateX(18px);
}

/* ── Slider ── */
.cs-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

.cs-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-color, #6366f1);
  border: 2px solid rgba(255, 255, 255, 0.15);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.cs-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
  box-shadow: 0 0 8px rgba(99, 102, 241, 0.4);
}

.cs-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-color, #6366f1);
  border: 2px solid rgba(255, 255, 255, 0.15);
  cursor: pointer;
}

.cs-slider__labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.625rem;
  color: var(--text-tertiary, #606080);
  margin-top: 0.25rem;
}

/* ── Select ── */
.cs-select {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 0.75rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-primary, #fff);
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.cs-select:focus {
  border-color: var(--accent-color, #6366f1);
}

/* ── Actions ── */
.cs-actions {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding-top: 0.5rem;
}

.cs-compact-session {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

/* ── Buttons ── */
.cs-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
  white-space: nowrap;
}

.cs-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cs-btn--primary {
  background: var(--accent-color, #6366f1);
  color: #fff;
}

.cs-btn--primary:hover:not(:disabled) {
  background: #5558e6;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.cs-btn--secondary {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-secondary, #a0a0c0);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.cs-btn--secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary, #fff);
  border-color: rgba(255, 255, 255, 0.15);
}

/* ── Spinner ── */
.cs-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: cs-spin 0.7s linear infinite;
}

@keyframes cs-spin {
  to { transform: rotate(360deg); }
}

/* ── Responsive ── */
@media (max-width: 480px) {
  .cs-radio-cards {
    grid-template-columns: 1fr;
  }

  .cs-compact-session {
    flex-direction: column;
    align-items: stretch;
  }
}
`;

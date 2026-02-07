/**
 * Reset Mode Selector
 *
 * Session reset mode selection and configuration
 * Phase G.1 - Session Configuration & Token Management
 */

import { useState, useEffect, useCallback } from 'react';
import { useGateway } from '../../hooks/useGateway';

type ResetMode = 'daily' | 'idle' | 'manual';

interface ResetModeConfig {
  mode: ResetMode;
  dailyResetHour?: number; // 0-23
  idleTimeoutMinutes?: number;
  enabled: boolean;
}

export function ResetModeSelector({ sessionKey }: { sessionKey?: string }) {
  const { getClient, connected } = useGateway();
  const [resetConfig, setResetConfig] = useState<ResetModeConfig>({
    mode: 'daily',
    dailyResetHour: 0,
    idleTimeoutMinutes: 120,
    enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Load reset configuration
  useEffect(() => {
    if (sessionKey) {
      loadResetConfig();
    } else {
      setLoading(false);
    }
  }, [sessionKey, connected]);

  const loadResetConfig = useCallback(async () => {
    setLoading(true);
    try {
      const client = getClient();
      if (!client?.connected) {
        setLoading(false);
        return;
      }

      const result = (await client.request('sessions.get', {
        sessionKey,
      })) as any;

      if (result?.session) {
        setResetConfig({
          mode: result.session.resetMode || 'daily',
          dailyResetHour: result.session.dailyResetHour ?? 0,
          idleTimeoutMinutes: result.session.idleTimeoutMinutes ?? 120,
          enabled: result.session.resetEnabled !== false,
        });
      }
    } catch (err) {
      console.error('Failed to load reset config:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionKey, getClient]);

  const handleSaveConfig = useCallback(async () => {
    if (!sessionKey) return;

    setSaveStatus('saving');
    try {
      const client = getClient();
      if (!client?.connected) {
        setSaveStatus('error');
        return;
      }

      await client.request('sessions.patch', {
        sessionKey,
        patch: {
          resetMode: resetConfig.mode,
          dailyResetHour: resetConfig.dailyResetHour,
          idleTimeoutMinutes: resetConfig.idleTimeoutMinutes,
          resetEnabled: resetConfig.enabled,
        },
      });

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save reset config:', err);
      setSaveStatus('error');
    }
  }, [sessionKey, resetConfig, getClient]);

  if (loading) {
    return <div className="reset-mode-selector loading">Loading reset configuration...</div>;
  }

  return (
    <div className="reset-mode-selector">
      <style>{resetModeSelectorStyles}</style>

      <div className="selector-header">
        <h4>Session Reset Configuration</h4>
        {sessionKey && (
          <span className="session-key-badge">{sessionKey}</span>
        )}
      </div>

      {/* Enable/Disable Toggle */}
      <div className="config-section">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={resetConfig.enabled}
            onChange={(e) =>
              setResetConfig({ ...resetConfig, enabled: e.target.checked })
            }
          />
          <span>Enable automatic session reset</span>
        </label>
        <p className="help-text">
          Automatically reset session when configured conditions are met
        </p>
      </div>

      {resetConfig.enabled && (
        <>
          {/* Reset Mode Selection */}
          <div className="config-section">
            <label className="section-label">Reset Mode</label>
            <div className="mode-options">
              <label className="radio-label">
                <input
                  type="radio"
                  name="resetMode"
                  value="daily"
                  checked={resetConfig.mode === 'daily'}
                  onChange={(e) =>
                    setResetConfig({ ...resetConfig, mode: e.target.value as ResetMode })
                  }
                />
                <span className="radio-text">
                  <strong>Daily</strong>
                  <p className="radio-desc">Reset at a specific time each day</p>
                </span>
              </label>

              <label className="radio-label">
                <input
                  type="radio"
                  name="resetMode"
                  value="idle"
                  checked={resetConfig.mode === 'idle'}
                  onChange={(e) =>
                    setResetConfig({ ...resetConfig, mode: e.target.value as ResetMode })
                  }
                />
                <span className="radio-text">
                  <strong>Idle</strong>
                  <p className="radio-desc">Reset after period of inactivity</p>
                </span>
              </label>

              <label className="radio-label">
                <input
                  type="radio"
                  name="resetMode"
                  value="manual"
                  checked={resetConfig.mode === 'manual'}
                  onChange={(e) =>
                    setResetConfig({ ...resetConfig, mode: e.target.value as ResetMode })
                  }
                />
                <span className="radio-text">
                  <strong>Manual</strong>
                  <p className="radio-desc">Only reset when explicitly requested</p>
                </span>
              </label>
            </div>
          </div>

          {/* Daily Reset Time */}
          {resetConfig.mode === 'daily' && (
            <div className="config-section mode-specific">
              <label className="section-label">Reset Time (UTC)</label>
              <div className="time-picker">
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={resetConfig.dailyResetHour}
                  onChange={(e) =>
                    setResetConfig({
                      ...resetConfig,
                      dailyResetHour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)),
                    })
                  }
                  className="hour-input"
                />
                <span className="time-separator">:</span>
                <span className="minutes-display">00</span>
                <span className="timezone">UTC</span>
              </div>
              <p className="help-text">
                Session will reset daily at {String(resetConfig.dailyResetHour).padStart(2, '0')}:00 UTC
              </p>
            </div>
          )}

          {/* Idle Timeout */}
          {resetConfig.mode === 'idle' && (
            <div className="config-section mode-specific">
              <label className="section-label">Inactivity Timeout</label>
              <div className="timeout-control">
                <input
                  type="range"
                  min="5"
                  max="480"
                  step="5"
                  value={resetConfig.idleTimeoutMinutes}
                  onChange={(e) =>
                    setResetConfig({
                      ...resetConfig,
                      idleTimeoutMinutes: parseInt(e.target.value),
                    })
                  }
                  className="timeout-slider"
                />
                <div className="timeout-display">
                  {resetConfig.idleTimeoutMinutes} minutes
                  {resetConfig.idleTimeoutMinutes >= 60 && (
                    <span className="timeout-hours">
                      ({Math.floor(resetConfig.idleTimeoutMinutes / 60)}h{' '}
                      {resetConfig.idleTimeoutMinutes % 60}m)
                    </span>
                  )}
                </div>
              </div>
              <p className="help-text">
                Session will reset if inactive for {resetConfig.idleTimeoutMinutes} minutes
              </p>
              <div className="preset-buttons">
                <button
                  className="preset-btn"
                  onClick={() => setResetConfig({ ...resetConfig, idleTimeoutMinutes: 30 })}
                >
                  30m
                </button>
                <button
                  className="preset-btn"
                  onClick={() => setResetConfig({ ...resetConfig, idleTimeoutMinutes: 60 })}
                >
                  1h
                </button>
                <button
                  className="preset-btn"
                  onClick={() => setResetConfig({ ...resetConfig, idleTimeoutMinutes: 120 })}
                >
                  2h
                </button>
                <button
                  className="preset-btn"
                  onClick={() => setResetConfig({ ...resetConfig, idleTimeoutMinutes: 480 })}
                >
                  8h
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Save Button */}
      {sessionKey && (
        <div className="save-section">
          <button
            className={`save-btn ${saveStatus}`}
            onClick={handleSaveConfig}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'saved' && '✓ Saved'}
            {saveStatus === 'error' && 'Error - Try Again'}
            {saveStatus === 'idle' && 'Save Configuration'}
          </button>
        </div>
      )}

      {/* Info Box */}
      <div className="info-box">
        <strong>💡 Note:</strong> Session reset clears conversation history and context. Psychological layers and long-term memory are preserved.
      </div>
    </div>
  );
}

const resetModeSelectorStyles = `
.reset-mode-selector {
  padding: 1.5rem;
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.reset-mode-selector.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--text-tertiary, #606080);
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.selector-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.session-key-badge {
  padding: 0.25rem 0.75rem;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 4px;
  font-size: 0.75rem;
  color: #818cf8;
  font-family: monospace;
}

.config-section {
  margin-bottom: 1.5rem;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  font-size: 0.9rem;
}

.toggle-label input {
  cursor: pointer;
  width: 18px;
  height: 18px;
}

.toggle-label span {
  color: var(--text-primary, #fff);
  font-weight: 500;
}

.section-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary, #606080);
  margin-bottom: 0.75rem;
}

.help-text {
  margin: 0.5rem 0 0 0;
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}

.mode-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.radio-label {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.radio-label:hover {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.25);
}

.radio-label input {
  margin-top: 0.25rem;
  cursor: pointer;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.radio-text {
  flex: 1;
}

.radio-text strong {
  display: block;
  color: var(--text-primary, #fff);
  margin-bottom: 0.25rem;
}

.radio-desc {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
}

.mode-specific {
  padding: 1rem;
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 6px;
  margin-top: 1rem;
}

.time-picker {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.hour-input {
  width: 60px;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: var(--text-primary, #fff);
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
}

.time-separator {
  color: var(--text-tertiary, #606080);
  font-weight: 600;
}

.minutes-display {
  font-size: 1rem;
  color: var(--text-primary, #fff);
  font-weight: 600;
}

.timezone {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  margin-left: 0.5rem;
}

.timeout-control {
  margin-bottom: 1rem;
}

.timeout-slider {
  width: 100%;
  margin-bottom: 0.75rem;
}

.timeout-display {
  font-size: 0.9rem;
  font-weight: 600;
  color: #818cf8;
}

.timeout-hours {
  margin-left: 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
}

.preset-buttons {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
}

.preset-btn {
  padding: 0.5rem 0.75rem;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 4px;
  color: #818cf8;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.preset-btn:hover {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.5);
}

.save-section {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.save-btn {
  width: 100%;
  padding: 0.75rem;
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.save-btn:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  transform: translateY(-2px);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.save-btn.saving {
  background: rgba(99, 102, 241, 0.5);
}

.save-btn.saved {
  background: rgba(16, 185, 129, 0.7);
}

.save-btn.error {
  background: rgba(239, 68, 68, 0.7);
}

.info-box {
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid rgba(96, 165, 250, 0.2);
  border-radius: 4px;
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
}

.info-box strong {
  color: #60a5fa;
}
`;

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useConfig } from '../../../hooks/useConfig';
import type { OnboardingState } from '../Onboarding';
import './Steps.css';

interface DiscordStepProps {
  state: OnboardingState;
  onUpdate: (updates: Partial<OnboardingState>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface WebhookTestResult {
  success: boolean;
  status_code: number | null;
  error: string | null;
}

export function DiscordStep({ state: _state, onUpdate, onNext, onBack }: DiscordStepProps) {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<WebhookTestResult | null>(null);
  const { config, updateConfig } = useConfig();

  const handleTest = async () => {
    if (!webhookUrl.trim()) return;

    setTesting(true);
    setTestResult(null);

    try {
      const result = await invoke<WebhookTestResult>('test_webhook', { url: webhookUrl.trim() });
      setTestResult(result);

      if (result.success && config) {
        // Save webhook URL to config
        await updateConfig({
          discord: {
            ...config.discord,
            enabled: true,
            webhooks: {
              ...config.discord.webhooks,
              commands: webhookUrl.trim(),
              heartbeat: webhookUrl.trim(),
              alerts: webhookUrl.trim(),
            },
          },
        });
        onUpdate({ discordEnabled: true, discordWebhooksSet: true });
      }
    } catch (e) {
      setTestResult({
        success: false,
        status_code: null,
        error: e instanceof Error ? e.message : 'Test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSkip = () => {
    onUpdate({ discordEnabled: false });
    onNext();
  };

  const handleContinue = () => {
    if (testResult?.success) {
      onNext();
    }
  };

  return (
    <div className="onboarding-step discord-step">
      <h1>Transparency Logging</h1>
      <p className="step-description">
        Helix uses Discord webhooks for unhackable logging. Every action is logged
        externally <strong>before</strong> execution, creating an immutable audit trail
        that even Helix cannot tamper with.
      </p>

      <div className="info-box">
        <strong>Why Discord?</strong>
        <p>
          Discord provides free, reliable, external storage with timestamps
          that cannot be modified. This ensures complete transparency of all
          Helix actions.
        </p>
      </div>

      <div className="webhook-input">
        <label>Discord Webhook URL</label>
        <input
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
        />
        <p className="input-hint">
          Create a webhook in your Discord server: Server Settings → Integrations → Webhooks
        </p>
      </div>

      {testResult && (
        <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
          {testResult.success ? (
            <span>✓ Connection successful! Check your Discord channel for a test message.</span>
          ) : (
            <span>✗ {testResult.error || 'Connection failed'}</span>
          )}
        </div>
      )}

      <div className="step-buttons">
        <button className="secondary-button" onClick={onBack}>
          Back
        </button>
        <button className="text-button" onClick={handleSkip}>
          Skip for now
        </button>
        {testResult?.success ? (
          <button className="primary-button" onClick={handleContinue}>
            Continue
          </button>
        ) : (
          <button
            className="primary-button"
            onClick={handleTest}
            disabled={!webhookUrl.trim() || testing}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
        )}
      </div>
    </div>
  );
}

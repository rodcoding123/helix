import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, Download, AlertTriangle, Key, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import type { OnboardingData } from '../OnboardingWizard';

interface InstanceKeyStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

export function InstanceKeyStep({ data, updateData }: InstanceKeyStepProps) {
  const [copied, setCopied] = useState(false);
  const [savedConfirmed, setSavedConfirmed] = useState(data.keySaved);

  // Generate instance key on mount if not already set
  useEffect(() => {
    if (!data.instanceKey) {
      const newKey = crypto.randomUUID();
      updateData({ instanceKey: newKey });
    }
  }, [data.instanceKey, updateData]);

  const regenerateKey = useCallback(() => {
    const newKey = crypto.randomUUID();
    updateData({ instanceKey: newKey, keySaved: false });
    setSavedConfirmed(false);
  }, [updateData]);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(data.instanceKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [data.instanceKey]);

  const downloadAsFile = useCallback(() => {
    const content = `# Helix Instance Key
# Generated: ${new Date().toISOString()}
# KEEP THIS FILE SAFE - You cannot recover this key!

HELIX_INSTANCE_KEY=${data.instanceKey}
`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'helix-instance-key.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data.instanceKey]);

  const handleConfirmSaved = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked;
      setSavedConfirmed(checked);
      updateData({ keySaved: checked });
    },
    [updateData]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-warning/20 border border-warning/30">
          <Key className="h-7 w-7 text-warning" />
        </div>
        <h2 className="text-2xl font-display font-bold text-white">Your Instance Key</h2>
        <p className="mt-2 text-text-secondary max-w-lg mx-auto">
          This unique key connects your local Helix to this web interface. Save it securely - you cannot recover it later!
        </p>
      </div>

      {/* Warning banner */}
      <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium text-warning">Critical: Save This Key Now!</h3>
          <p className="mt-1 text-sm text-warning/80">
            Your instance key is like a password. If you lose it, you'll need to create a new instance and reconfigure your local Helix.
          </p>
        </div>
      </div>

      {/* Instance key display */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-text-secondary">Instance Key</label>
        <div className="relative">
          <div className="rounded-xl border border-helix-500/30 bg-bg-tertiary p-4 font-mono text-lg text-helix-400 tracking-wider text-center break-all">
            {data.instanceKey || 'Generating...'}
          </div>

          {/* Glow effect */}
          <div className="absolute inset-0 rounded-xl bg-helix-500/10 blur-xl -z-10" />
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={copyToClipboard}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg border transition-all',
              copied
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-white/20 bg-bg-tertiary text-text-secondary hover:text-white hover:border-white/30'
            )}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>

          <button
            onClick={downloadAsFile}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/20 bg-bg-tertiary text-text-secondary hover:text-white hover:border-white/30 transition-all"
          >
            <Download className="h-4 w-4" />
            Download
          </button>

          <button
            onClick={regenerateKey}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/20 bg-bg-tertiary text-text-secondary hover:text-white hover:border-white/30 transition-all"
            title="Generate new key"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Confirmation checkbox */}
      <div className="rounded-xl border border-white/10 bg-bg-tertiary/50 p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={savedConfirmed}
            onChange={handleConfirmSaved}
            className="mt-1 h-5 w-5 rounded border-white/30 bg-bg-tertiary text-helix-500 focus:ring-helix-500/50"
          />
          <span className="text-text-secondary">
            <span className="text-white font-medium">I have saved my instance key</span>
            <br />
            <span className="text-sm">
              I understand that I cannot proceed without saving this key, and that it cannot be recovered if lost.
            </span>
          </span>
        </label>
      </div>

      {/* Tips */}
      <div className="text-sm text-text-tertiary">
        <p className="font-medium text-text-secondary mb-1">Recommended storage:</p>
        <ul className="space-y-1">
          <li>• Password manager (1Password, Bitwarden, etc.)</li>
          <li>• Secure notes app</li>
          <li>• Downloaded file in a secure location</li>
        </ul>
      </div>
    </div>
  );
}

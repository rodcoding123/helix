import { useState, useCallback, useMemo } from 'react';
import { Copy, Check, Download, FileCode, FolderOpen } from 'lucide-react';
import clsx from 'clsx';
import type { OnboardingData } from '../OnboardingWizard';

interface EnvConfigStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

type Platform = 'macos' | 'windows' | 'linux';

function detectPlatform(): Platform {
  if ('userAgentData' in navigator) {
    const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform?.toLowerCase();
    if (platform?.includes('mac')) return 'macos';
    if (platform?.includes('win')) return 'windows';
    if (platform?.includes('linux')) return 'linux';
  }

  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('win')) return 'windows';
  return 'linux';
}

const PLATFORM_PATHS: Record<Platform, string> = {
  macos: '~/.helix/.env',
  windows: '%USERPROFILE%\\.helix\\.env',
  linux: '~/.helix/.env',
};

export function EnvConfigStep({ data, updateData }: EnvConfigStepProps) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(data.envConfigured);
  const platform = detectPlatform();

  const envContent = useMemo(() => {
    return `# Helix Configuration
# Generated: ${new Date().toISOString()}

# Your unique instance key (REQUIRED)
HELIX_INSTANCE_KEY=${data.instanceKey}

# Gateway configuration
HELIX_GATEWAY_PORT=18789
HELIX_GATEWAY_HOST=127.0.0.1

# Observatory connection (for web UI)
HELIX_OBSERVATORY_URL=wss://observatory.helix-project.org

# Logging (optional)
# HELIX_LOG_LEVEL=info
# HELIX_LOG_TO_FILE=true
`;
  }, [data.instanceKey]);

  const copyEnvContent = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(envContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [envContent]);

  const downloadEnvFile = useCallback(() => {
    const blob = new Blob([envContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '.env';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [envContent]);

  const handleConfirm = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked;
      setConfirmed(checked);
      updateData({ envConfigured: checked });
    },
    [updateData]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-helix-500/20 border border-helix-500/30">
          <FileCode className="h-7 w-7 text-helix-400" />
        </div>
        <h2 className="text-2xl font-display font-bold text-white">Configure Environment</h2>
        <p className="mt-2 text-text-secondary max-w-lg mx-auto">
          Create the configuration file that tells Helix how to connect to this web interface.
        </p>
      </div>

      {/* File location */}
      <div className="rounded-xl border border-white/10 bg-bg-tertiary/50 p-4">
        <div className="flex items-center gap-3 mb-3">
          <FolderOpen className="h-5 w-5 text-text-tertiary" />
          <div>
            <p className="text-sm text-text-secondary">Save this file to:</p>
            <p className="font-mono text-helix-400">{PLATFORM_PATHS[platform]}</p>
          </div>
        </div>
        <p className="text-xs text-text-tertiary">
          Create the .helix directory if it doesn't exist. On Windows, the directory will be in your user folder.
        </p>
      </div>

      {/* Env file content */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-text-secondary">.env file contents</label>
          <div className="flex items-center gap-2">
            <button
              onClick={copyEnvContent}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                copied
                  ? 'bg-success/20 text-success'
                  : 'bg-bg-tertiary border border-white/20 text-text-secondary hover:text-white hover:border-white/30'
              )}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={downloadEnvFile}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-tertiary border border-white/20 text-text-secondary hover:text-white hover:border-white/30 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          </div>
        </div>

        <div className="relative">
          <pre className="rounded-xl border border-white/10 bg-bg-primary p-4 font-mono text-sm text-text-secondary overflow-x-auto max-h-64">
            {envContent}
          </pre>
        </div>
      </div>

      {/* Setup instructions */}
      <div className="rounded-xl border border-white/10 bg-bg-tertiary/50 p-4">
        <h3 className="font-medium text-white mb-3">Setup steps:</h3>
        <ol className="space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-helix-500/20 text-helix-400 text-xs font-medium shrink-0">
              1
            </span>
            <div className="text-text-secondary">
              <strong className="text-white">Create the .helix directory</strong>
              <br />
              <code className="text-xs text-helix-400 font-mono">
                {platform === 'windows' ? 'mkdir %USERPROFILE%\\.helix' : 'mkdir -p ~/.helix'}
              </code>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-helix-500/20 text-helix-400 text-xs font-medium shrink-0">
              2
            </span>
            <div className="text-text-secondary">
              <strong className="text-white">Save the .env file</strong>
              <br />
              Download or copy the contents above and save to{' '}
              <code className="text-xs text-helix-400 font-mono">{PLATFORM_PATHS[platform]}</code>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-helix-500/20 text-helix-400 text-xs font-medium shrink-0">
              3
            </span>
            <div className="text-text-secondary">
              <strong className="text-white">Restart Helix</strong>
              <br />
              <code className="text-xs text-helix-400 font-mono">helix restart</code> or start fresh with{' '}
              <code className="text-xs text-helix-400 font-mono">helix start</code>
            </div>
          </li>
        </ol>
      </div>

      {/* Confirmation checkbox */}
      <div className="rounded-xl border border-white/10 bg-bg-tertiary/50 p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={handleConfirm}
            className="mt-1 h-5 w-5 rounded border-white/30 bg-bg-tertiary text-helix-500 focus:ring-helix-500/50"
          />
          <span className="text-text-secondary">
            <span className="text-white font-medium">I've saved the configuration file</span>
            <br />
            <span className="text-sm">
              The .env file is saved to the correct location and Helix is running with the new configuration.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

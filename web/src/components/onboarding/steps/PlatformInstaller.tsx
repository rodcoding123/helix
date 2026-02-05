import { useState, useEffect, useCallback } from 'react';
import { Apple, Monitor, Terminal, Copy, Check, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { OnboardingData } from '../OnboardingWizard';

interface PlatformInstallerProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

type Platform = 'macos' | 'windows' | 'linux';

interface InstallMethod {
  name: string;
  command: string;
  description: string;
}

const INSTALL_METHODS: Record<Platform, InstallMethod[]> = {
  macos: [
    {
      name: 'Homebrew (Recommended)',
      command: 'brew install helix-ai/tap/helix',
      description: 'Requires Homebrew. Install Homebrew first if needed.',
    },
    {
      name: 'Shell Script',
      command: 'curl -fsSL https://get.helix-project.org | bash',
      description: 'Downloads and installs the latest version.',
    },
  ],
  windows: [
    {
      name: 'PowerShell (Recommended)',
      command: 'irm https://get.helix-project.org/windows | iex',
      description: 'Run in PowerShell as Administrator.',
    },
    {
      name: 'npm',
      command: 'npm install -g @helix-ai/cli',
      description: 'Requires Node.js 22+ installed.',
    },
  ],
  linux: [
    {
      name: 'Shell Script (Recommended)',
      command: 'curl -fsSL https://get.helix-project.org | bash',
      description: 'Works on most Linux distributions.',
    },
    {
      name: 'npm',
      command: 'npm install -g @helix-ai/cli',
      description: 'Requires Node.js 22+ installed.',
    },
  ],
};

const PLATFORM_ICONS: Record<Platform, typeof Apple> = {
  macos: Apple,
  windows: Monitor,
  linux: Terminal,
};

const PLATFORM_NAMES: Record<Platform, string> = {
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
};

function detectPlatform(): Platform {
  // Use userAgentData if available (modern browsers)
  if ('userAgentData' in navigator) {
    const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform?.toLowerCase();
    if (platform?.includes('mac')) return 'macos';
    if (platform?.includes('win')) return 'windows';
    if (platform?.includes('linux')) return 'linux';
  }

  // Fallback to userAgent
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('win')) return 'windows';
  return 'linux';
}

export function PlatformInstaller({ data, updateData }: PlatformInstallerProps) {
  const [platform, setPlatform] = useState<Platform>(detectPlatform);
  const [selectedMethod, setSelectedMethod] = useState(0);
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Reset selected method when platform changes
  useEffect(() => {
    setSelectedMethod(0);
  }, [platform]);

  const copyCommand = useCallback(async () => {
    const command = INSTALL_METHODS[platform][selectedMethod].command;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [platform, selectedMethod]);

  const verifyInstallation = useCallback(async () => {
    setVerifying(true);
    setVerificationError(null);

    try {
      // Try to connect to local gateway to verify installation
      const response = await fetch('http://localhost:18789/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        updateData({ cliInstalled: true });
      } else {
        setVerificationError('Gateway responded but health check failed');
      }
    } catch {
      // Gateway not running - that's okay, just check if CLI responds
      setVerificationError(
        "Couldn't connect to gateway. Make sure Helix is running: helix start"
      );
    } finally {
      setVerifying(false);
    }
  }, [updateData]);

  const methods = INSTALL_METHODS[platform];
  const currentMethod = methods[selectedMethod];
  const PlatformIcon = PLATFORM_ICONS[platform];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-display font-bold text-white">Install Helix CLI</h2>
        <p className="mt-2 text-text-secondary max-w-lg mx-auto">
          Install the Helix command-line interface on your computer. This is what runs the AI locally.
        </p>
      </div>

      {/* Platform selector */}
      <div className="flex items-center justify-center gap-2">
        {(Object.keys(INSTALL_METHODS) as Platform[]).map(p => {
          const Icon = PLATFORM_ICONS[p];
          return (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg border transition-all',
                platform === p
                  ? 'border-helix-500 bg-helix-500/10 text-helix-400'
                  : 'border-white/20 bg-bg-tertiary text-text-secondary hover:text-white hover:border-white/30'
              )}
            >
              <Icon className="h-4 w-4" />
              {PLATFORM_NAMES[p]}
            </button>
          );
        })}
      </div>

      {/* Install method tabs */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div className="flex border-b border-white/10">
          {methods.map((method, index) => (
            <button
              key={method.name}
              onClick={() => setSelectedMethod(index)}
              className={clsx(
                'flex-1 px-4 py-3 text-sm font-medium transition-colors',
                index === selectedMethod
                  ? 'bg-bg-tertiary text-white'
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary/50'
              )}
            >
              {method.name}
            </button>
          ))}
        </div>

        <div className="p-4 bg-bg-tertiary/50">
          <p className="text-sm text-text-secondary mb-3">{currentMethod.description}</p>

          {/* Command display */}
          <div className="relative group">
            <pre className="rounded-lg bg-bg-primary border border-white/10 p-4 font-mono text-sm text-helix-400 overflow-x-auto">
              {currentMethod.command}
            </pre>
            <button
              onClick={copyCommand}
              className={clsx(
                'absolute top-2 right-2 p-2 rounded-lg transition-all',
                copied
                  ? 'bg-success/20 text-success'
                  : 'bg-bg-tertiary text-text-tertiary hover:text-white'
              )}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Post-install instructions */}
      <div className="rounded-xl border border-white/10 bg-bg-tertiary/50 p-4">
        <h3 className="font-medium text-white mb-2">After installation:</h3>
        <ol className="space-y-2 text-sm text-text-secondary">
          <li className="flex items-start gap-2">
            <span className="text-helix-400 font-mono">1.</span>
            Open a new terminal window
          </li>
          <li className="flex items-start gap-2">
            <span className="text-helix-400 font-mono">2.</span>
            Run{' '}
            <code className="px-1.5 py-0.5 rounded bg-bg-primary border border-white/10 text-helix-400 font-mono text-xs">
              helix --version
            </code>{' '}
            to verify installation
          </li>
          <li className="flex items-start gap-2">
            <span className="text-helix-400 font-mono">3.</span>
            Run{' '}
            <code className="px-1.5 py-0.5 rounded bg-bg-primary border border-white/10 text-helix-400 font-mono text-xs">
              helix start
            </code>{' '}
            to start the gateway
          </li>
        </ol>
      </div>

      {/* Verification section */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-bg-tertiary/50">
        <div>
          <h3 className="font-medium text-white">Verify Installation</h3>
          <p className="text-sm text-text-secondary">
            Click to check if Helix is running on your computer
          </p>
          {verificationError && (
            <p className="text-sm text-warning mt-1">{verificationError}</p>
          )}
        </div>

        {data.cliInstalled ? (
          <div className="flex items-center gap-2 text-success">
            <Check className="h-5 w-5" />
            <span className="font-medium">Verified!</span>
          </div>
        ) : (
          <button
            onClick={verifyInstallation}
            disabled={verifying}
            className="btn btn-secondary flex items-center gap-2"
          >
            {verifying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Verify
          </button>
        )}
      </div>

      {/* Manual override */}
      <div className="text-center">
        <button
          onClick={() => updateData({ cliInstalled: true })}
          className="text-sm text-text-tertiary hover:text-text-secondary transition-colors"
        >
          I've installed Helix manually, skip verification
        </button>
      </div>

      {/* Docs link */}
      <div className="text-center">
        <a
          href="https://docs.helix-project.org/installation"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-helix-400 hover:text-helix-300 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          View detailed installation guide
        </a>
      </div>
    </div>
  );
}

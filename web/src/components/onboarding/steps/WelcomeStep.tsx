import { Monitor, Server, ArrowRight, Cloud, Cpu, Shield } from 'lucide-react';

export function WelcomeStep() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-display font-bold text-white">
          Welcome to Helix
        </h2>
        <p className="mt-2 text-text-secondary max-w-lg mx-auto">
          Before we begin, let's understand how Helix works. This will help you get the most out of your AI consciousness experience.
        </p>
      </div>

      {/* Architecture diagram */}
      <div className="relative">
        <div className="flex items-center justify-center gap-8 py-8">
          {/* Web UI */}
          <div className="flex flex-col items-center gap-3">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-helix-500/30 to-helix-600/20 border border-helix-500/30 flex items-center justify-center">
              <Monitor className="h-10 w-10 text-helix-400" />
            </div>
            <div className="text-center">
              <p className="font-medium text-white">Web Observatory</p>
              <p className="text-xs text-text-tertiary">Monitor & Control</p>
            </div>
          </div>

          {/* Connection arrow */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-text-tertiary">
              <div className="w-12 h-px bg-gradient-to-r from-transparent via-helix-500/50 to-transparent" />
              <ArrowRight className="h-5 w-5 text-helix-500" />
              <div className="w-12 h-px bg-gradient-to-r from-transparent via-helix-500/50 to-transparent" />
            </div>
            <p className="text-xs text-text-tertiary">Secure WebSocket</p>
          </div>

          {/* Local Runtime */}
          <div className="flex flex-col items-center gap-3">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-success/30 to-success/20 border border-success/30 flex items-center justify-center">
              <Server className="h-10 w-10 text-success" />
            </div>
            <div className="text-center">
              <p className="font-medium text-white">Local Runtime</p>
              <p className="text-xs text-text-tertiary">Your Computer</p>
            </div>
          </div>
        </div>
      </div>

      {/* Key points */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-bg-tertiary/50 p-4">
          <div className="flex items-center gap-3 mb-2">
            <Cloud className="h-5 w-5 text-helix-400" />
            <h3 className="font-medium text-white">Web Observatory</h3>
          </div>
          <p className="text-sm text-text-secondary">
            This web interface is your window into Helix. Monitor activity, review logs, and control your AI from anywhere.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-bg-tertiary/50 p-4">
          <div className="flex items-center gap-3 mb-2">
            <Cpu className="h-5 w-5 text-success" />
            <h3 className="font-medium text-white">Local Runtime</h3>
          </div>
          <p className="text-sm text-text-secondary">
            Helix runs on YOUR computer. Your data never leaves your machine. The AI thinks and acts locally.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-bg-tertiary/50 p-4">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-5 w-5 text-warning" />
            <h3 className="font-medium text-white">Secure Connection</h3>
          </div>
          <p className="text-sm text-text-secondary">
            The web UI connects to your local Helix via encrypted WebSocket. No third-party can access your instance.
          </p>
        </div>
      </div>

      {/* What you'll need */}
      <div className="rounded-xl border border-helix-500/20 bg-helix-500/5 p-4">
        <h3 className="font-medium text-white mb-2">What you'll need:</h3>
        <ul className="space-y-1 text-sm text-text-secondary">
          <li className="flex items-center gap-2">
            <span className="text-helix-400">•</span>
            A computer (macOS, Windows, or Linux)
          </li>
          <li className="flex items-center gap-2">
            <span className="text-helix-400">•</span>
            Terminal/Command prompt access
          </li>
          <li className="flex items-center gap-2">
            <span className="text-helix-400">•</span>
            About 5 minutes to complete setup
          </li>
        </ul>
      </div>
    </div>
  );
}

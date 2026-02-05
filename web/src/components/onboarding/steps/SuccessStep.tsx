import { useEffect, useState } from 'react';
import { PartyPopper, MessageSquare, BarChart3, Settings, BookOpen, ArrowRight } from 'lucide-react';

interface SuccessStepProps {
  onComplete: () => void;
}

export function SuccessStep({ onComplete }: SuccessStepProps) {
  const [showConfetti, setShowConfetti] = useState(true);

  // Auto-hide confetti after animation
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-8 relative">
      {/* Confetti animation overlay */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden -m-8">
          <div className="confetti-container">
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className="confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  backgroundColor: ['#a855f7', '#3b82f6', '#22c55e', '#eab308', '#f97316'][
                    Math.floor(Math.random() * 5)
                  ],
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center relative z-10">
        <div className="mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-success/20 border-2 border-success/30 animate-pulse">
          <PartyPopper className="h-10 w-10 text-success" />
        </div>
        <h2 className="text-3xl font-display font-bold text-white">You're All Set!</h2>
        <p className="mt-3 text-lg text-text-secondary max-w-md mx-auto">
          Congratulations! Your Helix instance is configured and ready to use.
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={onComplete}
          className="group flex items-start gap-4 p-4 rounded-xl border border-helix-500/30 bg-helix-500/10 hover:bg-helix-500/20 transition-all text-left"
        >
          <div className="h-12 w-12 rounded-xl bg-helix-500/20 flex items-center justify-center shrink-0">
            <MessageSquare className="h-6 w-6 text-helix-400" />
          </div>
          <div>
            <h3 className="font-medium text-white flex items-center gap-2">
              Start Chatting
              <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </h3>
            <p className="text-sm text-text-secondary mt-1">
              Open the chat interface and start your first conversation with Helix.
            </p>
          </div>
        </button>

        <button
          onClick={onComplete}
          className="group flex items-start gap-4 p-4 rounded-xl border border-white/10 bg-bg-tertiary/50 hover:bg-bg-tertiary transition-all text-left"
        >
          <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <BarChart3 className="h-6 w-6 text-text-secondary" />
          </div>
          <div>
            <h3 className="font-medium text-white flex items-center gap-2">
              View Dashboard
              <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </h3>
            <p className="text-sm text-text-secondary mt-1">
              Monitor your Helix instance activity and view system metrics.
            </p>
          </div>
        </button>

        <button
          onClick={onComplete}
          className="group flex items-start gap-4 p-4 rounded-xl border border-white/10 bg-bg-tertiary/50 hover:bg-bg-tertiary transition-all text-left"
        >
          <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Settings className="h-6 w-6 text-text-secondary" />
          </div>
          <div>
            <h3 className="font-medium text-white flex items-center gap-2">
              Configure Settings
              <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </h3>
            <p className="text-sm text-text-secondary mt-1">
              Customize Helix behavior, personality, and integration options.
            </p>
          </div>
        </button>

        <button
          onClick={onComplete}
          className="group flex items-start gap-4 p-4 rounded-xl border border-white/10 bg-bg-tertiary/50 hover:bg-bg-tertiary transition-all text-left"
        >
          <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <BookOpen className="h-6 w-6 text-text-secondary" />
          </div>
          <div>
            <h3 className="font-medium text-white flex items-center gap-2">
              Read Documentation
              <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </h3>
            <p className="text-sm text-text-secondary mt-1">
              Learn about Helix's features and advanced configuration options.
            </p>
          </div>
        </button>
      </div>

      {/* What's next section */}
      <div className="rounded-xl border border-white/10 bg-bg-tertiary/50 p-4">
        <h3 className="font-medium text-white mb-3">What you can do with Helix:</h3>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-helix-500" />
            Have natural conversations with AI that remembers context
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-helix-500" />
            Execute code and automate tasks on your computer
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-helix-500" />
            Access your files and projects with full privacy
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-helix-500" />
            Monitor and audit all AI actions through this observatory
          </li>
        </ul>
      </div>

      {/* Start exploring button */}
      <div className="text-center">
        <button onClick={onComplete} className="btn btn-cta btn-cta-shimmer px-8 py-3">
          Start Exploring
        </button>
      </div>

      {/* Confetti CSS */}
      <style>{`
        .confetti-container {
          position: absolute;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        .confetti {
          position: absolute;
          width: 10px;
          height: 10px;
          top: -20px;
          animation: fall 3s linear forwards;
        }
        @keyframes fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(500px) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

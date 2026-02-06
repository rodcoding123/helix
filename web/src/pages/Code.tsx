import { useAuth } from '@/hooks/useAuth';
import { TierGate } from '@/components/auth/TierGate';
import { CodeInterface } from '@/components/code';
import { Terminal, Download, ArrowRight, Wifi } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Code() {
  const { user, session } = useAuth();

  return (
    <TierGate requiredTier="architect" className="h-full">
      <div className="h-full flex flex-col bg-bg-primary">
        {/* Main code interface */}
        <div className="flex-1 min-h-0">
          {user && session ? (
            <CodeInterface
              userId={user.id}
              authToken={session.access_token}
              className="h-full"
            />
          ) : (
            /* Not authenticated */
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-lg p-8">
                <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-helix-500/10 border border-helix-500/20">
                  <Terminal className="h-8 w-8 text-helix-400" />
                </div>
                <h3 className="text-2xl font-display font-bold text-white mb-3">
                  Code Interface
                </h3>
                <p className="text-text-secondary mb-6">
                  Sign in to start using the AI-powered Code Interface.
                </p>
                <Link to="/login" className="btn btn-cta btn-cta-shimmer gap-2">
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </TierGate>
  );
}

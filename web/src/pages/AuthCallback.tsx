import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase handles the code exchange automatically via onAuthStateChange
        // We just need to check if the session was established
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          setError(sessionError.message);
          return;
        }

        if (session) {
          // Check onboarding status
          const localComplete = localStorage.getItem('helix_cloud_onboarding_complete') === 'true';
          if (localComplete) {
            navigate('/chat', { replace: true });
          } else {
            navigate('/welcome', { replace: true });
          }
          return;
        }

        // If no session yet, Supabase might still be processing the code exchange
        // The onAuthStateChange listener in AuthProvider will handle it
        // Wait a bit then check again
        const checkInterval = setInterval(async () => {
          const { data: { session: newSession } } = await supabase.auth.getSession();
          if (newSession) {
            clearInterval(checkInterval);
            navigate('/chat', { replace: true });
          }
        }, 500);

        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          setError('Authentication timed out. Please try again.');
        }, 10000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/10 border border-danger/20">
            <AlertCircle className="h-8 w-8 text-danger" />
          </div>
          <h2 className="text-xl font-display font-semibold text-white mb-2">
            Authentication Failed
          </h2>
          <p className="text-text-secondary mb-6">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="btn btn-primary"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-helix-500 mx-auto mb-4" />
        <p className="text-text-secondary">Completing sign in...</p>
      </div>
    </div>
  );
}

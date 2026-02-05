import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getCloudChatClient } from '@/lib/cloud-chat-client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  skipOnboardingCheck?: boolean;
}

export function ProtectedRoute({ children, skipOnboardingCheck }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [shouldRedirectToWelcome, setShouldRedirectToWelcome] = useState(false);

  useEffect(() => {
    if (!user || skipOnboardingCheck) {
      setOnboardingChecked(true);
      return;
    }

    // Fast check from localStorage
    const localComplete = localStorage.getItem('helix_cloud_onboarding_complete') === 'true';
    if (localComplete) {
      setOnboardingChecked(true);
      return;
    }

    // Check server-side profile
    getCloudChatClient()
      .getProfile()
      .then(profile => {
        if (profile && !profile.onboardingCompleted) {
          setShouldRedirectToWelcome(true);
        } else if (profile?.onboardingCompleted) {
          localStorage.setItem('helix_cloud_onboarding_complete', 'true');
        }
        setOnboardingChecked(true);
      })
      .catch(() => {
        // On error, don't block — allow through
        setOnboardingChecked(true);
      });
  }, [user, skipOnboardingCheck]);

  if (loading || !onboardingChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-helix-500" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (shouldRedirectToWelcome && location.pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
}

import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useSystem } from './hooks/useSystem';
import { useGateway } from './hooks/useGateway';
import { useTheme } from './hooks/useTheme';
import { Onboarding } from './components/onboarding/Onboarding';
import { TenantProvider } from './lib/tenant-context';
import { router } from './routes';
import './App.css';

function App() {
  const { isFirstRun, markOnboarded } = useSystem();
  const { status, start } = useGateway();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [autoTriggeredOnboarding, setAutoTriggeredOnboarding] = useState(false);

  // Initialize theme
  useTheme();

  // Dev mode: Check for ?onboarding=true in URL or Ctrl+Shift+O shortcut
  useEffect(() => {
    // URL parameter check
    const params = new URLSearchParams(window.location.search);
    if (params.get('onboarding') === 'true') {
      setShowOnboarding(true);
      return;
    }

    // Keyboard shortcut: Ctrl+Shift+O to toggle onboarding
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'O') {
        e.preventDefault();
        if (!showOnboarding) {
          setShowOnboarding(true);
          setAutoTriggeredOnboarding(true); // Mark as user-triggered
        } else {
          setShowOnboarding(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Determine if we should show onboarding (with safeguard)
  useEffect(() => {
    if (isFirstRun !== null && !showOnboarding && !autoTriggeredOnboarding) {
      // Auto-trigger onboarding for first-time users
      if (isFirstRun) {
        setShowOnboarding(true);
        setAutoTriggeredOnboarding(true);
      }
    }
  }, [isFirstRun, showOnboarding, autoTriggeredOnboarding]);

  // Auto-start gateway when not in onboarding (after onboarding checks complete)
  useEffect(() => {
    if (isFirstRun !== null && !showOnboarding && !status.running) {
      // Only start gateway after first-run check completes and user is past onboarding
      start().catch((err) => {
        // Gateway is optional, log but don't fail
        console.debug('Gateway start failed (optional):', err);
      });
    }
  }, [isFirstRun, showOnboarding, status.running, start]);

  const handleOnboardingComplete = async () => {
    await markOnboarded();
    setShowOnboarding(false);
  };

  // Show loading while checking first run
  if (isFirstRun === null) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading Helix...</p>
      </div>
    );
  }

  // Show onboarding for first-time users
  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  // Main app with router and tenant provider
  return (
    <TenantProvider>
      <RouterProvider router={router} />
    </TenantProvider>
  );
}

export default App;

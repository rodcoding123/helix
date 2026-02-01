import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useSystem } from './hooks/useSystem';
import { useGateway } from './hooks/useGateway';
import { useTheme } from './hooks/useTheme';
import { Onboarding } from './components/onboarding/Onboarding';
import { router } from './routes';
import './App.css';

function App() {
  const { isFirstRun, markOnboarded } = useSystem();
  const { status, start } = useGateway();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Initialize theme
  useTheme();

  // Determine if we should show onboarding
  useEffect(() => {
    if (isFirstRun !== null) {
      setShowOnboarding(isFirstRun);
    }
  }, [isFirstRun]);

  // Auto-start gateway when not in onboarding
  useEffect(() => {
    if (!showOnboarding && !status.running) {
      start().catch(console.error);
    }
  }, [showOnboarding, status.running, start]);

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

  // Main app with router
  return <RouterProvider router={router} />;
}

export default App;

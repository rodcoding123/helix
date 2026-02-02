import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';

// Lazy load route components
const Chat = lazy(() => import('./Chat'));
const Settings = lazy(() => import('./Settings'));
const Psychology = lazy(() => import('./Psychology'));
const Memory = lazy(() => import('./Memory'));

// Loading fallback component
function RouteLoader() {
  return (
    <div className="route-loader">
      <div className="loading-spinner" />
    </div>
  );
}

// Wrap lazy components with Suspense
function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteLoader />}>{children}</Suspense>;
}

// Router configuration
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/chat" replace />,
      },
      {
        path: 'chat',
        element: (
          <LazyRoute>
            <Chat />
          </LazyRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <LazyRoute>
            <Settings />
          </LazyRoute>
        ),
      },
      {
        path: 'settings/:section',
        element: (
          <LazyRoute>
            <Settings />
          </LazyRoute>
        ),
      },
      {
        path: 'psychology',
        element: (
          <LazyRoute>
            <Psychology />
          </LazyRoute>
        ),
      },
      {
        path: 'psychology/:layer',
        element: (
          <LazyRoute>
            <Psychology />
          </LazyRoute>
        ),
      },
      {
        path: 'memory',
        element: (
          <LazyRoute>
            <Memory />
          </LazyRoute>
        ),
      },
    ],
  },
]);

// Route paths for navigation
export const ROUTES = {
  CHAT: '/chat',
  SETTINGS: '/settings',
  SETTINGS_GENERAL: '/settings/general',
  SETTINGS_MODEL: '/settings/model',
  SETTINGS_CHANNELS: '/settings/channels',
  SETTINGS_VOICE: '/settings/voice',
  SETTINGS_TOOLS: '/settings/tools',
  SETTINGS_AUTOMATION: '/settings/automation',
  SETTINGS_SKILLS: '/settings/skills',
  SETTINGS_AGENTS: '/settings/agents',
  SETTINGS_PRIVACY: '/settings/privacy',
  SETTINGS_PSYCHOLOGY: '/settings/psychology',
  PSYCHOLOGY: '/psychology',
  PSYCHOLOGY_LAYER: (layer: string) => `/psychology/${layer}`,
  MEMORY: '/memory',
} as const;

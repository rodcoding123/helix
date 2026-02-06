import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';

// Lazy load route components
const Chat = lazy(() => import('./Chat'));
const Settings = lazy(() => import('./Settings'));
const Psychology = lazy(() => import('./Psychology'));
const Memory = lazy(() => import('./Memory'));

// Phase 3: Custom Tools, Composite Skills, Memory Synthesis
const CustomTools = lazy(() => import('./CustomTools'));
const CompositeSkills = lazy(() => import('./CompositeSkills'));
const MemorySynthesis = lazy(() => import('./MemorySynthesis'));

// Phase 11 Week 3: Teams Management
const Teams = lazy(() => import('./Teams'));

// Phase 2: Orchestrator Control Center
const Orchestrator = lazy(() => import('./Orchestrator'));

// Phase A-J: Full Power routes
const Agents = lazy(() => import('./Agents'));
const Security = lazy(() => import('./Security'));
const Channels = lazy(() => import('./Channels'));
const Browser = lazy(() => import('./Browser'));
const Voice = lazy(() => import('./Voice'));
const Devices = lazy(() => import('./Devices'));
const Nodes = lazy(() => import('./Nodes'));
const Sessions = lazy(() => import('./Sessions'));

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
      {
        path: 'tools',
        element: (
          <LazyRoute>
            <CustomTools />
          </LazyRoute>
        ),
      },
      {
        path: 'skills',
        element: (
          <LazyRoute>
            <CompositeSkills />
          </LazyRoute>
        ),
      },
      {
        path: 'synthesis',
        element: (
          <LazyRoute>
            <MemorySynthesis />
          </LazyRoute>
        ),
      },
      {
        path: 'teams',
        element: (
          <LazyRoute>
            <Teams />
          </LazyRoute>
        ),
      },
      {
        path: 'orchestrator',
        element: (
          <LazyRoute>
            <Orchestrator />
          </LazyRoute>
        ),
      },
      // Phase A-J: Full Power routes
      {
        path: 'agents',
        element: (
          <LazyRoute>
            <Agents />
          </LazyRoute>
        ),
      },
      {
        path: 'agents/:agentId',
        element: (
          <LazyRoute>
            <Agents />
          </LazyRoute>
        ),
      },
      {
        path: 'security',
        element: (
          <LazyRoute>
            <Security />
          </LazyRoute>
        ),
      },
      {
        path: 'security/:requestId',
        element: (
          <LazyRoute>
            <Security />
          </LazyRoute>
        ),
      },
      {
        path: 'channels/:channelId',
        element: (
          <LazyRoute>
            <Channels />
          </LazyRoute>
        ),
      },
      {
        path: 'browser',
        element: (
          <LazyRoute>
            <Browser />
          </LazyRoute>
        ),
      },
      {
        path: 'voice',
        element: (
          <LazyRoute>
            <Voice />
          </LazyRoute>
        ),
      },
      {
        path: 'devices',
        element: (
          <LazyRoute>
            <Devices />
          </LazyRoute>
        ),
      },
      {
        path: 'devices/:deviceId',
        element: (
          <LazyRoute>
            <Devices />
          </LazyRoute>
        ),
      },
      {
        path: 'nodes',
        element: (
          <LazyRoute>
            <Nodes />
          </LazyRoute>
        ),
      },
      {
        path: 'nodes/:nodeId',
        element: (
          <LazyRoute>
            <Nodes />
          </LazyRoute>
        ),
      },
      {
        path: 'sessions',
        element: (
          <LazyRoute>
            <Sessions />
          </LazyRoute>
        ),
      },
      {
        path: 'sessions/:sessionId',
        element: (
          <LazyRoute>
            <Sessions />
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
  SETTINGS_SECRETS: '/settings/secrets',
  SETTINGS_HOOKS: '/settings/hooks',
  SETTINGS_ADVANCED: '/settings/advanced',
  SETTINGS_SHORTCUTS: '/settings/shortcuts',
  SETTINGS_AUTH_PROFILES: '/settings/auth-profiles',
  SETTINGS_FAILOVER: '/settings/failover',
  SETTINGS_ENVIRONMENT: '/settings/environment',
  PSYCHOLOGY: '/psychology',
  PSYCHOLOGY_LAYER: (layer: string) => `/psychology/${layer}`,
  MEMORY: '/memory',
  // Phase 3: Custom Tools, Composite Skills, Memory Synthesis
  CUSTOM_TOOLS: '/tools',
  COMPOSITE_SKILLS: '/skills',
  MEMORY_SYNTHESIS: '/synthesis',
  // Phase 11 Week 3: Teams Management
  TEAMS: '/teams',
  // Phase 2: Orchestrator
  ORCHESTRATOR: '/orchestrator',
  // Phase A-J: Full Power routes
  AGENTS: '/agents',
  AGENT_DETAIL: (id: string) => `/agents/${id}`,
  SECURITY: '/security',
  SECURITY_APPROVAL: (id: string) => `/security/${id}`,
  CHANNELS_DETAIL: (id: string) => `/channels/${id}`,
  BROWSER: '/browser',
  VOICE: '/voice',
  DEVICES: '/devices',
  DEVICE_DETAIL: (id: string) => `/devices/${id}`,
  NODES: '/nodes',
  NODE_DETAIL: (id: string) => `/nodes/${id}`,
  SESSIONS: '/sessions',
  SESSION_DETAIL: (id: string) => `/sessions/${id}`,
} as const;

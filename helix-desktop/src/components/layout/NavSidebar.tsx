/**
 * NavSidebar - Collapsible vertical navigation sidebar for Helix Desktop
 *
 * VS Code activity bar style: narrow (48px) showing only icons, expands to
 * 192px on hover to reveal labels. Active route highlighted with left border
 * accent and tinted background.
 *
 * Navigation groups: Main, Control, Infrastructure, Intelligence, plus
 * bottom-pinned Settings.
 */

import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/* ================================================================
   Navigation item / group types
   ================================================================ */

interface NavItem {
  /** Unique key for React rendering */
  id: string;
  /** Display label shown on hover/expanded */
  label: string;
  /** Route path to navigate to */
  path: string;
  /** SVG icon rendered as a React element */
  icon: React.ReactNode;
}

interface NavGroup {
  /** Group label shown in expanded state */
  label: string;
  items: NavItem[];
}

/* ================================================================
   Inline SVG Icons (18x18, outline style)
   ================================================================ */

function IconChat(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconAgents(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconSessions(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconSecurity(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconChannels(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 8.5L9 12l-3.5 3.5" />
      <circle cx="12" cy="12" r="10" />
      <line x1="14" y1="16" x2="18" y2="16" />
    </svg>
  );
}

function IconBrowser(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IconDevices(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function IconNodes(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

function IconVoice(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconMemory(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10" />
      <path d="M12 2c3 3.5 4 8 1 12" />
      <path d="M22 12c-3-3.5-8-4-12-1" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconPsychology(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconOrchestrator(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function IconSettings(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/* ================================================================
   Navigation data
   ================================================================ */

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { id: 'chat',     label: 'Chat',     path: '/chat',     icon: <IconChat /> },
      { id: 'agents',   label: 'Agents',   path: '/agents',   icon: <IconAgents /> },
      { id: 'sessions', label: 'Sessions', path: '/sessions', icon: <IconSessions /> },
    ],
  },
  {
    label: 'Control',
    items: [
      { id: 'security', label: 'Security', path: '/security', icon: <IconSecurity /> },
      { id: 'channels', label: 'Channels', path: '/channels', icon: <IconChannels /> },
      { id: 'browser',  label: 'Browser',  path: '/browser',  icon: <IconBrowser /> },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { id: 'devices', label: 'Devices', path: '/devices', icon: <IconDevices /> },
      { id: 'nodes',   label: 'Nodes',   path: '/nodes',   icon: <IconNodes /> },
      { id: 'voice',   label: 'Voice',   path: '/voice',   icon: <IconVoice /> },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { id: 'memory',       label: 'Memory',       path: '/memory',       icon: <IconMemory /> },
      { id: 'psychology',   label: 'Psychology',   path: '/psychology',   icon: <IconPsychology /> },
      { id: 'orchestrator', label: 'Orchestrator', path: '/orchestrator', icon: <IconOrchestrator /> },
    ],
  },
];

const BOTTOM_ITEM: NavItem = {
  id: 'settings',
  label: 'Settings',
  path: '/settings',
  icon: <IconSettings />,
};

/* ================================================================
   Route matching helper
   ================================================================ */

/**
 * Determines if a nav item is "active" based on the current location pathname.
 * Matches exact path or any sub-path (e.g., /settings matches /settings/general).
 */
function isRouteActive(itemPath: string, currentPath: string): boolean {
  if (currentPath === itemPath) return true;
  // Match sub-paths: /agents/abc should highlight the /agents nav item
  if (currentPath.startsWith(itemPath + '/')) return true;
  return false;
}

/* ================================================================
   NavSidebar Component
   ================================================================ */

export function NavSidebar(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  return (
    <nav className="nav-sidebar" aria-label="Main navigation">
      {/* Scrollable main navigation area */}
      <div className="nav-sidebar-main">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="nav-sidebar-group">
            <div className="nav-sidebar-group-label">{group.label}</div>
            {group.items.map((item) => {
              const active = isRouteActive(item.path, location.pathname);
              return (
                <button
                  key={item.id}
                  className={`nav-sidebar-item${active ? ' nav-sidebar-item--active' : ''}`}
                  onClick={() => handleNavClick(item.path)}
                  title={item.label}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="nav-sidebar-item-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="nav-sidebar-item-label">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom-pinned settings */}
      <div className="nav-sidebar-bottom">
        {(() => {
          const active = isRouteActive(BOTTOM_ITEM.path, location.pathname);
          return (
            <button
              className={`nav-sidebar-item${active ? ' nav-sidebar-item--active' : ''}`}
              onClick={() => handleNavClick(BOTTOM_ITEM.path)}
              title={BOTTOM_ITEM.label}
              aria-current={active ? 'page' : undefined}
            >
              <span className="nav-sidebar-item-icon" aria-hidden="true">
                {BOTTOM_ITEM.icon}
              </span>
              <span className="nav-sidebar-item-label">{BOTTOM_ITEM.label}</span>
            </button>
          );
        })()}
      </div>
    </nav>
  );
}

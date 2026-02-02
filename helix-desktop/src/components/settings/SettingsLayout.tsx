import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../routes';
import './SettingsLayout.css';

interface SettingsLayoutProps {
  activeSection: string;
  children: React.ReactNode;
}

interface SettingsNavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

interface NavGroup {
  label: string;
  items: SettingsNavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Core',
    items: [
      { id: 'general', label: 'General', icon: '⚙️', path: ROUTES.SETTINGS_GENERAL },
      { id: 'model', label: 'Model & Provider', icon: '🤖', path: ROUTES.SETTINGS_MODEL },
      { id: 'agents', label: 'Agents', icon: '🎭', path: ROUTES.SETTINGS_AGENTS },
    ],
  },
  {
    label: 'Communication',
    items: [
      { id: 'channels', label: 'Channels', icon: '💬', path: ROUTES.SETTINGS_CHANNELS },
      { id: 'voice', label: 'Voice & TTS', icon: '🔊', path: ROUTES.SETTINGS_VOICE },
    ],
  },
  {
    label: 'Capabilities',
    items: [
      { id: 'tools', label: 'Tools & Sandbox', icon: '🔧', path: ROUTES.SETTINGS_TOOLS },
      { id: 'skills', label: 'Skills', icon: '⚡', path: ROUTES.SETTINGS_SKILLS },
      { id: 'automation', label: 'Automation', icon: '🔄', path: ROUTES.SETTINGS_AUTOMATION },
    ],
  },
  {
    label: 'Helix',
    items: [
      { id: 'psychology', label: 'Psychology', icon: '🧠', path: ROUTES.SETTINGS_PSYCHOLOGY },
      { id: 'privacy', label: 'Privacy & Security', icon: '🔒', path: ROUTES.SETTINGS_PRIVACY },
    ],
  },
];

// Flat list for backward compatibility (used by external components)
export const NAV_ITEMS: SettingsNavItem[] = NAV_GROUPS.flatMap(g => g.items);

export function SettingsLayout({ activeSection, children }: SettingsLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="settings-layout">
      <aside className="settings-sidebar">
        <header className="settings-sidebar-header">
          <h2>Settings</h2>
        </header>

        <nav className="settings-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="settings-nav-group">
              <span className="settings-nav-group-label">{group.label}</span>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`settings-nav-item ${activeSection === item.id ? 'active' : ''}`}
                  onClick={() => navigate(item.path)}
                >
                  <span className="settings-nav-icon">{item.icon}</span>
                  <span className="settings-nav-label">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <footer className="settings-sidebar-footer">
          <button
            className="settings-back-button"
            onClick={() => navigate(ROUTES.CHAT)}
          >
            ← Back to Chat
          </button>
        </footer>
      </aside>

      <main className="settings-content">
        {children}
      </main>
    </div>
  );
}

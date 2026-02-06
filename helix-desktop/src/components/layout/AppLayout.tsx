import { ReactNode, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import { TitleBar } from './TitleBar';
import { NavSidebar } from './NavSidebar';
import { StatusBar } from './StatusBar';
import { CommandPalette } from '../common/CommandPalette';
import { useGatewayConfig } from '../../hooks/useGatewayConfig';
import { useDeepLink } from '../../hooks/useDeepLink';
import { useTraySync } from '../../hooks/useTraySync';
import {
  useGlobalShortcuts,
  DEFAULT_SHORTCUT_BINDINGS,
} from '../../hooks/useGlobalShortcuts';
import type { ShortcutDefinition } from '../../hooks/useGlobalShortcuts';
import { ROUTES } from '../../routes';
import './AppLayout.css';

interface AppLayoutProps {
  children?: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  // Sync gateway config on connect - the hook auto-fetches when gateway connects
  useGatewayConfig();

  // Phase J: Listen for helix:// deep links and navigate accordingly
  useDeepLink();

  // Phase J2: Push live state to system tray + listen for tray menu events
  useTraySync();

  const navigate = useNavigate();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const closeCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false);
  }, []);

  // Wire up global shortcuts with actual actions
  const shortcuts: ShortcutDefinition[] = useMemo(() => {
    return DEFAULT_SHORTCUT_BINDINGS.map((binding) => ({
      ...binding,
      action: (): void => {
        switch (binding.id) {
          case 'new-chat':
            navigate(ROUTES.CHAT);
            break;
          case 'command-palette':
            setCommandPaletteOpen((prev) => !prev);
            break;
          case 'open-settings':
            navigate(ROUTES.SETTINGS);
            break;
          case 'toggle-talk-mode':
            navigate(ROUTES.VOICE);
            break;
          case 'open-approvals':
            navigate(ROUTES.SECURITY);
            break;
          case 'toggle-theme':
            document.documentElement.classList.toggle('light');
            break;
          case 'close-overlay':
            setCommandPaletteOpen(false);
            break;
        }
      },
    }));
  }, [navigate]);

  useGlobalShortcuts({ shortcuts, enabled: true });

  return (
    <div className="app-layout">
      <TitleBar />
      <div className="app-body">
        <NavSidebar />
        <main className="app-content">
          {children || <Outlet />}
        </main>
      </div>
      <StatusBar />
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={closeCommandPalette}
      />
    </div>
  );
}

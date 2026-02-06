import { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { TitleBar } from './TitleBar';
import { StatusBar } from './StatusBar';
import { useGatewayConfig } from '../../hooks/useGatewayConfig';
import { useDeepLink } from '../../hooks/useDeepLink';
import './AppLayout.css';

interface AppLayoutProps {
  children?: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  // Sync gateway config on connect - the hook auto-fetches when gateway connects
  useGatewayConfig();

  // Phase J: Listen for helix:// deep links and navigate accordingly
  useDeepLink();

  return (
    <div className="app-layout">
      <TitleBar />
      <main className="app-content">
        {/* Use Outlet for router, children for direct usage */}
        {children || <Outlet />}
      </main>
      <StatusBar />
    </div>
  );
}

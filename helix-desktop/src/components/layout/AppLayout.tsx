import { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { TitleBar } from './TitleBar';
import { StatusBar } from './StatusBar';
import './AppLayout.css';

interface AppLayoutProps {
  children?: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
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

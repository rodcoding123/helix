/**
 * Mobile Layout Component
 * Week 5 Track 6.2: Mobile PWA Responsive Components
 * Main responsive container for mobile interface
 */

import React from 'react';
import { MobileNavigation, MobileTab } from './MobileNavigation';

interface MobileLayoutProps {
  children: React.ReactNode;
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  unreadCount?: number;
  showNavigation?: boolean;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  unreadCount = 0,
  showNavigation = true,
}) => {
  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>

      {/* Mobile Navigation */}
      {showNavigation && (
        <MobileNavigation
          activeTab={activeTab}
          onTabChange={onTabChange}
          unreadCount={unreadCount}
        />
      )}
    </div>
  );
};

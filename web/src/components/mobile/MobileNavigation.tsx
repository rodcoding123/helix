/**
 * Mobile Navigation Bar Component
 * Week 5 Track 6.2: Mobile PWA Responsive Components
 * Bottom tab navigation for mobile
 */

import React from 'react';

export type MobileTab = 'email' | 'calendar' | 'voice' | 'settings';

interface MobileNavigationProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  unreadCount?: number;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  activeTab,
  onTabChange,
  unreadCount = 0,
}) => {
  const tabs = [
    { id: 'email' as MobileTab, label: 'Email', icon: '✉️' },
    { id: 'calendar' as MobileTab, label: 'Calendar', icon: '📅' },
    { id: 'voice' as MobileTab, label: 'Voice', icon: '🎤' },
    { id: 'settings' as MobileTab, label: 'Settings', icon: '⚙️' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 px-4 py-2 z-40">
      <div className="flex justify-around items-center">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center gap-1 px-4 py-3 rounded-lg transition-colors relative touch-target ${
              activeTab === tab.id
                ? 'text-blue-400 bg-slate-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="text-xs font-medium">{tab.label}</span>

            {/* Badge for unread emails */}
            {tab.id === 'email' && unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};

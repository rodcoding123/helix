/**
 * Calendar Hub Page
 * Phase 5 Track 2: Central interface for calendar management
 *
 * Features:
 * - Account management (add, remove, switch)
 * - Calendar views (month, week, day)
 * - Event management
 * - Conflict detection
 * - Calendar analytics
 */

import { FC, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { CalendarAccountSetup } from '@/components/calendar/CalendarAccountSetup';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { Calendar, Plus, Settings } from 'lucide-react';

type CalendarTab = 'calendar' | 'agenda' | 'analytics' | 'settings';
type CalendarView = 'month' | 'week' | 'day';

/**
 * Calendar Hub Page - Main interface for calendar management
 */
export const CalendarPage: FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<CalendarTab>('calendar');
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const [showAccountSetup, setShowAccountSetup] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Permission check
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="animate-spin mb-4 text-2xl">⟳</div>
          <p className="text-slate-400">Loading calendar...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <p className="text-slate-400">Please log in to use calendar features</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-blue-400" />
              <div>
                <h1 className="text-2xl font-bold text-slate-100">Calendar</h1>
                <p className="text-sm text-slate-400">Manage your events and schedules</p>
              </div>
            </div>
            <button
              onClick={() => setShowAccountSetup(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Calendar
            </button>
          </div>
        </div>
      </div>

      {/* Account Setup Modal */}
      {showAccountSetup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-lg border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-100">Add Calendar Account</h2>
              <button
                onClick={() => setShowAccountSetup(false)}
                className="text-slate-400 hover:text-slate-300"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <CalendarAccountSetup
                onAccountAdded={() => setShowAccountSetup(false)}
                onCancel={() => setShowAccountSetup(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-slate-700 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-8 overflow-x-auto" role="tablist">
            {/* Calendar Tab */}
            <button
              onClick={() => setActiveTab('calendar')}
              role="tab"
              aria-selected={activeTab === 'calendar'}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'calendar'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              Calendar
            </button>

            {/* Agenda Tab */}
            <button
              onClick={() => setActiveTab('agenda')}
              role="tab"
              aria-selected={activeTab === 'agenda'}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'agenda'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              📋 Agenda
            </button>

            {/* Analytics Tab */}
            <button
              onClick={() => setActiveTab('analytics')}
              role="tab"
              aria-selected={activeTab === 'analytics'}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'analytics'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              📊 Analytics
            </button>

            {/* Settings Tab */}
            <button
              onClick={() => setActiveTab('settings')}
              role="tab"
              aria-selected={activeTab === 'settings'}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Settings
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <div className="space-y-6">
            <CalendarGrid
              events={[] as any}
              {...({ view: calendarView } as any)}
              onViewChange={setCalendarView}
              onEventSelect={(eventId) => console.log('Selected:', eventId)}
            />
          </div>
        )}

        {/* Agenda Tab */}
        {activeTab === 'agenda' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-slate-100 mb-2">Agenda</h2>
            <p className="text-slate-400 mb-6">
              View your upcoming events in list format
            </p>

            {isLoadingEvents ? (
              <div className="animate-spin mb-4 text-2xl">⟳</div>
            ) : upcomingEvents.length > 0 ? (
              <div className="space-y-2 text-left max-w-2xl mx-auto">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-4 bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    <h3 className="font-semibold text-slate-100">{event.title}</h3>
                    <p className="text-sm text-slate-400">{event.time}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400">No upcoming events</p>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-slate-100 mb-2">Calendar Analytics</h2>
            <p className="text-slate-400 mb-6">
              Insights into your calendar usage and meeting patterns
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Total Meetings</p>
                <p className="text-2xl font-bold text-blue-400">0</p>
              </div>
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Free Time Today</p>
                <p className="text-2xl font-bold text-green-400">8h</p>
              </div>
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Conflicts</p>
                <p className="text-2xl font-bold text-red-400">0</p>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-slate-100 mb-2">Calendar Settings</h2>
            <p className="text-slate-400">
              Manage your calendar preferences and integrations
            </p>

            <div className="mt-6 max-w-2xl mx-auto text-left space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-100 mb-2">
                  Default Calendar View
                </label>
                <select className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100">
                  <option>Month</option>
                  <option>Week</option>
                  <option>Day</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-100 mb-2">
                  Timezone
                </label>
                <select className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100">
                  <option>America/New_York</option>
                  <option>America/Los_Angeles</option>
                  <option>Europe/London</option>
                  <option>Asia/Tokyo</option>
                  <option>UTC</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 rounded bg-slate-700 border-slate-600"
                  />
                  <span className="text-sm text-slate-300">Show conflict warnings</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-700 bg-slate-900/30 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-400">📅</div>
              <p className="text-slate-400 text-sm mt-2">View & Manage</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">🔔</div>
              <p className="text-slate-400 text-sm mt-2">Smart Reminders</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">⚡</div>
              <p className="text-slate-400 text-sm mt-2">Conflict Detection</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;

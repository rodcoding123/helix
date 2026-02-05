/**
 * Email Hub Page
 * Phase 5 Track 1: Central interface for email management
 *
 * Features:
 * - Account management (add, remove, switch)
 * - Email inbox with filtering
 * - Email search
 * - Email composition (coming soon)
 * - Email analytics (coming soon)
 */

import { FC, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { EmailAccountSetup } from '@/components/email/EmailAccountSetup';
import { EmailInbox } from '@/components/email/EmailInbox';
import { Mail, Plus, Settings } from 'lucide-react';

type EmailTab = 'inbox' | 'compose' | 'search' | 'analytics' | 'settings';

/**
 * Email Hub Page - Main interface for email management
 */
export const Email: FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<EmailTab>('inbox');
  const [showAccountSetup, setShowAccountSetup] = useState(false);

  // Permission check
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="animate-spin mb-4 text-2xl">⟳</div>
          <p className="text-slate-400">Loading email features...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <p className="text-slate-400">Please log in to use email features</p>
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
              <Mail className="w-8 h-8 text-blue-400" />
              <div>
                <h1 className="text-2xl font-bold text-slate-100">Email</h1>
                <p className="text-sm text-slate-400">Manage your email accounts and messages</p>
              </div>
            </div>
            <button
              onClick={() => setShowAccountSetup(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          </div>
        </div>
      </div>

      {/* Account Setup Modal */}
      {showAccountSetup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-lg border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-100">Add Email Account</h2>
              <button
                onClick={() => setShowAccountSetup(false)}
                className="text-slate-400 hover:text-slate-300"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <EmailAccountSetup
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
            {/* Inbox Tab */}
            <button
              onClick={() => setActiveTab('inbox')}
              role="tab"
              aria-selected={activeTab === 'inbox'}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'inbox'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <Mail className="w-4 h-4 inline mr-2" />
              Inbox
            </button>

            {/* Compose Tab */}
            <button
              onClick={() => setActiveTab('compose')}
              role="tab"
              aria-selected={activeTab === 'compose'}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'compose'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Compose
            </button>

            {/* Search Tab */}
            <button
              onClick={() => setActiveTab('search')}
              role="tab"
              aria-selected={activeTab === 'search'}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'search'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              Search Emails
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
              Analytics
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
        {/* Inbox Tab */}
        {activeTab === 'inbox' && (
          <div className="space-y-6">
            <EmailInbox onEmailSelected={(emailId) => console.log('Selected:', emailId)} />
          </div>
        )}

        {/* Compose Tab */}
        {activeTab === 'compose' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
            <Plus className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-100 mb-2">Compose Email</h2>
            <p className="text-slate-400 mb-6">Coming soon in Phase 5.1</p>
            <button className="px-4 py-2 bg-blue-600/30 text-blue-400 rounded-lg hover:bg-blue-600/40 transition-colors disabled opacity-50">
              Compose
            </button>
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-slate-100 mb-2">Search Emails</h2>
            <p className="text-slate-400 mb-6">Coming soon in Phase 5.1</p>
            <input
              type="text"
              placeholder="Search emails..."
              className="w-full max-w-md px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 disabled:opacity-50"
              disabled
            />
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-slate-100 mb-2">Email Analytics</h2>
            <p className="text-slate-400">Coming soon in Phase 5.1</p>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-slate-100 mb-2">Email Settings</h2>
            <p className="text-slate-400">Manage your email preferences and integrations</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-700 bg-slate-900/30 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-400">📧</div>
              <p className="text-slate-400 text-sm mt-2">Sync & Manage</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">🔍</div>
              <p className="text-slate-400 text-sm mt-2">Search & Find</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">📊</div>
              <p className="text-slate-400 text-sm mt-2">Analyze & Insights</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Email;

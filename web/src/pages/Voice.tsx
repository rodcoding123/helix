/**
 * Voice Hub Page
 * Phase 4.1: Comprehensive voice features including memos, transcripts, commands, and voicemail
 *
 * Main hub for all voice functionality:
 * - Record and manage voice memos
 * - Search voice memo transcripts
 * - Create and manage voice commands
 * - View and manage voicemail messages
 */

import React, { FC, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Mic, MessageSquareVoice, MessageCircle, Settings } from 'lucide-react';

// Voice components
import { VoiceMemoRecorder } from '@/components/voice/VoiceMemoRecorder';
import { VoiceMemoList } from '@/components/voice/VoiceMemoList';
import { VoiceTranscriptSearch } from '@/components/voice/VoiceTranscriptSearch';
import { VoiceCommandManager } from '@/components/voice/VoiceCommandManager';
import { VoicemailInbox } from '@/components/voice/VoicemailInbox';

type VoiceTab = 'record' | 'memos' | 'search' | 'commands' | 'voicemail';

/**
 * Voice Hub Page - Main interface for all voice features
 */
export const Voice: FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<VoiceTab>('record');
  const [unreadVoicemailCount, setUnreadVoicemailCount] = useState(0);

  // Permission check
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="animate-spin mb-4">🎤</div>
          <p className="text-slate-400">Loading voice features...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <p className="text-slate-400">Please log in to use voice features</p>
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
              <Mic className="w-8 h-8 text-blue-400" />
              <div>
                <h1 className="text-2xl font-bold text-slate-100">Voice Hub</h1>
                <p className="text-sm text-slate-400">Record, transcribe, search, and manage voice features</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-700 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-8 overflow-x-auto" role="tablist">
            {/* Record Tab */}
            <button
              onClick={() => setActiveTab('record')}
              role="tab"
              aria-selected={activeTab === 'record'}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'record'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <Mic className="w-4 h-4 inline mr-2" />
              Record
            </button>

            {/* Memos Tab */}
            <button
              onClick={() => setActiveTab('memos')}
              role="tab"
              aria-selected={activeTab === 'memos'}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'memos'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <MessageSquareVoice className="w-4 h-4 inline mr-2" />
              My Memos
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
              Search Transcripts
            </button>

            {/* Commands Tab */}
            <button
              onClick={() => setActiveTab('commands')}
              role="tab"
              aria-selected={activeTab === 'commands'}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'commands'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Voice Commands
            </button>

            {/* Voicemail Tab */}
            <button
              onClick={() => setActiveTab('voicemail')}
              role="tab"
              aria-selected={activeTab === 'voicemail'}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'voicemail'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <MessageCircle className="w-4 h-4 inline mr-2" />
              Voicemail
              {unreadVoicemailCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                  {unreadVoicemailCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Record Tab */}
        {activeTab === 'record' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">Record Voice Memo</h2>
              <VoiceMemoRecorder
                onMemoSaved={() => {
                  // Switch to memos tab to show the new memo
                  setActiveTab('memos');
                }}
              />
            </div>

            <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
              <h3 className="font-semibold text-blue-400 mb-2">💡 Tips for Best Results</h3>
              <ul className="text-sm text-blue-300 space-y-1">
                <li>• Speak clearly and at a normal pace</li>
                <li>• Use a quiet environment for better transcription accuracy</li>
                <li>• Add a title to help you find the memo later</li>
                <li>• Use tags to organize your memos by topic</li>
              </ul>
            </div>
          </div>
        )}

        {/* Memos Tab */}
        {activeTab === 'memos' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">My Voice Memos</h2>
              <VoiceMemoList
                onMemoSelected={(memo) => {
                  // Could open memo detail view
                  console.log('Selected memo:', memo);
                }}
              />
            </div>
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">Search Voice Transcripts</h2>
              <VoiceTranscriptSearch
                onSelectMemo={(memo) => {
                  // Could open memo detail view
                  console.log('Selected memo from search:', memo);
                }}
              />
            </div>

            <div className="bg-purple-500/10 border border-purple-500/50 rounded-lg p-4">
              <h3 className="font-semibold text-purple-400 mb-2">🔍 Search Tips</h3>
              <ul className="text-sm text-purple-300 space-y-1">
                <li>• Use multiple keywords to narrow results</li>
                <li>• Filter by date range for older memos</li>
                <li>• Check confidence scores to see transcription quality</li>
                <li>• Save frequently used searches as quick filters</li>
              </ul>
            </div>
          </div>
        )}

        {/* Commands Tab */}
        {activeTab === 'commands' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">Voice Commands</h2>
              <VoiceCommandManager
                onCommandExecuted={(command) => {
                  console.log('Executed command:', command);
                }}
              />
            </div>

            <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4">
              <h3 className="font-semibold text-green-400 mb-2">🎙️ Voice Command Guide</h3>
              <ul className="text-sm text-green-300 space-y-1">
                <li>• Create simple voice triggers for your favorite actions</li>
                <li>• Commands are matched using fuzzy matching (typos are OK)</li>
                <li>• Use the test feature to verify command matching</li>
                <li>• Track usage statistics for your most-used commands</li>
              </ul>
            </div>
          </div>
        )}

        {/* Voicemail Tab */}
        {activeTab === 'voicemail' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">Voicemail</h2>
              <VoicemailInbox
                onUnreadCountChange={(count) => {
                  setUnreadVoicemailCount(count);
                }}
              />
            </div>

            <div className="bg-orange-500/10 border border-orange-500/50 rounded-lg p-4">
              <h3 className="font-semibold text-orange-400 mb-2">📞 Voicemail Info</h3>
              <ul className="text-sm text-orange-300 space-y-1">
                <li>• Voicemail messages are automatically transcribed</li>
                <li>• Mark important messages to flag them</li>
                <li>• Search voicemail transcripts for quick lookup</li>
                <li>• Archive old messages to clean up your inbox</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-700 bg-slate-900/30 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-400">🎤</div>
              <p className="text-slate-400 text-sm mt-2">Record & Save</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">🔍</div>
              <p className="text-slate-400 text-sm mt-2">Search & Discover</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">⚡</div>
              <p className="text-slate-400 text-sm mt-2">Command & Control</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Voice;

import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import { useConversations } from '@/hooks/useConversations';
import { SessionListItem } from './SessionListItem';
import { SessionSearchBar } from './SessionSearchBar';

interface SessionSidebarProps {
  currentSessionKey?: string;
  onSessionSelect: (sessionKey: string) => void;
  onNewSession: (sessionKey: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function SessionSidebar({
  currentSessionKey,
  onSessionSelect,
  onNewSession,
  isCollapsed = false,
  onToggleCollapse,
}: SessionSidebarProps): JSX.Element {
  const {
    conversations,
    isLoading,
    error,
    filteredConversations,
    searchQuery,
    setSearchQuery,
    createConversation,
    deleteConversation,
    archiveConversation,
  } = useConversations();

  const [isCreating, setIsCreating] = useState(false);

  const handleCreateNew = async () => {
    try {
      setIsCreating(true);
      const newConversation = await createConversation();
      onNewSession(newConversation.sessionKey);
      onSessionSelect(newConversation.sessionKey);
    } catch (err) {
      console.error('Error creating conversation:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteConversation = async (sessionKey: string) => {
    if (!window.confirm('Delete this conversation? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteConversation(sessionKey);
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  };

  const handleArchiveConversation = async (sessionKey: string, isArchived: boolean) => {
    try {
      await archiveConversation(sessionKey, isArchived);
    } catch (err) {
      console.error('Error archiving conversation:', err);
    }
  };

  return (
    <motion.aside
      className={clsx(
        'flex flex-col h-full',
        'bg-white/[0.02] backdrop-blur-xl',
        'border-r border-white/[0.06]',
        isCollapsed ? 'w-0' : 'w-80'
      )}
      animate={{ width: isCollapsed ? 0 : 320 }}
      transition={{ duration: 0.3 }}
      aria-label="Conversation list sidebar"
    >
      {!isCollapsed && (
        <>
          {/* ─── Header ─── */}
          <div className="flex-shrink-0 px-4 py-4 border-b border-white/[0.06]">
            <motion.button
              onClick={handleCreateNew}
              disabled={isCreating}
              className={clsx(
                'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg',
                'font-medium text-sm transition-all duration-200',
                'bg-helix-500 text-white hover:bg-helix-600',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="h-4 w-4" />
              New chat
            </motion.button>
          </div>

          {/* ─── Search Bar ─── */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.06]">
            <SessionSearchBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </div>

          {/* ─── Content ─── */}
          <motion.div
            className="flex-1 overflow-y-auto overflow-x-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  className="flex items-center justify-center h-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="text-center">
                    <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-helix-400 animate-spin mx-auto mb-2" />
                    <p className="text-xs text-text-tertiary">Loading chats...</p>
                  </div>
                </motion.div>
              ) : error ? (
                <motion.div
                  key="error"
                  className="flex items-center justify-center h-full px-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="text-center">
                    <p className="text-xs text-red-400 mb-2">Error loading chats</p>
                    <p className="text-[11px] text-text-tertiary">{error}</p>
                  </div>
                </motion.div>
              ) : filteredConversations.length === 0 ? (
                <motion.div
                  key="empty"
                  className="flex items-center justify-center h-full px-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="text-center">
                    <MessageSquare className="h-8 w-8 text-text-tertiary/50 mx-auto mb-2" />
                    <p className="text-xs text-text-tertiary">
                      {searchQuery
                        ? 'No conversations match your search'
                        : 'No conversations yet'}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  className="px-2 py-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <AnimatePresence>
                    {filteredConversations.map((conversation, index) => (
                      <motion.div
                        key={conversation.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <SessionListItem
                          conversation={conversation}
                          isActive={conversation.sessionKey === currentSessionKey}
                          onClick={() => onSessionSelect(conversation.sessionKey)}
                          onDelete={handleDeleteConversation}
                          onArchive={handleArchiveConversation}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ─── Footer ─── */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-white/[0.06] text-[11px] text-text-tertiary">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </div>
        </>
      )}
    </motion.aside>
  );
}

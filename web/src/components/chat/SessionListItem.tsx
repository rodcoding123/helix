import { motion } from 'framer-motion';
import { Trash2, Archive } from 'lucide-react';
import clsx from 'clsx';
import type { Conversation } from '@/hooks/useConversations';

interface SessionListItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onDelete: (sessionKey: string) => Promise<void>;
  onArchive: (sessionKey: string, isArchived: boolean) => Promise<void>;
}

export function SessionListItem({
  conversation,
  isActive,
  onClick,
  onDelete,
  onArchive,
}: SessionListItemProps): JSX.Element {
  const formattedDate = new Date(conversation.updatedAt).toLocaleDateString(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      year: new Date(conversation.updatedAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    }
  );

  return (
    <motion.button
      onClick={onClick}
      className={clsx(
        'w-full text-left px-3 py-2 rounded-lg transition-all duration-200',
        'hover:bg-white/5 active:bg-white/10',
        isActive
          ? 'bg-white/10 border border-white/20'
          : 'bg-transparent border border-transparent'
      )}
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="text-sm font-medium text-white truncate leading-tight">
            {conversation.title || 'New conversation'}
          </h3>

          {/* Metadata */}
          <div className="mt-1 flex items-center gap-2 text-xs text-text-tertiary">
            <span>{conversation.messageCount} messages</span>
            <span className="text-white/20">•</span>
            <span>{formattedDate}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex-shrink-0 flex gap-1">
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              void onArchive(conversation.sessionKey, true);
            }}
            className="p-1.5 rounded hover:bg-white/10 transition-colors text-text-tertiary hover:text-white"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            title="Archive conversation"
          >
            <Archive className="h-3.5 w-3.5" />
          </motion.button>

          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              void onDelete(conversation.sessionKey);
            }}
            className="p-1.5 rounded hover:bg-red-500/10 transition-colors text-text-tertiary hover:text-red-400"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            title="Delete conversation"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </motion.button>
        </div>
      </div>
    </motion.button>
  );
}

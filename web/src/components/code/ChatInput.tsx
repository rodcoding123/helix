import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, StopCircle, Paperclip, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  onInterrupt?: () => void;
  onVoiceStart?: () => void;
  isProcessing?: boolean;
  isConnected?: boolean;
  placeholder?: string;
  className?: string;
}

export function ChatInput({
  onSend,
  onInterrupt,
  onVoiceStart,
  isProcessing = false,
  isConnected = true,
  placeholder = 'Ask Helix anything...',
  className,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSubmit = () => {
    const trimmed = message.trim();
    if (trimmed && !isProcessing && isConnected) {
      onSend(trimmed);
      setMessage('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSend = message.trim().length > 0 && !isProcessing && isConnected;

  return (
    <div className={cn('rounded-lg border border-slate-700 bg-slate-900/80 backdrop-blur', className)}>
      <div className="flex items-end gap-2 p-3">
        {/* Attachment button (future) */}
        <button
          type="button"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          title="Attach file (coming soon)"
          disabled
        >
          <Paperclip className="h-5 w-5" />
        </button>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? placeholder : 'Connecting to Helix...'}
            disabled={!isConnected}
            rows={1}
            className={cn(
              'w-full resize-none rounded-lg bg-slate-800/50 px-4 py-3',
              'text-slate-200 placeholder:text-slate-500',
              'border border-slate-700 focus:border-helix-500 focus:ring-1 focus:ring-helix-500',
              'transition-colors outline-none',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
        </div>

        {/* Voice button */}
        {onVoiceStart && (
          <button
            type="button"
            onClick={onVoiceStart}
            disabled={!isConnected || isProcessing}
            className={cn(
              'p-2 rounded-lg transition-colors',
              isConnected
                ? 'text-slate-400 hover:text-helix-400 hover:bg-slate-800'
                : 'text-slate-600 cursor-not-allowed'
            )}
            title="Voice input (coming soon)"
          >
            <Mic className="h-5 w-5" />
          </button>
        )}

        {/* Send/Stop button */}
        {isProcessing ? (
          <button
            type="button"
            onClick={onInterrupt}
            className="p-2 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors"
            title="Stop generation"
          >
            <StopCircle className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSend}
            className={cn(
              'p-2 rounded-lg transition-colors',
              canSend
                ? 'bg-helix-500 text-white hover:bg-helix-600'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            )}
            title="Send message"
          >
            <Send className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Character count and hints */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-700/50 text-xs text-slate-500">
        <span>Press Enter to send, Shift+Enter for new line</span>
        <span>{message.length}/10000</span>
      </div>
    </div>
  );
}

/**
 * Chat Input - Enhanced input with slash commands and keyboard shortcuts
 */

import { KeyboardEvent, ChangeEvent, useRef, useState, useEffect } from 'react';
import { CommandAutocomplete } from './CommandAutocomplete';
import { parseInput } from '../../hooks/useSlashCommands';
import './ChatInput.css';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCommand: (command: string, args: string) => void;
  onBash: (command: string) => void;
  onInterrupt: () => void;
  onAgentSelect?: () => void;
  onModelSelect?: () => void;
  onSessionSelect?: () => void;
  onNewSession?: () => void;
  onToggleThinking?: () => void;
  isStreaming: boolean;
  disabled: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onCommand,
  onBash,
  onInterrupt,
  onAgentSelect,
  onModelSelect,
  onSessionSelect,
  onNewSession,
  onToggleThinking,
  isStreaming,
  disabled,
  placeholder,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [ctrlCPressed, setCtrlCPressed] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  // Show autocomplete when typing slash commands
  useEffect(() => {
    setShowAutocomplete(value.trim().startsWith('/') && value.trim().length > 0);
  }, [value]);

  // Reset Ctrl+C state after timeout
  useEffect(() => {
    if (ctrlCPressed) {
      const timer = setTimeout(() => setCtrlCPressed(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [ctrlCPressed]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without shift - submit
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }

    // Alt+Enter - insert newline (handled by default, but prevent submit)
    if (e.key === 'Enter' && e.altKey) {
      return;
    }

    // Escape - interrupt or clear
    if (e.key === 'Escape') {
      e.preventDefault();
      if (isStreaming) {
        onInterrupt();
      } else if (showAutocomplete) {
        setShowAutocomplete(false);
      } else if (value.trim()) {
        onChange('');
      }
      return;
    }

    // Ctrl+C - clear input or double-press to interrupt
    if (e.key === 'c' && e.ctrlKey) {
      if (!value.trim()) {
        if (ctrlCPressed) {
          // Double Ctrl+C - could exit/interrupt
          onInterrupt();
        } else {
          setCtrlCPressed(true);
        }
      }
      return;
    }

    // Ctrl+G - agent selector
    if (e.key === 'g' && e.ctrlKey) {
      e.preventDefault();
      onAgentSelect?.();
      return;
    }

    // Ctrl+L - model selector
    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      onModelSelect?.();
      return;
    }

    // Ctrl+P - session selector
    if (e.key === 'p' && e.ctrlKey) {
      e.preventDefault();
      onSessionSelect?.();
      return;
    }

    // Ctrl+N - new session
    if (e.key === 'n' && e.ctrlKey) {
      e.preventDefault();
      onNewSession?.();
      return;
    }

    // Ctrl+T - toggle thinking display
    if (e.key === 't' && e.ctrlKey) {
      e.preventDefault();
      onToggleThinking?.();
      return;
    }

    // Arrow Up - history navigation
    if (e.key === 'ArrowUp' && !showAutocomplete) {
      if (value === '' || historyIndex >= 0) {
        e.preventDefault();
        const newIndex = Math.min(historyIndex + 1, history.length - 1);
        if (newIndex >= 0 && history[newIndex]) {
          setHistoryIndex(newIndex);
          onChange(history[newIndex]);
        }
      }
      return;
    }

    // Arrow Down - history navigation
    if (e.key === 'ArrowDown' && !showAutocomplete) {
      if (historyIndex >= 0) {
        e.preventDefault();
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        onChange(newIndex >= 0 ? history[newIndex] : '');
      }
      return;
    }

    // Tab - autocomplete (handled by CommandAutocomplete)
    if (e.key === 'Tab' && showAutocomplete) {
      // Let CommandAutocomplete handle it
      return;
    }
  };

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (isStreaming) {
      onInterrupt();
      return;
    }

    // Parse input for commands
    const parsed = parseInput(trimmed);

    if (parsed.isCommand) {
      onCommand(parsed.command, parsed.args);
    } else if (parsed.isBash) {
      onBash(parsed.args);
    } else {
      onSubmit();
    }

    // Add to history
    if (trimmed && (history.length === 0 || history[0] !== trimmed)) {
      setHistory(prev => [trimmed, ...prev.slice(0, 99)]);
    }
    setHistoryIndex(-1);
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    setHistoryIndex(-1);
  };

  const handleAutocompleteSelect = (completion: string) => {
    onChange(completion + ' ');
    setShowAutocomplete(false);
    textareaRef.current?.focus();
  };

  const getPlaceholder = (): string => {
    if (isStreaming) return 'Press Enter to stop...';
    if (placeholder) return placeholder;
    return 'Message Helix... (Type / for commands)';
  };

  return (
    <div className="chat-input-wrapper">
      <CommandAutocomplete
        input={value}
        onSelect={handleAutocompleteSelect}
        visible={showAutocomplete && !disabled}
        onClose={() => setShowAutocomplete(false)}
      />

      <div className="chat-input">
        <div className="input-prefix">
          {value.startsWith('/') && <span className="prefix-slash">/</span>}
          {value.startsWith('!') && <span className="prefix-bang">!</span>}
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={getPlaceholder()}
          disabled={disabled}
          rows={1}
          className={value.startsWith('/') ? 'command-mode' : value.startsWith('!') ? 'bash-mode' : ''}
        />

        <div className="input-actions">
          {ctrlCPressed && !isStreaming && (
            <span className="ctrlc-hint">Press Ctrl+C again to exit</span>
          )}

          <button
            className={`chat-input-button ${isStreaming ? 'stop' : 'send'}`}
            onClick={handleSubmit}
            disabled={disabled || (!isStreaming && !value.trim())}
            title={isStreaming ? 'Stop (Escape)' : 'Send (Enter)'}
          >
            {isStreaming ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="input-hints">
        <span className="hint">
          <kbd>Enter</kbd> send
        </span>
        <span className="hint">
          <kbd>Shift+Enter</kbd> new line
        </span>
        <span className="hint">
          <kbd>/</kbd> commands
        </span>
        <span className="hint">
          <kbd>!</kbd> bash
        </span>
      </div>
    </div>
  );
}

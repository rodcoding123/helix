/**
 * Message Bubble - Renders user and assistant messages with markdown
 */

import { useMemo } from 'react';
import './MessageBubble.css';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  showThinking?: boolean;
  timestamp?: number;
  isStreaming?: boolean;
}

// Simple markdown parser for common patterns
function parseMarkdown(text: string): React.ReactElement[] {
  const lines = text.split('\n');
  const elements: React.ReactElement[] = [];
  let inCodeBlock = false;
  let codeContent: string[] = [];
  let codeLanguage = '';
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const ListTag = listType;
      elements.push(
        <ListTag key={elements.length}>
          {listItems.map((item, i) => (
            <li key={i}>{parseInline(item)}</li>
          ))}
        </ListTag>
      );
      listItems = [];
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={elements.length} className={`code-block language-${codeLanguage}`}>
            <code>{codeContent.join('\n')}</code>
          </pre>
        );
        codeContent = [];
        codeLanguage = '';
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
        codeLanguage = line.slice(3).trim() || 'text';
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      flushList();
      const level = headerMatch[1].length;
      const content = parseInline(headerMatch[2]);
      switch (level) {
        case 1: elements.push(<h1 key={elements.length}>{content}</h1>); break;
        case 2: elements.push(<h2 key={elements.length}>{content}</h2>); break;
        case 3: elements.push(<h3 key={elements.length}>{content}</h3>); break;
        case 4: elements.push(<h4 key={elements.length}>{content}</h4>); break;
        case 5: elements.push(<h5 key={elements.length}>{content}</h5>); break;
        case 6: elements.push(<h6 key={elements.length}>{content}</h6>); break;
      }
      continue;
    }

    // Unordered list items
    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listItems.push(ulMatch[1]);
      continue;
    }

    // Ordered list items
    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listItems.push(olMatch[1]);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(line.trim())) {
      flushList();
      elements.push(<hr key={elements.length} />);
      continue;
    }

    // Blockquote
    const quoteMatch = line.match(/^>\s*(.*)$/);
    if (quoteMatch) {
      flushList();
      elements.push(
        <blockquote key={elements.length}>{parseInline(quoteMatch[1])}</blockquote>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      flushList();
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(<p key={elements.length}>{parseInline(line)}</p>);
  }

  flushList();

  return elements;
}

// Parse inline markdown (bold, italic, code, links)
function parseInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code
    let match = remaining.match(/^`([^`]+)`/);
    if (match) {
      parts.push(<code key={key++} className="inline-code">{match[1]}</code>);
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Bold
    match = remaining.match(/^\*\*(.+?)\*\*/);
    if (match) {
      parts.push(<strong key={key++}>{match[1]}</strong>);
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Italic
    match = remaining.match(/^\*(.+?)\*/);
    if (match) {
      parts.push(<em key={key++}>{match[1]}</em>);
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Link
    match = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (match) {
      parts.push(
        <a key={key++} href={match[2]} target="_blank" rel="noopener noreferrer">
          {match[1]}
        </a>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Regular text
    match = remaining.match(/^[^`*[\]]+/);
    if (match) {
      parts.push(match[0]);
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Single special character
    parts.push(remaining[0]);
    remaining = remaining.slice(1);
  }

  return parts.length === 1 ? parts[0] : parts;
}

export function MessageBubble({
  role,
  content,
  thinking,
  showThinking = false,
  timestamp,
  isStreaming = false,
}: MessageBubbleProps) {
  const renderedContent = useMemo(() => parseMarkdown(content), [content]);

  const formatTime = (ts: number): string => {
    const date = new Date(ts);
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`message-bubble ${role} ${isStreaming ? 'streaming' : ''}`}>
      <div className="message-avatar">
        {role === 'user' ? (
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        ) : role === 'system' ? (
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
        ) : (
          <div className="helix-avatar">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
        )}
      </div>
      <div className="message-content">
        <div className="message-header">
          <span className="message-sender">
            {role === 'user' ? 'You' : role === 'system' ? 'System' : 'Helix'}
          </span>
          {timestamp && (
            <span className="message-time">{formatTime(timestamp)}</span>
          )}
        </div>

        {showThinking && thinking && (
          <div className="message-thinking">
            <div className="thinking-header">
              <span className="thinking-icon">💭</span>
              <span>Thinking...</span>
            </div>
            <div className="thinking-content">{thinking}</div>
          </div>
        )}

        <div className="message-text">{renderedContent}</div>

        {isStreaming && (
          <span className="streaming-cursor" />
        )}
      </div>
    </div>
  );
}

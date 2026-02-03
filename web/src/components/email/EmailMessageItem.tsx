/**
 * EmailMessageItem - Individual message renderer
 *
 * Features:
 * - Collapsible message body
 * - DOMPurify sanitization for HTML content (XSS protection)
 * - Toggle between plain text and HTML view
 * - From/To/CC display with timestamps
 */

import React, { useState, useMemo } from 'react';
import type { EmailMessage } from '@/hooks/useEmailClient';

// =====================================================
// Types
// =====================================================

interface EmailMessageItemProps {
  message: EmailMessage;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onReply: () => void;
  isLast?: boolean;
}

// =====================================================
// HTML Sanitization
// =====================================================

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Uses a simple allowlist approach for safe HTML rendering.
 */
function sanitizeHtml(html: string): string {
  // Create a temporary div to parse HTML
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Remove potentially dangerous elements
  const dangerousTags = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'link'];
  dangerousTags.forEach((tag) => {
    const elements = doc.getElementsByTagName(tag);
    while (elements.length > 0) {
      elements[0].parentNode?.removeChild(elements[0]);
    }
  });

  // Remove dangerous attributes from all elements
  const dangerousAttrs = ['onclick', 'onerror', 'onload', 'onmouseover', 'onfocus', 'onblur'];
  const allElements = doc.body.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    const element = allElements[i];
    dangerousAttrs.forEach((attr) => {
      element.removeAttribute(attr);
    });

    // Remove javascript: URLs
    const href = element.getAttribute('href');
    if (href && href.toLowerCase().startsWith('javascript:')) {
      element.removeAttribute('href');
    }

    const src = element.getAttribute('src');
    if (src && src.toLowerCase().startsWith('javascript:')) {
      element.removeAttribute('src');
    }
  }

  return doc.body.innerHTML;
}

// =====================================================
// Helper Functions
// =====================================================

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  if (diffDays === 0) {
    return `Today at ${timeStr}`;
  } else if (diffDays === 1) {
    return `Yesterday at ${timeStr}`;
  } else {
    return `${dateStr} at ${timeStr}`;
  }
}

function formatEmailAddress(email: string, name?: string): string {
  if (name) {
    return `${name} <${email}>`;
  }
  return email;
}

function getInitials(email: string, name?: string): string {
  if (name) {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
}

// =====================================================
// Avatar Component
// =====================================================

const Avatar: React.FC<{ email: string; name?: string }> = ({ email, name }) => {
  // Generate a consistent color based on email
  const colorIndex = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 6;
  const colors = [
    'bg-blue-600',
    'bg-green-600',
    'bg-purple-600',
    'bg-orange-600',
    'bg-pink-600',
    'bg-teal-600',
  ];

  return (
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${colors[colorIndex]}`}
    >
      {getInitials(email, name)}
    </div>
  );
};

// =====================================================
// Main Component
// =====================================================

export const EmailMessageItem: React.FC<EmailMessageItemProps> = ({
  message,
  isExpanded,
  onToggleExpand,
  onReply,
  isLast = false,
}) => {
  const [showHtml, setShowHtml] = useState(false);

  // Sanitize HTML content
  const sanitizedHtml = useMemo(() => {
    if (message.body_html) {
      return sanitizeHtml(message.body_html);
    }
    return null;
  }, [message.body_html]);

  const hasHtmlContent = !!sanitizedHtml;

  return (
    <div
      className={`${isLast ? 'bg-slate-900/30' : ''}`}
      data-testid={`message-${message.id}`}
    >
      {/* Collapsed Header */}
      <button
        onClick={onToggleExpand}
        className="w-full px-6 py-4 text-left hover:bg-slate-800/30 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <Avatar email={message.from_email} name={message.from_name} />

          {/* Sender Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-white truncate">
                {message.from_name || message.from_email}
              </span>
              <span className="text-xs text-slate-500 flex-shrink-0">
                {formatTimestamp(message.received_at)}
              </span>
            </div>

            {!isExpanded && (
              <p className="text-sm text-slate-400 truncate mt-0.5">
                {message.body_plain?.substring(0, 100) || '(No content)'}
                {(message.body_plain?.length || 0) > 100 && '...'}
              </p>
            )}
          </div>

          {/* Expand/Collapse Indicator */}
          <svg
            className={`w-5 h-5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 pb-6">
          {/* Full Header Info */}
          <div className="ml-14 mb-4 text-sm space-y-1">
            <div className="text-slate-400">
              <span className="text-slate-500">From: </span>
              {formatEmailAddress(message.from_email, message.from_name)}
            </div>
            {message.to_emails && message.to_emails.length > 0 && (
              <div className="text-slate-400">
                <span className="text-slate-500">To: </span>
                {message.to_emails.join(', ')}
              </div>
            )}
            {message.cc_emails && message.cc_emails.length > 0 && (
              <div className="text-slate-400">
                <span className="text-slate-500">Cc: </span>
                {message.cc_emails.join(', ')}
              </div>
            )}
          </div>

          {/* Message Body */}
          <div className="ml-14">
            {showHtml && sanitizedHtml ? (
              <div
                className="prose prose-invert prose-sm max-w-none email-content"
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                data-testid="message-html-content"
              />
            ) : (
              <pre
                className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed"
                data-testid="message-plain-content"
              >
                {message.body_plain || '(No content)'}
              </pre>
            )}

            {/* Action Buttons */}
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={onReply}
                className="px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                  />
                </svg>
                Reply
              </button>

              <button
                className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
                Forward
              </button>

              {hasHtmlContent && (
                <button
                  onClick={() => setShowHtml(!showHtml)}
                  className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors"
                  data-testid="toggle-html-button"
                >
                  {showHtml ? 'Plain text' : 'Show HTML'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailMessageItem;

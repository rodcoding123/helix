/**
 * ChannelConfigPanel - Reusable collapsible configuration section
 *
 * A standardised panel wrapper used inside ChannelDetail to group related
 * settings.  Supports an optional collapse/expand toggle with a smooth
 * CSS transition, a title, and an optional description line.
 *
 * CSS prefix: ccp-
 */

import { useState, useRef, useEffect, type ReactNode } from 'react';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

export interface ChannelConfigPanelProps {
  title: string;
  description?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function ChannelConfigPanel({
  title,
  description,
  children,
  collapsible = false,
  defaultExpanded = true,
}: ChannelConfigPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  // Measure content height for the smooth expand / collapse animation
  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContentHeight(entry.contentRect.height);
      }
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    if (collapsible) setExpanded((prev) => !prev);
  };

  return (
    <section className="ccp-panel" aria-expanded={expanded}>
      <style>{channelConfigPanelStyles}</style>

      {/* Header */}
      <div
        className={`ccp-header ${collapsible ? 'ccp-header--clickable' : ''}`}
        onClick={toggle}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={collapsible ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } } : undefined}
        aria-label={collapsible ? `${expanded ? 'Collapse' : 'Expand'} ${title}` : undefined}
      >
        <div className="ccp-header__text">
          <h4 className="ccp-title">{title}</h4>
          {description && <p className="ccp-description">{description}</p>}
        </div>

        {collapsible && (
          <svg
            className={`ccp-chevron ${expanded ? 'ccp-chevron--open' : ''}`}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Content */}
      <div
        className="ccp-body-wrapper"
        style={{
          height: collapsible
            ? expanded
              ? contentHeight !== undefined ? contentHeight + 16 : 'auto'
              : 0
            : 'auto',
        }}
      >
        <div className="ccp-body" ref={contentRef}>
          {children}
        </div>
      </div>
    </section>
  );
}

export default ChannelConfigPanel;

/* ═══════════════════════════════════════════
   Scoped styles (ccp- prefix)
   ═══════════════════════════════════════════ */

const channelConfigPanelStyles = `
.ccp-panel {
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  margin-bottom: 0.75rem;
  overflow: hidden;
}

/* ── Header ── */
.ccp-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  user-select: none;
}

.ccp-header--clickable {
  cursor: pointer;
  transition: background 0.15s ease;
}

.ccp-header--clickable:hover {
  background: rgba(255,255,255,0.02);
}

.ccp-header--clickable:focus-visible {
  outline: 2px solid var(--accent-color, #6366f1);
  outline-offset: -2px;
  border-radius: 10px;
}

.ccp-header__text {
  flex: 1;
  min-width: 0;
}

.ccp-title {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary, #a0a0c0);
}

.ccp-description {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  line-height: 1.4;
}

/* ── Chevron ── */
.ccp-chevron {
  flex-shrink: 0;
  color: var(--text-tertiary, #606080);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  margin-top: 0.125rem;
}

.ccp-chevron--open {
  transform: rotate(180deg);
}

/* ── Body wrapper (animated) ── */
.ccp-body-wrapper {
  overflow: hidden;
  transition: height 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.ccp-body {
  padding: 0 1rem 1rem;
}
`;

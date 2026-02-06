/**
 * GuildConfig - Per-guild configuration component for Discord bot
 *
 * Collapsible card displaying guild info and channel allowlist/denylist
 * tag inputs. Used within DiscordSetup Step 3 for per-guild customization.
 */

import { useState, useCallback, useRef } from 'react';

/* ===================================================================
   Types
   =================================================================== */

export interface GuildConfigData {
  channelAllowlist: string[];
  channelDenylist: string[];
}

export interface GuildConfigProps {
  guildId: string;
  guildName: string;
  guildIcon?: string;
  memberCount?: number;
  channelAllowlist: string[];
  channelDenylist: string[];
  onUpdate: (config: GuildConfigData) => void;
}

/* ===================================================================
   Component
   =================================================================== */

export function GuildConfig({
  guildId,
  guildName,
  guildIcon,
  memberCount,
  channelAllowlist,
  channelDenylist,
  onUpdate,
}: GuildConfigProps) {
  const [expanded, setExpanded] = useState(false);
  const [allowInput, setAllowInput] = useState('');
  const [denyInput, setDenyInput] = useState('');
  const allowInputRef = useRef<HTMLInputElement>(null);
  const denyInputRef = useRef<HTMLInputElement>(null);

  /* ---------------------------------------------------------------
     Tag management
     --------------------------------------------------------------- */

  const addAllowTag = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (channelAllowlist.includes(trimmed)) return;
    onUpdate({
      channelAllowlist: [...channelAllowlist, trimmed],
      channelDenylist,
    });
    setAllowInput('');
  }, [channelAllowlist, channelDenylist, onUpdate]);

  const removeAllowTag = useCallback((tag: string) => {
    onUpdate({
      channelAllowlist: channelAllowlist.filter((t) => t !== tag),
      channelDenylist,
    });
  }, [channelAllowlist, channelDenylist, onUpdate]);

  const addDenyTag = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (channelDenylist.includes(trimmed)) return;
    onUpdate({
      channelAllowlist,
      channelDenylist: [...channelDenylist, trimmed],
    });
    setDenyInput('');
  }, [channelAllowlist, channelDenylist, onUpdate]);

  const removeDenyTag = useCallback((tag: string) => {
    onUpdate({
      channelAllowlist,
      channelDenylist: channelDenylist.filter((t) => t !== tag),
    });
  }, [channelAllowlist, channelDenylist, onUpdate]);

  const handleAllowKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addAllowTag(allowInput);
    }
    if (e.key === 'Backspace' && !allowInput && channelAllowlist.length > 0) {
      removeAllowTag(channelAllowlist[channelAllowlist.length - 1]);
    }
  }, [allowInput, channelAllowlist, addAllowTag, removeAllowTag]);

  const handleDenyKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addDenyTag(denyInput);
    }
    if (e.key === 'Backspace' && !denyInput && channelDenylist.length > 0) {
      removeDenyTag(channelDenylist[channelDenylist.length - 1]);
    }
  }, [denyInput, channelDenylist, addDenyTag, removeDenyTag]);

  /* ---------------------------------------------------------------
     Helpers
     --------------------------------------------------------------- */

  const hasFilters = channelAllowlist.length > 0 || channelDenylist.length > 0;

  /** Generate a guild avatar: first letter or icon. */
  const avatarContent = guildIcon
    ? <img src={guildIcon} alt={guildName} className="gc-avatar-img" />
    : <span className="gc-avatar-letter">{guildName.charAt(0).toUpperCase()}</span>;

  /* ---------------------------------------------------------------
     Render
     --------------------------------------------------------------- */

  return (
    <div className={`gc-card ${expanded ? 'gc-card-expanded' : ''}`}>
      <style>{guildConfigStyles}</style>

      {/* Header (click to expand/collapse) */}
      <button
        className="gc-header"
        onClick={() => setExpanded(!expanded)}
        type="button"
        aria-expanded={expanded}
        aria-controls={`gc-content-${guildId}`}
      >
        <div className="gc-header-left">
          <div className="gc-avatar">{avatarContent}</div>
          <div className="gc-header-info">
            <span className="gc-guild-name">{guildName}</span>
            {memberCount != null && (
              <span className="gc-member-count">{memberCount.toLocaleString()} members</span>
            )}
          </div>
        </div>
        <div className="gc-header-right">
          {hasFilters && (
            <span className="gc-filter-badge">
              {channelAllowlist.length + channelDenylist.length} filter{channelAllowlist.length + channelDenylist.length !== 1 ? 's' : ''}
            </span>
          )}
          <svg
            className={`gc-chevron ${expanded ? 'gc-chevron-open' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            width="16"
            height="16"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="gc-content" id={`gc-content-${guildId}`}>
          {/* Channel Allowlist */}
          <div className="gc-field">
            <label className="gc-field-label">
              Channel Allowlist
              <span className="gc-field-hint">Only respond in these channels</span>
            </label>
            <div
              className="gc-tag-input-container"
              onClick={() => allowInputRef.current?.focus()}
            >
              {channelAllowlist.map((tag) => (
                <span key={tag} className="gc-tag gc-tag-allow">
                  <span className="gc-tag-hash">#</span>
                  {tag}
                  <button
                    className="gc-tag-remove"
                    onClick={(e) => { e.stopPropagation(); removeAllowTag(tag); }}
                    type="button"
                    aria-label={`Remove ${tag}`}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </span>
              ))}
              <input
                ref={allowInputRef}
                type="text"
                className="gc-tag-input"
                placeholder={channelAllowlist.length === 0 ? 'Type channel name and press Enter...' : ''}
                value={allowInput}
                onChange={(e) => setAllowInput(e.target.value)}
                onKeyDown={handleAllowKeyDown}
                onBlur={() => { if (allowInput.trim()) addAllowTag(allowInput); }}
              />
            </div>
          </div>

          {/* Channel Denylist */}
          <div className="gc-field">
            <label className="gc-field-label">
              Channel Denylist
              <span className="gc-field-hint">Never respond in these channels</span>
            </label>
            <div
              className="gc-tag-input-container"
              onClick={() => denyInputRef.current?.focus()}
            >
              {channelDenylist.map((tag) => (
                <span key={tag} className="gc-tag gc-tag-deny">
                  <span className="gc-tag-hash">#</span>
                  {tag}
                  <button
                    className="gc-tag-remove"
                    onClick={(e) => { e.stopPropagation(); removeDenyTag(tag); }}
                    type="button"
                    aria-label={`Remove ${tag}`}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </span>
              ))}
              <input
                ref={denyInputRef}
                type="text"
                className="gc-tag-input"
                placeholder={channelDenylist.length === 0 ? 'Type channel name and press Enter...' : ''}
                value={denyInput}
                onChange={(e) => setDenyInput(e.target.value)}
                onKeyDown={handleDenyKeyDown}
                onBlur={() => { if (denyInput.trim()) addDenyTag(denyInput); }}
              />
            </div>
          </div>

          {/* Hints */}
          <div className="gc-hints">
            <p className="gc-hint">Leave both empty to allow all channels.</p>
            <p className="gc-hint gc-hint-note">Denylist takes priority over allowlist.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default GuildConfig;

/* ===================================================================
   Scoped styles (gc- prefix)
   =================================================================== */

const guildConfigStyles = `
/* Card */
.gc-card {
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.2s ease;
}

.gc-card:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.gc-card-expanded {
  border-color: rgba(88, 101, 242, 0.3);
}

.gc-card-expanded:hover {
  border-color: rgba(88, 101, 242, 0.4);
}

/* Header */
.gc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.875rem 1rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
  text-align: left;
  color: inherit;
  font: inherit;
}

.gc-header:hover {
  background: rgba(255, 255, 255, 0.02);
}

.gc-header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.gc-header-right {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-shrink: 0;
}

/* Avatar */
.gc-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(88, 101, 242, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.gc-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.gc-avatar-letter {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #5865F2;
}

/* Header info */
.gc-header-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.gc-guild-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gc-member-count {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
}

/* Filter badge */
.gc-filter-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 4px;
  background: rgba(88, 101, 242, 0.15);
  color: #818cf8;
}

/* Chevron */
.gc-chevron {
  color: var(--text-tertiary, #606080);
  transition: transform 0.25s ease;
  flex-shrink: 0;
}

.gc-chevron-open {
  transform: rotate(180deg);
}

/* Content */
.gc-content {
  padding: 0 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  animation: gc-expand 0.25s ease;
}

@keyframes gc-expand {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Field */
.gc-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.gc-field-label {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.gc-field-hint {
  font-size: 0.6875rem;
  font-weight: 400;
  color: var(--text-tertiary, #606080);
}

/* Tag input container */
.gc-tag-input-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  padding: 0.5rem 0.625rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  min-height: 42px;
  cursor: text;
  transition: border-color 0.15s ease;
}

.gc-tag-input-container:focus-within {
  border-color: #5865F2;
}

/* Tags */
.gc-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.1875rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 4px;
  line-height: 1.4;
  animation: gc-tag-in 0.15s ease;
}

@keyframes gc-tag-in {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.gc-tag-allow {
  background: rgba(16, 185, 129, 0.12);
  color: #34d399;
}

.gc-tag-deny {
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
}

.gc-tag-hash {
  opacity: 0.6;
  font-weight: 400;
}

.gc-tag-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  background: transparent;
  border: none;
  border-radius: 3px;
  color: inherit;
  cursor: pointer;
  opacity: 0.6;
  transition: all 0.15s ease;
  padding: 0;
  margin-left: 0.125rem;
}

.gc-tag-remove:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

/* Tag text input */
.gc-tag-input {
  flex: 1;
  min-width: 120px;
  padding: 0.125rem 0;
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.8125rem;
  color: var(--text-primary, #fff);
}

.gc-tag-input::placeholder {
  color: var(--text-tertiary, #606080);
}

/* Hints */
.gc-hints {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.625rem 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
}

.gc-hint {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  margin: 0;
  line-height: 1.4;
}

.gc-hint-note {
  color: #fbbf24;
  font-weight: 500;
}

/* Responsive */
@media (max-width: 480px) {
  .gc-header {
    padding: 0.75rem;
  }

  .gc-content {
    padding: 0 0.75rem 0.75rem;
  }

  .gc-guild-name {
    font-size: 0.8125rem;
  }
}
`;

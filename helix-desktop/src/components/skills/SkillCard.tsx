/**
 * SkillCard Component
 *
 * Reusable card for displaying skill information in grids.
 * Supports installed skills and ClawHub marketplace skills.
 */

import { useState, useCallback } from 'react';
import { Download, Trash2, RefreshCw, ExternalLink, Check, AlertCircle } from 'lucide-react';

export interface SkillCardSkill {
  name: string;
  description?: string;
  version?: string;
  enabled: boolean;
  builtin: boolean;
  icon?: string;
  author?: string;
  rating?: number;
  downloads?: number;
  category?: string;
  tags?: string[];
  requirementsMet?: boolean;
  hasUpdate?: boolean;
  latestVersion?: string;
  installed?: boolean;
}

interface SkillCardProps {
  skill: SkillCardSkill;
  variant?: 'installed' | 'marketplace';
  onToggle?: (name: string, enabled: boolean) => void;
  onInstall?: (name: string) => Promise<void>;
  onUninstall?: (name: string) => Promise<void>;
  onUpdate?: (name: string) => Promise<void>;
  onConfigure?: (name: string) => void;
  onViewDetails?: (name: string) => void;
}

const SKILL_ICONS: Record<string, string> = {
  web: '🌐', browser: '🌐', memory: '🧠', git: '📦', code: '💻',
  file: '📁', search: '🔍', chat: '💬', image: '🖼️', audio: '🎵',
  video: '🎬', data: '📊', security: '🔒', automation: '🤖',
  api: '🔌', database: '🗄️', deploy: '🚀', test: '🧪',
};

function getSkillIcon(name: string, icon?: string): string {
  if (icon) return icon;
  for (const [key, emoji] of Object.entries(SKILL_ICONS)) {
    if (name.toLowerCase().includes(key)) return emoji;
  }
  return '⚙️';
}

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - half);
}

export function SkillCard({
  skill,
  variant = 'installed',
  onToggle,
  onInstall,
  onUninstall,
  onUpdate,
  onConfigure,
  onViewDetails,
}: SkillCardProps) {
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleAction = useCallback(async (action: () => Promise<void>) => {
    setLoading(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const isMarketplace = variant === 'marketplace';

  return (
    <div className={`skill-card ${skill.enabled ? 'enabled' : ''} ${isMarketplace ? 'marketplace' : ''}`}>
      <style>{skillCardStyles}</style>

      {/* Header */}
      <div className="skill-card-header">
        <span className="skill-icon">{getSkillIcon(skill.name, skill.icon)}</span>
        <div className="skill-info">
          <div className="skill-name-row">
            <span className="skill-name">{skill.name}</span>
            {skill.builtin && <span className="badge builtin">Built-in</span>}
            {skill.hasUpdate && <span className="badge update">Update</span>}
          </div>
          {skill.version && (
            <span className="skill-version">v{skill.version}</span>
          )}
        </div>

        {/* Toggle for installed skills */}
        {!isMarketplace && onToggle && (
          <label className="skill-toggle">
            <input
              type="checkbox"
              checked={skill.enabled}
              onChange={() => onToggle(skill.name, !skill.enabled)}
              disabled={loading}
            />
            <span className="toggle-slider" />
          </label>
        )}
      </div>

      {/* Description */}
      {skill.description && (
        <p className="skill-description">{skill.description}</p>
      )}

      {/* Marketplace metadata */}
      {isMarketplace && (
        <div className="skill-meta">
          {skill.author && <span className="meta-item">by {skill.author}</span>}
          {skill.rating != null && (
            <span className="meta-item rating">{renderStars(skill.rating)} {skill.rating.toFixed(1)}</span>
          )}
          {skill.downloads != null && (
            <span className="meta-item">{skill.downloads.toLocaleString()} downloads</span>
          )}
        </div>
      )}

      {/* Tags */}
      {skill.tags && skill.tags.length > 0 && (
        <div className="skill-tags">
          {skill.tags.slice(0, 4).map(tag => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
      )}

      {/* Requirements warning */}
      {skill.requirementsMet === false && (
        <div className="requirements-warning">
          <AlertCircle className="w-3 h-3" />
          <span>Missing requirements</span>
        </div>
      )}

      {/* Actions */}
      <div className="skill-actions">
        {isMarketplace && !skill.installed && onInstall && (
          <button
            className="btn-action install"
            onClick={() => handleAction(() => onInstall(skill.name))}
            disabled={loading}
          >
            <Download className="w-3.5 h-3.5" />
            {loading ? 'Installing...' : 'Install'}
          </button>
        )}

        {isMarketplace && skill.installed && (
          <span className="installed-badge">
            <Check className="w-3.5 h-3.5" /> Installed
          </span>
        )}

        {!isMarketplace && skill.hasUpdate && onUpdate && (
          <button
            className="btn-action update"
            onClick={() => handleAction(() => onUpdate(skill.name))}
            disabled={loading}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Update to v{skill.latestVersion}
          </button>
        )}

        {!isMarketplace && !skill.builtin && onUninstall && (
          <button
            className="btn-action uninstall"
            onClick={() => handleAction(() => onUninstall(skill.name))}
            disabled={loading}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {onViewDetails && (
          <button
            className="btn-action details"
            onClick={() => onViewDetails(skill.name)}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}

        {!isMarketplace && onConfigure && (
          <button
            className="btn-action configure"
            onClick={() => onConfigure(skill.name)}
          >
            Configure
          </button>
        )}
      </div>

      {actionError && (
        <div className="action-error">{actionError}</div>
      )}
    </div>
  );
}

const skillCardStyles = `
.skill-card {
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 1rem;
  transition: all 0.2s ease;
}

.skill-card:hover {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.03);
}

.skill-card.enabled {
  border-color: rgba(99, 102, 241, 0.2);
}

.skill-card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.skill-icon {
  font-size: 1.5rem;
  line-height: 1;
  flex-shrink: 0;
}

.skill-info {
  flex: 1;
  min-width: 0;
}

.skill-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.skill-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-version {
  font-size: 0.7rem;
  color: var(--text-tertiary, #606080);
}

.badge {
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
  white-space: nowrap;
}

.badge.builtin {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
}

.badge.update {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.skill-toggle {
  position: relative;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
  cursor: pointer;
}

.skill-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  transition: 0.2s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 2px;
  bottom: 2px;
  background: #fff;
  border-radius: 50%;
  transition: 0.2s;
}

.skill-toggle input:checked + .toggle-slider {
  background: #6366f1;
}

.skill-toggle input:checked + .toggle-slider::before {
  transform: translateX(16px);
}

.skill-description {
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0c0);
  line-height: 1.4;
  margin: 0 0 0.5rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.skill-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.meta-item {
  font-size: 0.7rem;
  color: var(--text-tertiary, #606080);
}

.meta-item.rating {
  color: #fbbf24;
}

.skill-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-bottom: 0.5rem;
}

.tag {
  font-size: 0.625rem;
  padding: 0.125rem 0.5rem;
  border-radius: 99px;
  background: rgba(99, 102, 241, 0.08);
  color: var(--text-tertiary, #606080);
  border: 1px solid rgba(99, 102, 241, 0.12);
}

.requirements-warning {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.7rem;
  color: #f59e0b;
  margin-bottom: 0.5rem;
}

.skill-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: transparent;
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-secondary, #a0a0c0);
}

.btn-action:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-action.install {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.3);
  color: #818cf8;
}

.btn-action.install:hover {
  background: rgba(99, 102, 241, 0.2);
}

.btn-action.update {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.btn-action.uninstall {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.2);
}

.btn-action.uninstall:hover {
  background: rgba(239, 68, 68, 0.1);
}

.installed-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.7rem;
  color: #10b981;
  font-weight: 500;
}

.action-error {
  font-size: 0.7rem;
  color: #ef4444;
  margin-top: 0.5rem;
}
`;

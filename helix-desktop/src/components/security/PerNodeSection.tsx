/**
 * Per-Node Exec Policy Section
 *
 * Manages command allowlists and security settings for a specific device/node.
 * Pattern: Mirrors PerAgentSection structure from ExecApprovalsDashboard
 *
 * Phase H.2: Device-specific execution control
 */

import { useState, useRef } from 'react';

export interface PerNodeSectionProps {
  nodeId: string;
  nodeDisplayName: string;
  policies: { allow: string[]; deny: string[] };
  onUpdate: (nodeId: string, policies: { allow: string[]; deny: string[] }) => void;
  onRemoveNode: (nodeId: string) => void;
}

interface TagInputProps {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
  variant: 'deny' | 'allow';
}

function TagInput({ tags, onAdd, onRemove, placeholder, variant }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onAdd(trimmed);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      onRemove(tags.length - 1);
    }
  };

  return (
    <div
      className={`ead-tag-input-wrapper ead-tag-input-${variant}`}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="ead-tags">
        {tags.map((tag, i) => (
          <span key={`${tag}-${i}`} className={`ead-tag ead-tag-${variant}`}>
            <code className="ead-tag-text">{tag}</code>
            <button
              className="ead-tag-remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(i);
              }}
              aria-label={`Remove ${tag}`}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="10" height="10">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="ead-tag-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleAdd}
          placeholder={tags.length === 0 ? placeholder : ''}
          aria-label={placeholder}
        />
      </div>
    </div>
  );
}

export function PerNodeSection({
  nodeId,
  nodeDisplayName,
  policies,
  onUpdate,
  onRemoveNode,
}: PerNodeSectionProps) {
  const addAllow = (pattern: string) => {
    onUpdate(nodeId, {
      ...policies,
      allow: [...policies.allow, pattern],
    });
  };

  const removeAllow = (index: number) => {
    onUpdate(nodeId, {
      ...policies,
      allow: policies.allow.filter((_, i) => i !== index),
    });
  };

  const addDeny = (pattern: string) => {
    onUpdate(nodeId, {
      ...policies,
      deny: [...policies.deny, pattern],
    });
  };

  const removeDeny = (index: number) => {
    onUpdate(nodeId, {
      ...policies,
      deny: policies.deny.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="ead-per-node-section">
      <div className="ead-per-node-header">
        <div className="ead-per-node-title-row">
          <h4 className="ead-per-node-title">{nodeDisplayName}</h4>
          <code className="ead-per-node-id">{nodeId}</code>
        </div>
        <button
          className="ead-btn-ghost ead-btn-sm"
          onClick={() => onRemoveNode(nodeId)}
          title="Remove per-node policy"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path
              fillRule="evenodd"
              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 112 0V8a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Remove
        </button>
      </div>

      <div className="ead-per-node-policies">
        {/* Allow list */}
        <div className="ead-per-node-policy-item">
          <label className="ead-label">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" className="ead-label-icon ead-label-icon-allow">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Allow
          </label>
          <TagInput
            tags={policies.allow}
            onAdd={addAllow}
            onRemove={removeAllow}
            placeholder="Add allowed pattern..."
            variant="allow"
          />
        </div>

        {/* Deny list */}
        <div className="ead-per-node-policy-item">
          <label className="ead-label">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" className="ead-label-icon ead-label-icon-deny">
              <path
                fillRule="evenodd"
                d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"
                clipRule="evenodd"
              />
            </svg>
            Deny
          </label>
          <TagInput
            tags={policies.deny}
            onAdd={addDeny}
            onRemove={removeDeny}
            placeholder="Add denied pattern..."
            variant="deny"
          />
        </div>
      </div>
    </div>
  );
}

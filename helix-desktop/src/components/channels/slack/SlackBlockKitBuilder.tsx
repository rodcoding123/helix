/**
 * Slack Block Kit Builder
 *
 * Visual UI for building Slack messages with Block Kit:
 * - Section blocks with text and images
 * - Button blocks with actions
 * - Input blocks for interactive forms
 * - Preview with block visualization
 */

import { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, Eye, Download, Type, ToggleLeft, Radio } from 'lucide-react';
import { getGatewayClient } from '../../../lib/gateway-client';
import type { ChannelAccount } from '../ChannelAccountTabs';

export type BlockType = 'section' | 'button' | 'input' | 'divider' | 'image';

export interface SlackBlock {
  id: string;
  type: BlockType;
  text?: string;
  label?: string;
  placeholder?: string;
  imageUrl?: string;
  altText?: string;
  actionId?: string;
  blockId?: string;
  value?: string;
}

export interface BlockTemplate {
  id: string;
  name: string;
  blocks: SlackBlock[];
  createdAt: number;
}

interface SlackBlockKitBuilderProps {
  account?: ChannelAccount;
  _channelId?: string;
}

interface SlackBlockResponse {
  ok?: boolean;
  templates?: BlockTemplate[];
  template?: BlockTemplate;
}

const BLOCK_TYPE_OPTIONS: Array<{ value: BlockType; label: string; icon: React.ReactNode }> = [
  { value: 'section', label: 'Section', icon: <Type size={16} /> },
  { value: 'button', label: 'Button', icon: <ToggleLeft size={16} /> },
  { value: 'input', label: 'Input', icon: <Radio size={16} /> },
  { value: 'divider', label: 'Divider', icon: null },
  { value: 'image', label: 'Image', icon: null },
];

export function SlackBlockKitBuilder({
  account: propsAccount,
  _channelId: _unusedChannelId,
}: SlackBlockKitBuilderProps) {
  const account = propsAccount || { id: 'default', name: 'Primary' };
  const [templates, setTemplates] = useState<BlockTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<BlockTemplate | null>(null);
  const [blocks, setBlocks] = useState<SlackBlock[]>([]);
  const [newBlockType, setNewBlockType] = useState<BlockType>('section');
  const [blockText, setBlockText] = useState('');
  const [blockLabel, setBlockLabel] = useState('');
  const [blockPlaceholder, setBlockPlaceholder] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_showPreview] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Load templates
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        throw new Error('Gateway not connected');
      }

      const result = await client.request('channels.slack.blocks.listTemplates', {
        accountId: account.id,
      }) as SlackBlockResponse;

      if (result?.ok) {
        setTemplates(result.templates || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [account.id]);

  // Add block
  const handleAddBlock = useCallback(() => {
    if (newBlockType === 'divider') {
      const block: SlackBlock = {
        id: `block-${Date.now()}`,
        type: 'divider',
      };
      setBlocks(prev => [...prev, block]);
      return;
    }

    if (!blockText.trim() && newBlockType !== 'image') {
      setError('Block content required');
      return;
    }

    const block: SlackBlock = {
      id: `block-${Date.now()}`,
      type: newBlockType,
      text: newBlockType !== 'image' ? blockText : undefined,
      label: blockLabel || undefined,
      placeholder: blockPlaceholder || undefined,
      blockId: `block_${blocks.length}`,
      actionId: `action_${blocks.length}`,
    };

    setBlocks(prev => [...prev, block]);
    setBlockText('');
    setBlockLabel('');
    setBlockPlaceholder('');
  }, [newBlockType, blockText, blockLabel, blockPlaceholder, blocks.length]);

  // Delete block
  const handleDeleteBlock = useCallback((blockId: string) => {
    setBlocks(prev => prev.filter(b => b.id !== blockId));
  }, []);

  // Save template
  const handleSaveTemplate = useCallback(async () => {
    if (!templateName.trim() || blocks.length === 0) {
      setError('Template name and blocks required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        throw new Error('Gateway not connected');
      }

      const result = await client.request('channels.slack.blocks.createTemplate', {
        accountId: account.id,
        name: templateName,
        blocks,
      }) as SlackBlockResponse;

      if (result?.ok && result.template) {
        const newTemplate = result.template;
        setTemplates(prev => [...prev, newTemplate]);
        setTemplateName('');
        setShowTemplateModal(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [templateName, blocks, account.id]);

  // Delete template
  const handleDeleteTemplate = useCallback(
    async (templateId: string) => {
      if (!confirm('Delete this block template?')) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const client = getGatewayClient();
        if (!client?.connected) {
          throw new Error('Gateway not connected');
        }

        await client.request('channels.slack.blocks.deleteTemplate', {
          accountId: account.id,
          templateId,
        });

        setTemplates(prev => prev.filter(t => t.id !== templateId));
        if (selectedTemplate?.id === templateId) {
          setSelectedTemplate(null);
          setBlocks([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [selectedTemplate, account.id]
  );

  // Load template
  const handleLoadTemplate = useCallback((template: BlockTemplate) => {
    setSelectedTemplate(template);
    setBlocks(template.blocks);
  }, []);

  // Export JSON
  const handleExportJson = useCallback(() => {
    const json = JSON.stringify(blocks, null, 2);
    navigator.clipboard.writeText(json);
  }, [blocks]);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  return (
    <div className="slack-block-kit-builder">
      <div className="builder-header">
        <h3>Block Kit Builder</h3>
        <button
          onClick={() => setShowTemplateModal(true)}
          disabled={loading || blocks.length === 0}
          className="save-template-btn"
        >
          <Download size={16} />
          Save Template
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="builder-main">
        {/* Sidebar */}
        <div className="builder-sidebar">
          <div className="sidebar-section">
            <h4>Templates</h4>
            <div className="templates-list">
              {templates.length === 0 ? (
                <div className="empty-list">
                  <p>No templates</p>
                </div>
              ) : (
                templates.map(template => (
                  <div
                    key={template.id}
                    className={`template-item ${
                      selectedTemplate?.id === template.id ? 'active' : ''
                    }`}
                    onClick={() => handleLoadTemplate(template)}
                  >
                    <div className="template-name">{template.name}</div>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleDeleteTemplate(template.id);
                      }}
                      className="delete-btn"
                      disabled={loading}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="builder-content">
          {/* Block Type Selector */}
          <div className="block-type-selector">
            <div className="selector-group">
              <label>Add Block</label>
              <select
                value={newBlockType}
                onChange={e => setNewBlockType(e.target.value as BlockType)}
                disabled={loading}
              >
                {BLOCK_TYPE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {newBlockType !== 'divider' && (
              <>
                <input
                  type="text"
                  value={blockText}
                  onChange={e => setBlockText(e.target.value)}
                  placeholder={
                    newBlockType === 'button' ? 'Button text' : 'Block content...'
                  }
                  disabled={loading}
                />
                {newBlockType === 'input' && (
                  <>
                    <input
                      type="text"
                      value={blockLabel}
                      onChange={e => setBlockLabel(e.target.value)}
                      placeholder="Label"
                      disabled={loading}
                    />
                    <input
                      type="text"
                      value={blockPlaceholder}
                      onChange={e => setBlockPlaceholder(e.target.value)}
                      placeholder="Placeholder text"
                      disabled={loading}
                    />
                  </>
                )}
              </>
            )}

            <button
              onClick={handleAddBlock}
              disabled={loading}
              className="add-block-btn"
            >
              <Plus size={16} />
              Add Block
            </button>
          </div>

          {/* Blocks Preview */}
          <div className="blocks-editor">
            {blocks.length === 0 ? (
              <div className="empty-blocks">
                <p>No blocks added yet</p>
                <p className="hint">Add blocks above to build your message</p>
              </div>
            ) : (
              <div className="blocks-list">
                {blocks.map((block) => (
                  <div key={block.id} className="block-item">
                    <div className="block-badge">{block.type}</div>
                    <div className="block-content">
                      {block.type === 'divider' && (
                        <div className="divider-preview">
                          <hr />
                        </div>
                      )}
                      {block.type === 'section' && (
                        <div className="section-preview">
                          <p>{block.text || '(empty)'}</p>
                        </div>
                      )}
                      {block.type === 'button' && (
                        <div className="button-preview">
                          <button disabled>{block.text}</button>
                        </div>
                      )}
                      {block.type === 'input' && (
                        <div className="input-preview">
                          <label>{block.label || 'Input'}</label>
                          <input
                            type="text"
                            placeholder={block.placeholder || 'Enter text...'}
                            disabled
                          />
                        </div>
                      )}
                      {block.type === 'image' && (
                        <div className="image-preview">
                          <div className="image-placeholder">Image: {block.altText}</div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteBlock(block.id)}
                      className="delete-block-btn"
                      disabled={loading}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Export */}
          {blocks.length > 0 && (
            <div className="export-section">
              <button onClick={handleExportJson} className="export-btn">
                <Eye size={16} />
                Copy JSON
              </button>
              <pre className="json-preview">{JSON.stringify(blocks, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>

      {/* Save Template Modal */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Save Block Template</h3>

            <div className="form-group">
              <label>Template Name</label>
              <input
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="e.g., Approval Request, Status Update"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Blocks ({blocks.length})</label>
              <div className="blocks-summary">
                {blocks.map(block => (
                  <div key={block.id} className="block-summary-item">
                    {block.type}
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => setShowTemplateModal(false)}
                disabled={loading}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={loading}
                className="save-btn"
              >
                {loading ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SlackBlockKitBuilder;

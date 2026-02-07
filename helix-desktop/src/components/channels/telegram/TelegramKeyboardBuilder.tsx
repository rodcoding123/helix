/**
 * Telegram Inline Keyboard Builder
 *
 * Visual UI for building Telegram inline keyboards:
 * - Create button grids
 * - Set button labels and callbacks
 * - Preview keyboard layout
 * - Save keyboard templates
 */

import { useState, useCallback } from 'react';
import { Plus, Trash2, Copy, Download } from 'lucide-react';
import { getGatewayClient } from '../../../lib/gateway-client';
import type { ChannelAccount } from '../ChannelAccountTabs';

export interface KeyboardButton {
  id: string;
  label: string;
  callback: string;
  url?: string;
  row: number;
  col: number;
}

export interface KeyboardTemplate {
  id: string;
  name: string;
  buttons: KeyboardButton[];
  createdAt: number;
}

interface TelegramKeyboardBuilderProps {
  account?: ChannelAccount;
  channelId: string;
}

interface TelegramKeyboardResponse {
  ok?: boolean;
  templates?: KeyboardTemplate[];
  template?: KeyboardTemplate;
}

export function TelegramKeyboardBuilder({
  account: propsAccount,
  _channelId,
}: TelegramKeyboardBuilderProps) {
  const account = propsAccount || { id: 'default', name: 'Primary' };
  const [templates, setTemplates] = useState<KeyboardTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<KeyboardTemplate | null>(null);
  const [buttons, setButtons] = useState<KeyboardButton[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showButtonModal, _setShowButtonModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [newButton, setNewButton] = useState({
    label: '',
    callback: '',
    row: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [editingButtonId, _setEditingButtonId] = useState<string | null>(null);

  // Load templates
  const _loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        throw new Error('Gateway not connected');
      }

      const result = await client.request('channels.telegram.keyboards.list', {
        accountId: account.id,
      }) as TelegramKeyboardResponse;

      if (result?.ok) {
        setTemplates(result.templates || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [account.id]);

  // Save template
  const handleSaveTemplate = useCallback(async () => {
    if (!templateName.trim() || buttons.length === 0) {
      setError('Template name and buttons required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        throw new Error('Gateway not connected');
      }

      const result = await client.request('channels.telegram.keyboards.create', {
        accountId: account.id,
        name: templateName,
        buttons,
      }) as TelegramKeyboardResponse;

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
  }, [templateName, buttons, account.id]);

  // Add button
  const handleAddButton = useCallback(() => {
    if (!newButton.label.trim() || !newButton.callback.trim()) {
      setError('Label and callback required');
      return;
    }

    const button: KeyboardButton = {
      id: `btn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      label: newButton.label,
      callback: newButton.callback,
      row: newButton.row,
      col: buttons.filter(b => b.row === newButton.row).length,
    };

    setButtons(prev => [...prev, button]);
    setNewButton({ label: '', callback: '', row: 0 });
  }, [newButton, buttons]);

  // Delete button
  const handleDeleteButton = useCallback((buttonId: string) => {
    setButtons(prev => prev.filter(b => b.id !== buttonId));
  }, []);

  // Delete template
  const handleDeleteTemplate = useCallback(
    async (templateId: string) => {
      if (!confirm('Delete this keyboard template?')) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const client = getGatewayClient();
        if (!client?.connected) {
          throw new Error('Gateway not connected');
        }

        await client.request('channels.telegram.keyboards.delete', {
          accountId: account.id,
          templateId,
        });

        setTemplates(prev => prev.filter(t => t.id !== templateId));
        if (selectedTemplate?.id === templateId) {
          setSelectedTemplate(null);
          setButtons([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [selectedTemplate, account.id]
  );

  // Load template buttons
  const loadTemplate = useCallback((template: KeyboardTemplate) => {
    setSelectedTemplate(template);
    setButtons(template.buttons);
  }, []);

  // Copy JSON
  const handleCopyJson = useCallback(() => {
    const json = JSON.stringify(buttons, null, 2);
    navigator.clipboard.writeText(json);
  }, [buttons]);

  // Export template
  const handleExportTemplate = useCallback(() => {
    const json = JSON.stringify(selectedTemplate, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplate?.name || 'keyboard'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedTemplate]);

  // Group buttons by row
  const getButtonRows = () => {
    const rows: KeyboardButton[][] = [];
    buttons.forEach(btn => {
      if (!rows[btn.row]) rows[btn.row] = [];
      rows[btn.row].push(btn);
    });
    return rows;
  };

  const maxRows = Math.max(...buttons.map(b => b.row), -1) + 1;

  return (
    <div className="telegram-keyboard-builder">
      <div className="builder-header">
        <h3>Inline Keyboard Builder</h3>
        <button
          onClick={() => setShowTemplateModal(true)}
          disabled={loading}
          className="save-button"
          title="Save keyboard as template"
        >
          <Download size={16} />
          Save Template
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="builder-layout">
        {/* Templates Sidebar */}
        <div className="templates-list">
          <div className="templates-header">
            <h4>Templates</h4>
            <div className="template-count">{templates.length}</div>
          </div>

          <div className="templates-scroll">
            {templates.length === 0 ? (
              <div className="empty-state">
                <p>No templates yet</p>
              </div>
            ) : (
              templates.map(template => (
                <div
                  key={template.id}
                  className={`template-item ${
                    selectedTemplate?.id === template.id ? 'active' : ''
                  }`}
                  onClick={() => loadTemplate(template)}
                >
                  <div className="template-info">
                    <div className="template-name">{template.name}</div>
                    <div className="template-meta">
                      {template.buttons.length} buttons
                    </div>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleDeleteTemplate(template.id);
                    }}
                    className="delete-btn"
                    disabled={loading}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Builder Panel */}
        <div className="builder-panel">
          <div className="builder-content">
            <div className="section">
              <h4>Buttons</h4>

              <div className="button-input">
                <input
                  type="text"
                  value={newButton.label}
                  onChange={e => setNewButton({ ...newButton, label: e.target.value })}
                  placeholder="Button label"
                  disabled={loading}
                />
                <input
                  type="text"
                  value={newButton.callback}
                  onChange={e => setNewButton({ ...newButton, callback: e.target.value })}
                  placeholder="Callback data"
                  disabled={loading}
                />
                <select
                  value={newButton.row}
                  onChange={e => setNewButton({ ...newButton, row: parseInt(e.target.value) })}
                  disabled={loading}
                >
                  <option value={0}>Row 0</option>
                  <option value={1}>Row 1</option>
                  <option value={2}>Row 2</option>
                  <option value={3}>Row 3</option>
                </select>
                <button
                  onClick={handleAddButton}
                  disabled={loading}
                  className="add-btn"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="buttons-list">
                {getButtonRows().map((row, rowIdx) => (
                  <div key={rowIdx} className="button-row">
                    <div className="row-label">Row {rowIdx}</div>
                    <div className="row-buttons">
                      {row.map(btn => (
                        <div key={btn.id} className="button-item">
                          <div className="button-preview">
                            <div className="button-label">{btn.label}</div>
                            <div className="button-callback">{btn.callback}</div>
                          </div>
                          <button
                            onClick={() => handleDeleteButton(btn.id)}
                            className="delete-btn-small"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {buttons.length === 0 && (
                <div className="empty-buttons">
                  <p>No buttons added yet</p>
                  <p className="hint">Add buttons above to build your keyboard</p>
                </div>
              )}
            </div>

            {/* Preview */}
            {buttons.length > 0 && (
              <div className="section">
                <h4>Preview</h4>

                <div className="keyboard-preview">
                  <div className="preview-header">How it looks on Telegram</div>
                  <div className="keyboard-grid">
                    {getButtonRows().map((row, rowIdx) => (
                      <div key={rowIdx} className="preview-row">
                        {row.map(btn => (
                          <button key={btn.id} className="preview-button">
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="preview-json">
                  <div className="json-header">
                    <span>JSON Export</span>
                    <button onClick={handleCopyJson} className="copy-btn">
                      <Copy size={14} />
                      Copy
                    </button>
                  </div>
                  <pre>{JSON.stringify(buttons, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>

          {selectedTemplate && (
            <div className="template-actions">
              <button
                onClick={handleExportTemplate}
                disabled={loading}
                className="export-btn"
              >
                <Download size={16} />
                Export
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Save Template Modal */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Save Keyboard Template</h3>

            <div className="form-group">
              <label>Template Name</label>
              <input
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="e.g., Menu Buttons, Quick Actions"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Buttons</label>
              <div className="template-buttons-preview">
                {buttons.length > 0 ? (
                  <div className="buttons-count">{buttons.length} buttons in {maxRows} rows</div>
                ) : (
                  <div className="no-buttons">Add buttons to the builder first</div>
                )}
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
                disabled={loading || buttons.length === 0}
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

export default TelegramKeyboardBuilder;

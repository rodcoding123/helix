/**
 * Custom Tools Route - Enhanced Desktop Edition
 * Create, manage, execute, and share custom JavaScript tools with sandboxed execution
 */

import { useEffect, useState, memo } from 'react';
import { Plus, Search, Zap, Loader, X, Copy, Share2, Trash2, Code, Download, Upload, Save } from 'lucide-react';
import { useCustomTools, type CustomTool } from '../hooks/useCustomTools';
import { useTauriFileOps } from '../hooks/useTauriFileOps';
import type { Exportable } from '../services/tauri-commands';
import '../components/tools/ToolsEnhanced.css';

// Memoized tool card component for performance
interface ToolCardProps {
  tool: CustomTool;
  activeTab: string;
  onExecute: (tool: CustomTool) => void;
  onCopyCode: (code: string) => void;
  onExport: (tool: Exportable) => void;
  onDelete: (toolId: string) => void;
  onClone: (tool: CustomTool) => void;
  onShare: (tool: CustomTool) => void;
  tauriLoading: boolean;
}

const ToolCard = memo(({ tool, activeTab, onExecute, onCopyCode, onExport, onDelete, onClone, onShare, tauriLoading }: ToolCardProps) => (
  <div key={tool.id} className="tool-card">
    <div className="tool-icon">{tool.icon || '🔧'}</div>
    <h3 className="tool-name">{tool.name}</h3>
    <p className="tool-desc">{tool.description}</p>
    <div className="tool-meta">
      <span className="version">v{tool.version || '1.0.0'}</span>
      <span className="usage">Used {tool.usageCount || 0}x</span>
    </div>
    <div className="tool-actions">
      <button className="btn btn-icon" title="Execute" onClick={() => onExecute(tool)}>
        <Zap size={18} />
      </button>
      <button className="btn btn-icon" title="Copy Code" onClick={() => onCopyCode(tool.code)} disabled={tauriLoading}>
        <Code size={18} />
      </button>
      {activeTab === 'my-tools' && (
        <>
          <button className="btn btn-icon" title="Export" onClick={() => onExport(tool)} disabled={tauriLoading}>
            <Download size={18} />
          </button>
          <button className="btn btn-icon" title="Clone" onClick={() => onClone(tool)}>
            <Copy size={18} />
          </button>
          <button className="btn btn-icon" title="Share" onClick={() => onShare(tool)} disabled={tool.visibility === 'private'}>
            <Share2 size={18} />
          </button>
          <button className="btn btn-icon btn-danger" title="Delete" onClick={() => onDelete(tool.id)}>
            <Trash2 size={18} />
          </button>
        </>
      )}
    </div>
  </div>
));

// Tool templates for quick start
const TOOL_TEMPLATES = [
  {
    id: 'text-counter',
    name: 'Text Counter',
    description: 'Count words, chars, lines in text',
    code: `async function main() {
  const text = params.text || '';
  return {
    chars: text.length,
    words: text.split(/\\s+/).filter(w => w.length > 0).length,
    lines: text.split('\\n').length
  };
}
return await main();`
  },
  {
    id: 'json-formatter',
    name: 'JSON Formatter',
    description: 'Format and validate JSON',
    code: `async function main() {
  try {
    const json = JSON.parse(params.input);
    return {
      valid: true,
      formatted: JSON.stringify(json, null, 2),
      size: JSON.stringify(json).length
    };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}
return await main();`
  },
  {
    id: 'base64-encoder',
    name: 'Base64 Encoder',
    description: 'Encode/decode base64 strings',
    code: `async function main() {
  const text = params.text || '';
  const mode = params.mode || 'encode';

  if (mode === 'encode') {
    return { result: btoa(text) };
  } else {
    try {
      return { result: atob(text) };
    } catch (e) {
      return { error: 'Invalid base64' };
    }
  }
}
return await main();`
  }
];

interface ExecutionResult {
  success: boolean;
  output?: unknown;
  executionTimeMs?: number;
  error?: string;
}

export default function CustomToolsEnhanced() {
  const {
    customTools,
    publicTools,
    isLoading,
    error,
    validationResult,
    loadCustomTools,
    loadPublicTools,
    createCustomTool,
    validateCode,
    executeTool,
    deleteTool
  } = useCustomTools();

  const {
    exportTool,
    importTool,
    copyToClipboard,
    saveResult,
    notify,
    isLoading: tauriLoading
  } = useTauriFileOps();

  const [activeTab, setActiveTab] = useState<'my-tools' | 'marketplace' | 'templates'>('my-tools');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedTool, setSelectedTool] = useState<CustomTool | null>(null);
  const [showExecute, setShowExecute] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [executionParams, setExecutionParams] = useState<string>('{}');

  // Builder form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🔧');
  const [code, setCode] = useState(
    'async function main() {\n  // Your tool code here\n  return { result: params };\n}\nreturn await main();'
  );
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [sandboxProfile, setSandboxProfile] = useState<'strict' | 'standard' | 'permissive'>(
    'standard'
  );
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const capabilityTypes = [
    'filesystem:read',
    'filesystem:write',
    'network:outbound',
    'network:localhost'
  ] as const;

  useEffect(() => {
    loadCustomTools();
    loadPublicTools();
  }, [loadCustomTools, loadPublicTools]);

  const handleValidateCode = () => {
    validateCode(code, selectedCapabilities);
  };

  const handleCreateTool = async () => {
    try {
      setIsSubmitting(true);

      const result = await validateCode(code, selectedCapabilities);
      if (!result.valid) {
        return;
      }

      await createCustomTool({
        name,
        description,
        code,
        capabilities: selectedCapabilities,
        sandboxProfile,
        visibility,
        version: '1.0.0'
      });

      // Reset and close
      resetForm();
      setShowBuilder(false);
      await loadCustomTools();
    } catch (err) {
      console.error('Failed to create tool:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteTool = async () => {
    try {
      if (!selectedTool) return;

      setExecutionResult(null);

      let params = {};
      try {
        params = JSON.parse(executionParams);
      } catch (e) {
        setExecutionResult({
          success: false,
          error: 'Invalid JSON parameters: ' + (e as Error).message
        });
        return;
      }

      const result = await executeTool(selectedTool.id, params);
      setExecutionResult(result as ExecutionResult);
    } catch (err) {
      setExecutionResult({
        success: false,
        error: err instanceof Error ? err.message : 'Execution failed'
      });
    }
  };

  const handleLoadTemplate = (template: (typeof TOOL_TEMPLATES)[0]) => {
    setName(template.name);
    setDescription(template.description);
    setCode(template.code);
    setShowBuilder(true);
    setActiveTab('my-tools');
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setIcon('🔧');
    setCode(
      'async function main() {\n  // Your tool code here\n  return { result: params };\n}\nreturn await main();'
    );
    setSelectedCapabilities([]);
    setSandboxProfile('standard');
    setVisibility('private');
  };

  const handleDeleteTool = async (toolId: string) => {
    if (!confirm('Are you sure you want to delete this tool?')) return;

    try {
      await deleteTool(toolId);
      await loadCustomTools();
    } catch (err) {
      console.error('Failed to delete tool:', err);
    }
  };

  const handleCloneTool = async (tool: CustomTool) => {
    try {
      // Create a copy with new ID and " (Copy)" appended to name
      await createCustomTool({
        name: `${tool.name} (Copy)`,
        description: tool.description,
        code: tool.code,
        icon: tool.icon,
        capabilities: tool.capabilities || [],
        sandboxProfile: tool.sandboxProfile || 'standard',
        visibility: 'private', // Always clone as private
        version: '1.0.0'
      });
      await loadCustomTools();
    } catch (err) {
      console.error('Failed to clone tool:', err);
    }
  };

  const handleShareTool = async (tool: CustomTool) => {
    try {
      // Generate shareable link (would need backend implementation)
      const shareUrl = `helix://tools/shared/${tool.id}`;
      await navigator.clipboard.writeText(shareUrl);
      alert(`Share link copied to clipboard:\n${shareUrl}\n\nNote: Sharing requires updating tool visibility to "public" or "shared"`);
    } catch (err) {
      console.error('Failed to share tool:', err);
      // Fallback: just copy the tool ID
      await navigator.clipboard.writeText(tool.id);
      alert(`Tool ID copied to clipboard: ${tool.id}`);
    }
  };

  const tools =
    activeTab === 'my-tools'
      ? customTools
      : activeTab === 'marketplace'
        ? publicTools
        : ([] as CustomTool[]);

  const filteredTools = tools.filter(
    tool =>
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Main view
  if (!showBuilder && !showExecute) {
    return (
      <div className="tools-container">
        <div className="tools-header">
          <div className="tools-title">
            <Zap className="icon" size={32} />
            <div>
              <h1>Custom Tools</h1>
              <p>Build, execute, and share custom JavaScript tools</p>
            </div>
          </div>
          <div className="header-buttons">
            <button className="btn btn-primary btn-lg" onClick={() => setShowBuilder(true)}>
              <Plus size={20} />
              New Tool
            </button>
            <button
              className="btn btn-secondary btn-lg"
              onClick={async () => {
                try {
                  const content = await importTool();
                  if (content) {
                    const toolData = JSON.parse(content);
                    await createCustomTool(toolData);
                  }
                } catch (err) {
                  await notify('Import Failed', err instanceof Error ? err.message : 'Failed to import tool', 'error');
                }
              }}
              disabled={tauriLoading}
            >
              <Upload size={20} />
              Import Tool
            </button>
          </div>
        </div>

        <div className="tools-tabs">
          <button
            className={`tab ${activeTab === 'my-tools' ? 'active' : ''}`}
            onClick={() => setActiveTab('my-tools')}
          >
            My Tools ({customTools.length})
          </button>
          <button
            className={`tab ${activeTab === 'marketplace' ? 'active' : ''}`}
            onClick={() => setActiveTab('marketplace')}
          >
            Marketplace ({publicTools.length})
          </button>
          <button
            className={`tab ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            Templates ({TOOL_TEMPLATES.length})
          </button>
        </div>

        {activeTab === 'templates' ? (
          <div className="templates-grid">
            {TOOL_TEMPLATES.map(template => (
              <div key={template.id} className="template-card">
                <div className="template-header">
                  <h3>{template.name}</h3>
                </div>
                <p className="template-desc">{template.description}</p>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleLoadTemplate(template)}
                >
                  <Code size={16} />
                  Use Template
                </button>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="tools-search">
              <Search size={20} />
              <input
                type="text"
                placeholder="Search tools..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {isLoading && (
              <div className="loading">
                <Loader className="spinner" size={24} />
                Loading tools...
              </div>
            )}

            {error && <div className="error-box">{error}</div>}

            <div className="tools-grid">
              {filteredTools.length === 0 ? (
                <div className="empty-state">
                  <p>
                    {activeTab === 'my-tools'
                      ? 'No tools yet. Create your first tool!'
                      : 'No public tools found'}
                  </p>
                </div>
              ) : (
                filteredTools.map(tool => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    activeTab={activeTab}
                    onExecute={(t) => {
                      setSelectedTool(t);
                      setShowExecute(true);
                    }}
                    onCopyCode={copyToClipboard}
                    onExport={exportTool}
                    onDelete={handleDeleteTool}
                    onClone={handleCloneTool}
                    onShare={handleShareTool}
                    tauriLoading={tauriLoading}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // Execute view
  if (showExecute && selectedTool) {
    return (
      <div className="tools-container">
        <div className="modal-header">
          <h2>Execute Tool: {selectedTool.name}</h2>
          <button className="btn-close" onClick={() => setShowExecute(false)}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-content">
          <div className="execute-section">
            <label>Parameters (JSON)</label>
            <textarea
              className="json-editor"
              value={executionParams}
              onChange={e => setExecutionParams(e.target.value)}
              placeholder='{\n  "key": "value"\n}'
              rows={6}
            />

            <button
              className="btn btn-primary btn-lg"
              onClick={handleExecuteTool}
              disabled={isLoading}
            >
              {isLoading ? 'Executing...' : 'Execute Tool'}
            </button>
          </div>

          {executionResult && (
            <div className="result-section">
              <h3>Results</h3>
              {executionResult.success ? (
                <div className="result-success">
                  <div className="result-time">
                    Executed in {executionResult.executionTimeMs}ms
                  </div>
                  <pre className="result-output">
                    {JSON.stringify(executionResult.output, null, 2)}
                  </pre>
                  <button
                    className="btn btn-secondary"
                    onClick={() => saveResult(executionResult, selectedTool.name, 'tool')}
                    disabled={tauriLoading}
                  >
                    <Save size={16} />
                    Save Results
                  </button>
                </div>
              ) : (
                <div className="result-error">{executionResult.error}</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Builder view
  return (
    <div className="tools-container">
      <div className="modal-header">
        <h2>Create New Tool</h2>
        <button className="btn-close" onClick={() => setShowBuilder(false)}>
          <X size={24} />
        </button>
      </div>

      <div className="builder-content">
        <div className="form-section">
          <div className="form-group">
            <label>Tool Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., JSON Validator"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Icon</label>
              <input
                type="text"
                value={icon}
                onChange={e => setIcon(e.target.value)}
                placeholder="😀"
                maxLength={2}
              />
            </div>

            <div className="form-group">
              <label>Sandbox Profile</label>
              <select
                value={sandboxProfile}
                onChange={e => setSandboxProfile(e.target.value as 'strict' | 'standard' | 'permissive')}
              >
                <option value="strict">Strict</option>
                <option value="standard">Standard</option>
                <option value="permissive">Permissive</option>
              </select>
            </div>

            <div className="form-group">
              <label>Visibility</label>
              <select value={visibility} onChange={e => setVisibility(e.target.value as 'private' | 'public')}>
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this tool do?"
              rows={2}
            />
          </div>

          <div className="form-group">
            <label>Code *</label>
            <textarea
              className="code-editor"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Enter JavaScript code"
              rows={15}
            />
            <button className="btn btn-secondary" onClick={handleValidateCode}>
              Validate Code
            </button>
            {validationResult && (
              <div className={`validation ${validationResult.valid ? 'valid' : 'invalid'}`}>
                {validationResult.valid ? (
                  <p>✓ Code is valid and safe</p>
                ) : (
                  <div>
                    {validationResult.errors.map((err, i) => (
                      <p key={i}>✗ {err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Capabilities</label>
            <div className="capabilities-grid">
              {capabilityTypes.map(cap => (
                <label key={cap} className="checkbox">
                  <input
                    type="checkbox"
                    checked={selectedCapabilities.includes(cap)}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedCapabilities([...selectedCapabilities, cap]);
                      } else {
                        setSelectedCapabilities(selectedCapabilities.filter(c => c !== cap));
                      }
                    }}
                  />
                  {cap}
                </label>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setShowBuilder(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreateTool}
              disabled={isSubmitting || !name || !code}
            >
              {isSubmitting ? 'Creating...' : 'Create Tool'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

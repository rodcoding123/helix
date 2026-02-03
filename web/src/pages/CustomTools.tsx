import { FC, useEffect, useState } from 'react';
import { Plus, Search, Zap, Loader, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCustomTools } from '@/hooks/useCustomTools';
import type { CustomToolDefinition, ToolParameter } from '@/lib/types/custom-tools';
import type { CustomTool } from '@/lib/types/custom-tools';
import { CustomToolCard } from '@/components/tools/CustomToolCard';
import { ToolCapabilityBadge } from '@/components/tools/ToolCapabilityBadge';
import { CustomToolExecutor } from '@/components/tools/CustomToolExecutor';

/**
 * Custom Tools Page: Create, manage, and execute custom tools
 * Allows users to build tools without coding through visual interface
 */
export const CustomToolsPage: FC = () => {
  const { user, loading: authLoading } = useAuth();
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
  } = useCustomTools();

  const [activeTab, setActiveTab] = useState<'my-tools' | 'marketplace'>('my-tools');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [showExecutor, setShowExecutor] = useState(false);
  const [selectedTool, setSelectedTool] = useState<CustomTool | null>(null);

  // Builder form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🔧');
  const [code, setCode] = useState('async function execute(params, context) {\n  return { result: params };\n}');
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [sandboxProfile, setSandboxProfile] = useState<'strict' | 'standard' | 'permissive'>('standard');
  const [parameters, setParameters] = useState<ToolParameter[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [newTag, setNewTag] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const capabilityTypes = [
    'filesystem:read',
    'filesystem:write',
    'network:outbound',
    'network:localhost',
    'mcp:tools',
  ] as const;

  useEffect(() => {
    if (user?.id) {
      loadCustomTools(user.id);
      loadPublicTools();
    }
  }, [user?.id, loadCustomTools, loadPublicTools]);

  const handleValidateCode = () => {
    validateCode(code, selectedCapabilities);
  };

  const handleExecuteTool = async (tool: CustomTool) => {
    if (!user?.id) return;
    setSelectedTool(tool);
    setShowExecutor(true);
  };

  const handleRunToolExecution = async (params: Record<string, any>) => {
    if (!user?.id || !selectedTool) return;
    return await executeTool(user.id, selectedTool.id, params);
  };

  const handleAddParameter = () => {
    setParameters([
      ...parameters,
      { name: '', type: 'string', description: '', required: false },
    ]);
  };

  const handleRemoveParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setNewTag('');
    }
  };

  const handleCreateTool = async () => {
    if (!user?.id || !name.trim() || !code.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // Validate code first
      const validation = validateCode(code, selectedCapabilities);
      if (!validation.valid) {
        alert(`Code validation failed: ${validation.errors.join(', ')}`);
        return;
      }

      const definition: CustomToolDefinition = {
        name,
        description,
        code,
        parameters,
        capabilities: selectedCapabilities as any,
        sandbox_profile: sandboxProfile,
        tags,
        icon,
        visibility,
      };

      await createCustomTool(user.id, definition);

      // Reset form
      setName('');
      setDescription('');
      setIcon('🔧');
      setCode('async function execute(params, context) {\n  return { result: params };\n}');
      setSelectedCapabilities([]);
      setSandboxProfile('standard');
      setParameters([]);
      setTags([]);
      setVisibility('private');
      setShowBuilder(false);

      alert('Tool created successfully!');
    } catch (err) {
      alert(`Failed to create tool: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return <div className="p-8 text-slate-400">Loading...</div>;
  }

  if (!user) {
    return <div className="p-8 text-slate-400">Please sign in to manage custom tools</div>;
  }

  const displayTools = activeTab === 'my-tools'
    ? customTools.filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : publicTools.filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description.toLowerCase().includes(searchQuery.toLowerCase())
      );

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 mb-2 flex items-center gap-2">
              <Zap className="text-purple-500" />
              Custom Tools
            </h1>
            <p className="text-slate-400">Create and execute custom tools without writing code</p>
          </div>
          {!showBuilder && (
            <button
              onClick={() => setShowBuilder(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <Plus size={20} />
              Create Tool
            </button>
          )}
        </div>

        {/* Builder */}
        {showBuilder && (
          <div className="mb-8 p-6 rounded-lg border border-slate-700 bg-slate-900">
            <h2 className="text-xl font-bold text-slate-100 mb-6">Create New Tool</h2>

            <div className="space-y-6">
              {/* Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Tool Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                    placeholder="e.g., Text Reverser"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Icon</label>
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    maxLength={2}
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 text-center text-2xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                  placeholder="What does this tool do?"
                  rows={2}
                />
              </div>

              {/* Parameters */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-slate-300">Parameters</label>
                  <button
                    onClick={handleAddParameter}
                    className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                  >
                    + Add Parameter
                  </button>
                </div>
                <div className="space-y-3">
                  {parameters.map((param, idx) => (
                    <div key={idx} className="p-3 bg-slate-800 rounded border border-slate-700">
                      <div className="grid grid-cols-4 gap-2">
                        <input
                          type="text"
                          placeholder="Name"
                          value={param.name}
                          onChange={(e) => {
                            const updated = [...parameters];
                            updated[idx].name = e.target.value;
                            setParameters(updated);
                          }}
                          className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-slate-100 text-sm"
                        />
                        <select
                          value={param.type}
                          onChange={(e) => {
                            const updated = [...parameters];
                            updated[idx].type = e.target.value as any;
                            setParameters(updated);
                          }}
                          className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-slate-100 text-sm"
                        >
                          <option>string</option>
                          <option>number</option>
                          <option>boolean</option>
                          <option>object</option>
                          <option>array</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Description"
                          value={param.description}
                          onChange={(e) => {
                            const updated = [...parameters];
                            updated[idx].description = e.target.value;
                            setParameters(updated);
                          }}
                          className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-slate-100 text-sm"
                        />
                        <button
                          onClick={() => handleRemoveParameter(idx)}
                          className="rounded bg-red-900/20 text-red-400 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Code *</label>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 font-mono text-sm"
                  rows={8}
                  placeholder="async function execute(params, context) { ... }"
                />
                <button
                  onClick={handleValidateCode}
                  className="mt-2 px-3 py-1 text-sm bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                >
                  Validate Code
                </button>
              </div>

              {/* Validation Result */}
              {validationResult && (
                <div className={`p-4 rounded ${validationResult.valid ? 'bg-green-500/10 border border-green-500/50' : 'bg-red-500/10 border border-red-500/50'}`}>
                  <p className={`font-medium ${validationResult.valid ? 'text-green-400' : 'text-red-400'}`}>
                    {validationResult.valid ? '✓ Code is valid' : '✗ Code validation failed'}
                  </p>
                  {validationResult.errors.length > 0 && (
                    <ul className="mt-2 text-sm text-red-300">
                      {validationResult.errors.map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                    </ul>
                  )}
                  {validationResult.warnings.length > 0 && (
                    <ul className="mt-2 text-sm text-yellow-300">
                      {validationResult.warnings.map((warn, i) => (
                        <li key={i}>⚠ {warn}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Capabilities */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Capabilities</label>
                <div className="space-y-2">
                  {capabilityTypes.map((cap) => (
                    <ToolCapabilityBadge
                      key={cap}
                      capability={cap}
                      selected={selectedCapabilities.includes(cap)}
                      onChange={(selected) => {
                        if (selected) {
                          setSelectedCapabilities([...selectedCapabilities, cap]);
                        } else {
                          setSelectedCapabilities(
                            selectedCapabilities.filter((c) => c !== cap)
                          );
                        }
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Sandbox Profile */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Sandbox Profile</label>
                <select
                  value={sandboxProfile}
                  onChange={(e) => setSandboxProfile(e.target.value as any)}
                  className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                >
                  <option value="strict">Strict (10s timeout, 64MB RAM, no network/write)</option>
                  <option value="standard">Standard (30s timeout, 128MB RAM)</option>
                  <option value="permissive">Permissive (60s timeout, 256MB RAM, /tmp write)</option>
                </select>
              </div>

              {/* Tags & Visibility */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Tags</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddTag();
                        }
                      }}
                      className="flex-1 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 text-sm"
                      placeholder="Add tag..."
                    />
                    <button
                      onClick={handleAddTag}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded flex items-center gap-1"
                      >
                        {tag}
                        <button
                          onClick={() => setTags(tags.filter((t) => t !== tag))}
                          className="text-slate-500 hover:text-slate-400"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Visibility</label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as any)}
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                  >
                    <option value="private">Private (only you)</option>
                    <option value="public">Public (marketplace)</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBuilder(false)}
                  className="flex-1 px-4 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTool}
                  disabled={isSubmitting || !validationResult?.valid}
                  className="flex-1 px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Tool'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-4 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('my-tools')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'my-tools'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            My Tools ({customTools.length})
          </button>
          <button
            onClick={() => setActiveTab('marketplace')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'marketplace'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Marketplace ({publicTools.length})
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={20} />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-10 pr-4 py-2 text-slate-100 placeholder-slate-500"
            />
          </div>
        </div>

        {/* Tools Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="text-slate-400 animate-spin" size={24} />
          </div>
        ) : displayTools.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400">
              {activeTab === 'my-tools'
                ? 'No custom tools yet. Create one to get started!'
                : 'No public tools available'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayTools.map((tool) => (
              <CustomToolCard
                key={tool.id}
                tool={tool}
                onExecute={handleExecuteTool}
              />
            ))}
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 rounded bg-red-500/10 border border-red-500/50 text-red-400">
            {error}
          </div>
        )}

        {/* Tool Executor Modal */}
        {showExecutor && selectedTool && user && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl bg-slate-900 rounded-lg p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-100">
                  {selectedTool.icon} Execute: {selectedTool.name}
                </h2>
                <button
                  onClick={() => {
                    setShowExecutor(false);
                    setSelectedTool(null);
                  }}
                  className="p-1 hover:bg-slate-800 rounded"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <CustomToolExecutor
                tool={selectedTool}
                userId={user.id}
                onExecute={handleRunToolExecution}
                isExecuting={isLoading}
              />

              <button
                onClick={() => {
                  setShowExecutor(false);
                  setSelectedTool(null);
                }}
                className="mt-6 w-full px-4 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

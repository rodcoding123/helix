/**
 * Desktop Custom Tools Page
 * Phase 3: Create, manage, and execute custom tools
 */

import React, { FC, useEffect, useState } from 'react';
import { Plus, Search, Zap, Loader, X, File, Download, Upload } from 'lucide-react';
import { useCustomTools } from '@/hooks/useCustomTools';
import { useAuth } from '@/hooks/useAuth';
import type { CustomTool, CustomToolDefinition, ToolParameter } from '@/lib/types/custom-tools';
import { CustomToolCard } from '@/components/tools/CustomToolCard';
import { CustomToolExecutor } from '@/components/tools/CustomToolExecutor';
import { ToolCapabilityBadge } from '@/components/tools/ToolCapabilityBadge';

export const CustomToolsPage: FC = () => {
  const { user } = useAuth();
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
    updateTool,
    deleteTool,
  } = useCustomTools();

  const [activeTab, setActiveTab] = useState<'my-tools' | 'marketplace'>('my-tools');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [showExecutor, setShowExecutor] = useState(false);
  const [selectedTool, setSelectedTool] = useState<CustomTool | null>(null);
  const [editingTool, setEditingTool] = useState<CustomTool | null>(null);

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
  }, [user?.id]);

  const handleValidateCode = () => {
    validateCode(code, selectedCapabilities);
  };

  const handleExecuteTool = (tool: CustomTool) => {
    if (!user?.id) return;
    setSelectedTool(tool);
    setShowExecutor(true);
  };

  const handleRunToolExecution = async (params: Record<string, any>) => {
    if (!user?.id || !selectedTool) return;
    return await executeTool(user.id, selectedTool.id, params);
  };

  const handleEditTool = (tool: CustomTool) => {
    setEditingTool(tool);
    setName(tool.name);
    setDescription(tool.description || '');
    setIcon(tool.icon || '🔧');
    setCode(tool.code);
    setSelectedCapabilities(tool.capabilities || []);
    setSandboxProfile((tool.sandbox_profile as any) || 'standard');
    setParameters(tool.parameters || []);
    setTags(tool.tags || []);
    setVisibility(tool.visibility as any);
    setShowBuilder(true);
  };

  const handleSaveTool = async () => {
    if (!user?.id || !name.trim() || !code.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
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

      if (editingTool) {
        await updateTool(editingTool.id, definition);
        alert('Tool updated successfully!');
      } else {
        await createCustomTool(user.id, definition);
        alert('Tool created successfully!');
      }

      // Reset form
      resetForm();
      if (user?.id) loadCustomTools(user.id);
    } catch (err) {
      alert(`Failed to save tool: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setIcon('🔧');
    setCode('async function execute(params, context) {\n  return { result: params };\n}');
    setSelectedCapabilities([]);
    setSandboxProfile('standard');
    setParameters([]);
    setTags([]);
    setVisibility('private');
    setEditingTool(null);
    setShowBuilder(false);
  };

  const displayTools = activeTab === 'my-tools'
    ? customTools.filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : publicTools.filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );

  return (
    <div className="h-full bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Zap className="text-purple-500" size={28} />
            Custom Tools
          </h1>
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
        <p className="text-slate-400">Create and execute custom tools without writing code</p>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Builder Panel */}
        {showBuilder && (
          <div className="border-b border-slate-700 p-6 max-h-96 overflow-y-auto bg-slate-900/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-100">
                {editingTool ? 'Edit Tool' : 'Create New Tool'}
              </h2>
              <button
                onClick={resetForm}
                className="p-1 hover:bg-slate-800 rounded"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="Tool Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                />
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  maxLength={2}
                  className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 text-center text-xl"
                  placeholder="Icon"
                />
                <select
                  value={sandboxProfile}
                  onChange={(e) => setSandboxProfile(e.target.value as any)}
                  className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                >
                  <option value="strict">Strict (10s)</option>
                  <option value="standard">Standard (30s)</option>
                  <option value="permissive">Permissive (60s)</option>
                </select>
              </div>

              <textarea
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                rows={2}
              />

              <textarea
                placeholder="Code (async function execute(params, context) { ... })"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 font-mono text-xs"
                rows={3}
              />

              <button
                onClick={handleValidateCode}
                className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
              >
                Validate Code
              </button>

              {validationResult && (
                <div
                  className={`p-2 rounded text-xs ${
                    validationResult.valid
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {validationResult.valid ? '✓ Valid' : '✗ ' + validationResult.errors[0]}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={resetForm}
                  className="flex-1 px-3 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTool}
                  disabled={isSubmitting || !validationResult?.valid}
                  className="flex-1 px-3 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 text-sm"
                >
                  {isSubmitting ? 'Saving...' : 'Save Tool'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs and Search */}
        <div className="p-4 border-b border-slate-700 space-y-3">
          <div className="flex gap-4 border-b border-slate-700">
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

          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500"
              size={18}
            />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-900 pl-10 pr-4 py-2 text-slate-100 text-sm"
            />
          </div>
        </div>

        {/* Tools Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="text-slate-400 animate-spin" size={24} />
            </div>
          ) : displayTools.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              {activeTab === 'my-tools'
                ? 'No custom tools yet. Create one to get started!'
                : 'No public tools available'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayTools.map((tool) => (
                <CustomToolCard
                  key={tool.id}
                  tool={tool}
                  onExecute={() => handleExecuteTool(tool)}
                  onEdit={() => handleEditTool(tool)}
                  onDelete={() => {
                    if (confirm('Delete this tool?')) {
                      deleteTool(tool.id);
                    }
                  }}
                />
              ))}
            </div>
          )}

          {error && (
            <div className="p-4 rounded bg-red-500/10 border border-red-500/50 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Executor Modal */}
      {showExecutor && selectedTool && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl bg-slate-900 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-100">
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

            <div className="max-h-96 overflow-y-auto mb-6">
              <CustomToolExecutor
                tool={selectedTool}
                userId={user.id}
                onExecute={handleRunToolExecution}
                isExecuting={isLoading}
              />
            </div>

            <button
              onClick={() => {
                setShowExecutor(false);
                setSelectedTool(null);
              }}
              className="w-full px-4 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

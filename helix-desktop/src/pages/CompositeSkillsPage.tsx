/**
 * Desktop Composite Skills Page
 * Phase 3: Create and execute multi-step tool workflows
 */

import React, { FC, useEffect, useState } from 'react';
import { Plus, Play, Trash2, Loader, AlertCircle, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCompositeSkills } from '@/hooks/useCompositeSkills';
import type { CompositeSkill, SkillStep } from '@/lib/types/composite-skills';

export const CompositeSkillsPage: FC = () => {
  const { user } = useAuth();
  const {
    compositeSkills,
    currentSkill,
    executionHistory,
    currentExecution,
    isLoading,
    error,
    validationResult,
    validateSteps,
    loadCompositeSkills,
    createCompositeSkill,
    executeSkill,
    loadExecutionHistory,
    deleteSkill,
  } = useCompositeSkills();

  const [showBuilder, setShowBuilder] = useState(false);
  const [showExecutor, setShowExecutor] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<CompositeSkill | null>(null);

  // Builder form state
  const [skillName, setSkillName] = useState('');
  const [skillDescription, setSkillDescription] = useState('');
  const [skillIcon, setSkillIcon] = useState('⚙️');
  const [steps, setSteps] = useState<SkillStep[]>([
    {
      stepId: 'step1',
      toolName: '',
      toolType: 'custom',
      inputMapping: {},
      errorHandling: 'continue',
    },
  ]);
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');

  // Executor state
  const [executionInput, setExecutionInput] = useState<Record<string, any>>({});
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadCompositeSkills(user.id);
    }
  }, [user?.id]);

  const handleAddStep = () => {
    const newStepId = `step${steps.length + 1}`;
    setSteps([
      ...steps,
      {
        stepId: newStepId,
        toolName: '',
        toolType: 'custom',
        inputMapping: {},
        errorHandling: 'continue',
      },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleValidateSteps = () => {
    validateSteps(steps);
  };

  const handleCreateSkill = async () => {
    if (!user?.id || !skillName.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    const validation = validateSteps(steps);
    if (!validation.valid) {
      alert(`Validation failed: ${validation.errors.join(', ')}`);
      return;
    }

    try {
      await createCompositeSkill(user.id, {
        name: skillName,
        description: skillDescription,
        steps,
        tags,
        icon: skillIcon,
        visibility,
      });

      resetForm();
      if (user?.id) loadCompositeSkills(user.id);
      alert('Skill created successfully!');
    } catch (err) {
      alert(`Failed to create skill: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const resetForm = () => {
    setSkillName('');
    setSkillDescription('');
    setSkillIcon('⚙️');
    setSteps([
      {
        stepId: 'step1',
        toolName: '',
        toolType: 'custom',
        inputMapping: {},
        errorHandling: 'continue',
      },
    ]);
    setTags([]);
    setVisibility('private');
    setShowBuilder(false);
  };

  const handleExecuteSkill = async (skill: CompositeSkill) => {
    if (!user?.id) return;

    setSelectedSkill(skill);
    setShowExecutor(true);
    loadExecutionHistory(skill.id);
  };

  const handleRunExecution = async () => {
    if (!user?.id || !selectedSkill) return;

    setIsExecuting(true);
    try {
      await executeSkill(selectedSkill, user.id, executionInput);
      setExecutionInput({});
      alert('Skill executed successfully!');
    } catch (err) {
      alert(`Execution failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="h-full bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 mb-2">Composite Skills</h1>
            <p className="text-slate-400">Chain multiple tools into powerful workflows</p>
          </div>
          {!showBuilder && (
            <button
              onClick={() => setShowBuilder(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <Plus size={20} />
              Create Skill
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Builder Panel */}
        {showBuilder && (
          <div className="border-b border-slate-700 p-6 max-h-96 overflow-y-auto bg-slate-900/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-100">Create New Skill</h2>
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
                  placeholder="Skill name"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                />
                <input
                  type="text"
                  placeholder="Icon"
                  value={skillIcon}
                  onChange={(e) => setSkillIcon(e.target.value)}
                  maxLength={2}
                  className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 text-center text-xl"
                />
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as any)}
                  className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </div>

              <textarea
                placeholder="Description"
                value={skillDescription}
                onChange={(e) => setSkillDescription(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                rows={2}
              />

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="font-semibold text-slate-100">Workflow Steps</label>
                  <button
                    onClick={handleAddStep}
                    className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                  >
                    + Add Step
                  </button>
                </div>

                <div className="space-y-2 max-h-24 overflow-y-auto">
                  {steps.map((step, idx) => (
                    <div key={step.stepId} className="p-2 bg-slate-800 rounded border border-slate-700">
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Tool name"
                          value={step.toolName}
                          onChange={(e) => {
                            const updated = [...steps];
                            updated[idx].toolName = e.target.value;
                            setSteps(updated);
                          }}
                          className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-slate-100 text-xs"
                        />
                        <select
                          value={step.errorHandling}
                          onChange={(e) => {
                            const updated = [...steps];
                            updated[idx].errorHandling = e.target.value as any;
                            setSteps(updated);
                          }}
                          className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-slate-100 text-xs"
                        >
                          <option>continue</option>
                          <option>stop</option>
                          <option>retry</option>
                        </select>
                        <button
                          onClick={() => handleRemoveStep(idx)}
                          className="rounded bg-red-900/20 text-red-400 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleValidateSteps}
                  className="mt-2 text-sm px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                >
                  Validate Steps
                </button>

                {validationResult && (
                  <div
                    className={`mt-2 p-2 rounded text-xs ${
                      validationResult.valid
                        ? 'bg-green-500/10 border border-green-500/50 text-green-400'
                        : 'bg-red-500/10 border border-red-500/50 text-red-400'
                    }`}
                  >
                    {validationResult.valid ? '✓ Valid' : '✗ ' + validationResult.errors[0]}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={resetForm}
                  className="flex-1 px-3 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSkill}
                  disabled={isLoading || !validationResult?.valid}
                  className="flex-1 px-3 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 text-sm"
                >
                  Create Skill
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Skills Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="text-slate-400 animate-spin" size={24} />
            </div>
          ) : compositeSkills.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              No skills yet. Create one to get started!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {compositeSkills.map((skill) => (
                <div key={skill.id} className="p-4 rounded-lg border border-slate-700 bg-slate-900">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-slate-100">
                      {skill.icon} {skill.name}
                    </h3>
                    {skill.visibility === 'public' && (
                      <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded">
                        Public
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mb-3">{skill.description}</p>
                  <p className="text-xs text-slate-500 mb-4">
                    {skill.steps.length} steps • {skill.execution_count} executions
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleExecuteSkill(skill)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded"
                    >
                      <Play size={16} />
                      Execute
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this skill?')) {
                          deleteSkill(skill.id);
                        }
                      }}
                      className="px-3 py-1.5 bg-red-900/20 hover:bg-red-900/30 text-red-400 text-sm rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="p-4 rounded bg-red-500/10 border border-red-500/50 text-red-400 flex gap-2 text-sm">
              <AlertCircle size={20} />
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Executor Modal */}
      {showExecutor && selectedSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl bg-slate-900 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-100">
                Execute: {selectedSkill.name}
              </h2>
              <button
                onClick={() => {
                  setShowExecutor(false);
                  setSelectedSkill(null);
                }}
                className="p-1 hover:bg-slate-800 rounded"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {currentExecution && (
              <div className="mb-6 p-4 bg-slate-800 rounded border border-slate-700">
                <p className="text-sm font-semibold text-slate-100 mb-2">Last Execution</p>
                <p
                  className={`text-sm ${
                    currentExecution.status === 'completed'
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}
                >
                  {currentExecution.status.toUpperCase()} • {currentExecution.execution_time_ms}ms
                </p>
              </div>
            )}

            <div className="flex gap-3 mb-6">
              <button
                onClick={() => {
                  setShowExecutor(false);
                  setSelectedSkill(null);
                }}
                className="flex-1 px-4 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm"
              >
                Close
              </button>
              <button
                onClick={handleRunExecution}
                disabled={isExecuting}
                className="flex-1 px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 text-sm"
              >
                {isExecuting ? 'Executing...' : 'Execute Skill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

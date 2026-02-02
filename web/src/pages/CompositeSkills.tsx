import { FC, useEffect, useState } from 'react';
import { Plus, Play, Trash2, Loader, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCompositeSkills } from '@/hooks/useCompositeSkills';
import type { CompositeSkill, SkillStep } from '@/lib/types/composite-skills';

/**
 * Composite Skills Page: Create and execute tool workflows
 * Enables chaining multiple tools with conditional logic
 */
export const CompositeSkillsPage: FC = () => {
  const { user, loading: authLoading } = useAuth();
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
  }, [user?.id, loadCompositeSkills]);

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

    // Validate first
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

      // Reset form
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

      alert('Skill created successfully!');
    } catch (err) {
      alert(`Failed to create skill: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
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
    } catch (err) {
      alert(`Execution failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  if (authLoading) {
    return <div className="p-8 text-slate-400">Loading...</div>;
  }

  if (!user) {
    return <div className="p-8 text-slate-400">Please sign in to manage skills</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 mb-2">Composite Skills</h1>
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

        {/* Builder */}
        {showBuilder && (
          <div className="mb-8 p-6 rounded-lg border border-slate-700 bg-slate-900">
            <h2 className="text-xl font-bold text-slate-100 mb-6">Create New Skill</h2>

            <div className="space-y-6">
              {/* Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Skill name"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                />
                <input
                  type="text"
                  placeholder="Icon (emoji)"
                  value={skillIcon}
                  onChange={(e) => setSkillIcon(e.target.value)}
                  maxLength={2}
                  className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 text-center text-2xl"
                />
              </div>

              <textarea
                placeholder="Description"
                value={skillDescription}
                onChange={(e) => setSkillDescription(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                rows={2}
              />

              {/* Steps */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="font-semibold text-slate-100">Workflow Steps</label>
                  <button
                    onClick={handleAddStep}
                    className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                  >
                    + Add Step
                  </button>
                </div>

                <div className="space-y-3">
                  {steps.map((step, idx) => (
                    <div key={step.stepId} className="p-4 bg-slate-800 rounded border border-slate-700">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                          type="text"
                          placeholder="Tool name"
                          value={step.toolName}
                          onChange={(e) => {
                            const updated = [...steps];
                            updated[idx].toolName = e.target.value;
                            setSteps(updated);
                          }}
                          className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-slate-100 text-sm"
                        />
                        <select
                          value={step.toolType}
                          onChange={(e) => {
                            const updated = [...steps];
                            updated[idx].toolType = e.target.value as any;
                            setSteps(updated);
                          }}
                          className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-slate-100 text-sm"
                        >
                          <option>custom</option>
                          <option>builtin</option>
                          <option>mcp</option>
                        </select>
                        <select
                          value={step.errorHandling}
                          onChange={(e) => {
                            const updated = [...steps];
                            updated[idx].errorHandling = e.target.value as any;
                            setSteps(updated);
                          }}
                          className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-slate-100 text-sm"
                        >
                          <option>continue</option>
                          <option>stop</option>
                          <option>retry</option>
                        </select>
                      </div>
                      <button
                        onClick={() => handleRemoveStep(idx)}
                        className="mt-2 text-xs px-2 py-1 bg-red-900/20 text-red-400 rounded"
                      >
                        Remove Step
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleValidateSteps}
                  className="mt-3 text-sm px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                >
                  Validate Steps
                </button>

                {validationResult && (
                  <div
                    className={`mt-3 p-3 rounded text-sm ${
                      validationResult.valid
                        ? 'bg-green-500/10 border border-green-500/50 text-green-400'
                        : 'bg-red-500/10 border border-red-500/50 text-red-400'
                    }`}
                  >
                    {validationResult.valid ? '✓ Valid' : '✗ ' + validationResult.errors.join(', ')}
                  </div>
                )}
              </div>

              {/* Visibility */}
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as any)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBuilder(false)}
                  className="flex-1 px-4 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSkill}
                  disabled={isLoading || !validationResult?.valid}
                  className="flex-1 px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Create Skill'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Skills Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="text-slate-400 animate-spin" size={24} />
          </div>
        ) : compositeSkills.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            No skills yet. Create one to get started!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

        {/* Executor Modal */}
        {showExecutor && currentSkill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl bg-slate-900 rounded-lg p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-slate-100 mb-6">
                Execute: {currentSkill.name}
              </h2>

              {/* Current Execution */}
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
                  {currentExecution.error_message && (
                    <p className="text-sm text-red-400 mt-2">{currentExecution.error_message}</p>
                  )}
                </div>
              )}

              {/* Execution History */}
              {executionHistory.length > 0 && (
                <div className="mb-6">
                  <p className="text-sm font-semibold text-slate-100 mb-2">Recent Executions</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {executionHistory.slice(0, 5).map((exec) => (
                      <div key={exec.id} className="text-xs p-2 bg-slate-800 rounded">
                        <p className={`${exec.status === 'completed' ? 'text-green-400' : 'text-red-400'}`}>
                          {exec.status} • {exec.execution_time_ms}ms
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowExecutor(false);
                    setSelectedSkill(null);
                  }}
                  className="flex-1 px-4 py-2 rounded border border-slate-700 text-slate-300"
                >
                  Close
                </button>
                <button
                  onClick={handleRunExecution}
                  disabled={isExecuting}
                  className="flex-1 px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                >
                  {isExecuting ? 'Executing...' : 'Execute Skill'}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 rounded bg-red-500/10 border border-red-500/50 text-red-400 flex gap-2">
            <AlertCircle size={20} />
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

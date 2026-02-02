/**
 * Composite Skills Route - Enhanced Desktop Edition
 * Build complex multi-step workflows by chaining tools together
 */

import { useEffect, useState } from 'react';
import { Plus, Search, Loader, X, Trash2, ChevronDown, Play } from 'lucide-react';
import { useCompositeSkills } from '../hooks/useCompositeSkills';
import '../components/skills/SkillsEnhanced.css';

interface SkillStep {
  stepId: string;
  toolName: string;
  description?: string;
  inputMapping?: Record<string, string>;
  outputMapping?: string;
  condition?: string;
  errorHandling?: 'stop' | 'continue' | 'retry';
}

export default function CompositeSkillsEnhanced() {
  const {
    compositeSkills,
    isLoading,
    error,
    loadCompositeSkills,
    validateSkill,
    createCompositeSkill,
    executeSkill
  } = useCompositeSkills();

  const [searchQuery, setSearchQuery] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<any>(null);
  const [showExecute, setShowExecute] = useState(false);

  // Builder state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<SkillStep[]>([]);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available tools for selection (mock - in real app would fetch from backend)
  const AVAILABLE_TOOLS = [
    { id: 'fetch-data', name: 'Fetch Data', description: 'Fetch data from API' },
    { id: 'transform-json', name: 'Transform JSON', description: 'Transform JSON structure' },
    { id: 'validate-schema', name: 'Validate Schema', description: 'Validate against schema' },
    { id: 'save-to-db', name: 'Save to DB', description: 'Save data to database' },
    { id: 'send-notification', name: 'Send Notification', description: 'Send notification' },
    { id: 'generate-report', name: 'Generate Report', description: 'Generate report' }
  ];

  useEffect(() => {
    loadCompositeSkills();
  }, [loadCompositeSkills]);

  const handleAddStep = () => {
    const newStepId = `step-${Date.now()}`;
    setSteps([
      ...steps,
      {
        stepId: newStepId,
        toolName: '',
        inputMapping: {},
        outputMapping: '$.result',
        errorHandling: 'stop'
      }
    ]);
    setExpandedStep(newStepId);
  };

  const handleUpdateStep = (stepId: string, updates: Partial<SkillStep>) => {
    setSteps(steps.map(s => (s.stepId === stepId ? { ...s, ...updates } : s)));
  };

  const handleRemoveStep = (stepId: string) => {
    setSteps(steps.filter(s => s.stepId !== stepId));
  };

  const handleMoveStep = (stepId: string, direction: 'up' | 'down') => {
    const index = steps.findIndex(s => s.stepId === stepId);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === steps.length - 1)) {
      return;
    }

    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setSteps(newSteps);
  };

  const handleCreateSkill = async () => {
    try {
      setIsSubmitting(true);

      if (!name || steps.length === 0) {
        alert('Skill name and at least one step are required');
        return;
      }

      const skillDef = {
        id: Math.random().toString(36).substring(7),
        name,
        description,
        steps
      };

      const validation = await validateSkill(skillDef);
      if (!validation.valid) {
        alert(`Validation failed: ${validation.errors.join(', ')}`);
        return;
      }

      await createCompositeSkill({
        name,
        description,
        steps,
        version: '1.0.0',
        visibility: 'private' as const
      });

      // Reset
      setName('');
      setDescription('');
      setSteps([]);
      setShowBuilder(false);
      await loadCompositeSkills();
    } catch (err) {
      console.error('Failed to create skill:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSkills = compositeSkills.filter(
    skill =>
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Main view
  if (!showBuilder && !showExecute) {
    return (
      <div className="skills-container">
        <div className="skills-header">
          <div className="skills-title">
            <div>
              <h1>Composite Skills</h1>
              <p>Build multi-step workflows by chaining tools together</p>
            </div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => setShowBuilder(true)}>
            <Plus size={20} />
            New Skill
          </button>
        </div>

        <div className="skills-search">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {isLoading && (
          <div className="loading">
            <Loader className="spinner" size={24} />
            Loading skills...
          </div>
        )}

        {error && <div className="error-box">{error}</div>}

        <div className="skills-grid">
          {filteredSkills.length === 0 ? (
            <div className="empty-state">
              <p>No skills yet. Build your first workflow!</p>
            </div>
          ) : (
            filteredSkills.map(skill => (
              <div key={skill.id} className="skill-card">
                <h3 className="skill-name">{skill.name}</h3>
                <p className="skill-desc">{skill.description || 'No description'}</p>
                <div className="skill-stats">
                  <span>{skill.steps.length} steps</span>
                  <span>Executed {skill.executionCount || 0}x</span>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setSelectedSkill(skill);
                    setShowExecute(true);
                  }}
                >
                  <Play size={16} />
                  Execute
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Builder view
  if (showBuilder) {
    return (
      <div className="skills-container">
        <div className="modal-header">
          <h2>Build New Skill</h2>
          <button className="btn-close" onClick={() => setShowBuilder(false)}>
            <X size={24} />
          </button>
        </div>

        <div className="builder-content">
          <div className="form-section">
            <div className="form-group">
              <label>Skill Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Data Processing Pipeline"
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe what this workflow does"
                rows={2}
              />
            </div>
          </div>

          <div className="steps-section">
            <div className="section-header">
              <h3>Workflow Steps ({steps.length})</h3>
              <button className="btn btn-secondary btn-sm" onClick={handleAddStep}>
                <Plus size={16} />
                Add Step
              </button>
            </div>

            {steps.length === 0 ? (
              <div className="empty-steps">
                <p>No steps yet. Add steps to build your workflow.</p>
              </div>
            ) : (
              <div className="steps-list">
                {steps.map((step, index) => (
                  <div key={step.stepId} className="step-item">
                    <div
                      className="step-header"
                      onClick={() =>
                        setExpandedStep(expandedStep === step.stepId ? null : step.stepId)
                      }
                    >
                      <div className="step-info">
                        <span className="step-number">{index + 1}</span>
                        <span className="step-tool">
                          {step.toolName || 'Select a tool'}
                        </span>
                        {step.description && <span className="step-desc">{step.description}</span>}
                      </div>
                      <div className="step-controls">
                        <ChevronDown
                          size={20}
                          className={expandedStep === step.stepId ? 'expanded' : ''}
                        />
                      </div>
                    </div>

                    {expandedStep === step.stepId && (
                      <div className="step-details">
                        <div className="form-group">
                          <label>Tool *</label>
                          <select
                            value={step.toolName}
                            onChange={e => handleUpdateStep(step.stepId, { toolName: e.target.value })}
                          >
                            <option value="">Select a tool</option>
                            {AVAILABLE_TOOLS.map(tool => (
                              <option key={tool.id} value={tool.id}>
                                {tool.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group">
                          <label>Description</label>
                          <input
                            type="text"
                            value={step.description || ''}
                            onChange={e =>
                              handleUpdateStep(step.stepId, { description: e.target.value })
                            }
                            placeholder="Optional description"
                          />
                        </div>

                        <div className="form-group">
                          <label>Input Mapping (JSONPath)</label>
                          <input
                            type="text"
                            placeholder="$.data"
                            defaultValue={JSON.stringify(step.inputMapping)}
                            onChange={e => {
                              try {
                                const mapping = JSON.parse(e.target.value);
                                handleUpdateStep(step.stepId, { inputMapping: mapping });
                              } catch {
                                // Keep existing value
                              }
                            }}
                          />
                          <small>Maps input parameters from previous steps</small>
                        </div>

                        <div className="form-group">
                          <label>Output Mapping (JSONPath)</label>
                          <input
                            type="text"
                            value={step.outputMapping || '$.result'}
                            onChange={e =>
                              handleUpdateStep(step.stepId, { outputMapping: e.target.value })
                            }
                            placeholder="$.result"
                          />
                          <small>Extracts output from this step's result</small>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>Condition (optional)</label>
                            <input
                              type="text"
                              placeholder="$.prev.success === true"
                              onChange={e =>
                                handleUpdateStep(step.stepId, { condition: e.target.value })
                              }
                            />
                          </div>

                          <div className="form-group">
                            <label>Error Handling</label>
                            <select
                              value={step.errorHandling || 'stop'}
                              onChange={e =>
                                handleUpdateStep(step.stepId, {
                                  errorHandling: e.target.value as any
                                })
                              }
                            >
                              <option value="stop">Stop</option>
                              <option value="continue">Continue</option>
                              <option value="retry">Retry</option>
                            </select>
                          </div>
                        </div>

                        <div className="step-actions">
                          {index > 0 && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleMoveStep(step.stepId, 'up')}
                            >
                              ↑ Move Up
                            </button>
                          )}
                          {index < steps.length - 1 && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleMoveStep(step.stepId, 'down')}
                            >
                              ↓ Move Down
                            </button>
                          )}
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleRemoveStep(step.stepId)}
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setShowBuilder(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreateSkill}
              disabled={isSubmitting || !name || steps.length === 0}
            >
              {isSubmitting ? 'Creating...' : 'Create Skill'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Execute view
  if (showExecute && selectedSkill) {
    return (
      <div className="skills-container">
        <div className="modal-header">
          <h2>Execute: {selectedSkill.name}</h2>
          <button className="btn-close" onClick={() => setShowExecute(false)}>
            <X size={24} />
          </button>
        </div>

        <div className="execute-view">
          <div className="execution-info">
            <p>{selectedSkill.description}</p>
            <div className="step-count">Workflow: {selectedSkill.steps.length} steps</div>
          </div>

          <button
            className="btn btn-primary btn-lg"
            onClick={async () => {
              try {
                await executeSkill(selectedSkill.id);
              } catch (err) {
                console.error('Execution failed:', err);
              }
            }}
          >
            <Play size={20} />
            Run Workflow
          </button>
        </div>
      </div>
    );
  }

  return null;
}

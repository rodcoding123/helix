/**
 * Composite Skills System Types
 * Enables chaining multiple tools into reusable workflows
 */

export interface SkillStep {
  stepId: string;
  toolName: string;                 // Custom tool or built-in tool
  toolType: 'custom' | 'builtin' | 'mcp';
  inputMapping: Record<string, string>;  // JSONPath mapping: {"param1": "$.step1.output.data"}
  condition?: {
    field: string;                  // JSONPath to evaluate
    operator: 'equals' | 'contains' | 'gt' | 'lt' | 'exists';
    value: any;
  };
  errorHandling: 'continue' | 'stop' | 'retry';
  maxRetries?: number;
  description?: string;
}

export interface CompositeSkill {
  id: string;
  user_id: string;
  name: string;
  description: string;
  steps: SkillStep[];
  version: string;
  tags: string[];
  icon: string;
  execution_count: number;
  last_executed: string | null;
  is_enabled: boolean;
  visibility: 'private' | 'public';
  created_at: string;
  updated_at: string;
}

export interface StepExecutionResult {
  stepId: string;
  toolName: string;
  toolType: string;
  input: any;
  output: any;
  success: boolean;
  error?: string;
  executionTime: number;
  timestamp: string;
  retryCount?: number;
}

export interface CompositeSkillExecution {
  id: string;
  composite_skill_id: string;
  user_id: string;
  input_params: Record<string, any>;
  steps_executed: StepExecutionResult[];
  final_output: any;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  error_message: string | null;
  execution_time_ms: number;
  steps_completed: number;
  total_steps: number;
  created_at: string;
}

export interface CompositeSkillDefinition {
  name: string;
  description: string;
  steps: SkillStep[];
  tags?: string[];
  icon?: string;
  visibility?: 'private' | 'public';
}

export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export type JSONPathOperator = 'equals' | 'contains' | 'gt' | 'lt' | 'exists';

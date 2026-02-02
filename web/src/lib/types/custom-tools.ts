/**
 * Custom Tools System Types
 * Enables users to create custom tools without coding
 */

export interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  [key: string]: any;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  defaultValue?: any;
}

export type ToolCapability =
  | 'filesystem:read'
  | 'filesystem:write'
  | 'network:outbound'
  | 'network:localhost'
  | 'process:spawn'
  | 'mcp:tools';

export interface CustomTool {
  id: string;
  user_id: string;
  name: string;
  description: string;
  parameters: JSONSchema;
  code: string;
  signature: string | null;
  capabilities: ToolCapability[];
  sandbox_profile: 'strict' | 'standard' | 'permissive';
  version: string;
  tags: string[];
  icon: string;
  usage_count: number;
  last_used: string | null;
  is_enabled: boolean;
  visibility: 'private' | 'public';
  clone_source_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  code: string;
  capabilities: ToolCapability[];
  sandbox_profile?: 'strict' | 'standard' | 'permissive';
  tags?: string[];
  icon?: string;
  visibility?: 'private' | 'public';
}

export interface ToolExecutionResult {
  success: boolean;
  output: any;
  error?: string;
  executionTime: number;
  resourceUsage: {
    memory: number;
    cpu: number;
  };
}

export interface CustomToolUsageLog {
  id: string;
  custom_tool_id: string;
  user_id: string;
  input_params: Record<string, any> | null;
  output_result: any | null;
  status: 'success' | 'failure' | 'timeout';
  error_message: string | null;
  execution_time_ms: number;
  memory_used_mb: number;
  timestamp: string;
}

export interface CodeValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  detectedDangerousFunctions: string[];
}

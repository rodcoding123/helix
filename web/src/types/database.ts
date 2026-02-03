/**
 * Supabase Database Type Definitions
 * Generated from schema or manually defined
 */

export interface Database {
  public: {
    Tables: {
      custom_tools: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description?: string;
          code: string;
          parameters?: Record<string, any>;
          capabilities?: string[];
          sandbox_profile?: string;
          is_enabled: boolean;
          usage_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['custom_tools']['Row'], 'id' | 'created_at' | 'updated_at' | 'usage_count'>;
        Update: Partial<Database['public']['Tables']['custom_tools']['Insert']>;
      };
      composite_skills: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description?: string;
          steps: Array<{
            stepId: string;
            toolId?: string;
            toolName?: string;
            inputMapping?: Record<string, string>;
            errorHandling?: string;
            condition?: string;
          }>;
          is_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['composite_skills']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['composite_skills']['Insert']>;
      };
      memory_synthesis_jobs: {
        Row: {
          id: string;
          user_id: string;
          synthesis_type: string;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          progress: number;
          insights?: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['memory_synthesis_jobs']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['memory_synthesis_jobs']['Insert']>;
      };
      custom_tool_usage: {
        Row: {
          id: string;
          custom_tool_id: string;
          user_id: string;
          input_params?: Record<string, any>;
          output_result?: Record<string, any>;
          status: 'success' | 'failed' | 'error';
          execution_time_ms: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['custom_tool_usage']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['custom_tool_usage']['Insert']>;
      };
      composite_skill_executions: {
        Row: {
          id: string;
          composite_skill_id: string;
          user_id: string;
          input_params?: Record<string, any>;
          final_output?: Record<string, any>;
          steps_executed?: Array<{ stepId: string; success: boolean }>;
          status: 'completed' | 'failed' | 'error';
          execution_time_ms: number;
          steps_completed: number;
          total_steps: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['composite_skill_executions']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['composite_skill_executions']['Insert']>;
      };
      memory_patterns: {
        Row: {
          id: string;
          user_id: string;
          pattern_type: string;
          layer: number;
          description: string;
          evidence: string[];
          confidence: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['memory_patterns']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['memory_patterns']['Insert']>;
      };
      synthesis_recommendations: {
        Row: {
          id: string;
          user_id: string;
          pattern_id: string;
          recommendation: string;
          category: string;
          priority: 'low' | 'medium' | 'high';
          status: 'pending' | 'completed' | 'dismissed';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['synthesis_recommendations']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['synthesis_recommendations']['Insert']>;
      };
    };
    Views: Record<string, unknown>;
    Functions: Record<string, unknown>;
    Enums: Record<string, unknown>;
  };
}

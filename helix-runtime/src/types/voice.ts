/**
 * Voice Recording Types
 * Week 5 Track 5: Voice Recording UI
 */

export interface VoiceMemo {
  id: string;
  user_id: string;
  audio_url: string; // Supabase Storage path
  duration_ms: number;
  transcript: string;
  transcript_confidence?: number;
  title?: string;
  tags?: string[];
  session_key?: string;
  synthesis_triggered?: boolean;
  synthesis_status?: 'pending' | 'processing' | 'complete' | 'failed';
  recorded_at: string;
  created_at: string;
  updated_at: string;
}

export interface VoiceTranscript {
  id: string;
  user_id: string;
  memo_id: string;
  text: string;
  speaker: 'user' | 'helix' | 'other';
  confidence?: number;
  segment_index?: number;
  created_at: string;
}

export interface VoiceCommand {
  id: string;
  user_id: string;
  trigger_phrase: string;
  tool_id?: string;
  action_type: 'tool' | 'navigation' | 'system';
  action_params?: Record<string, any>;
  enabled: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface VoicemailMessage {
  id: string;
  user_id: string;
  audio_url: string;
  duration_ms?: number;
  transcript?: string;
  from_number: string;
  from_name?: string;
  is_read: boolean;
  is_archived: boolean;
  received_at: string;
  created_at: string;
}

export interface CreateVoiceMemoParams {
  audio_url: string;
  duration_ms: number;
  transcript: string;
  title?: string;
  tags?: string[];
}

export interface UpdateVoiceMemoParams {
  id: string;
  title?: string;
  tags?: string[];
  synthesis_triggered?: boolean;
  synthesis_status?: string;
}

export interface CreateVoiceCommandParams {
  trigger_phrase: string;
  action_type: 'tool' | 'navigation' | 'system';
  tool_id?: string;
  action_params?: Record<string, any>;
}

export interface VoiceRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob?: Blob;
  transcript?: string;
  error?: string;
}

export interface AudioVisualizerProps {
  isActive: boolean;
  frequency?: number[];
  waveform?: number[];
}

export interface VoiceMemoListParams {
  user_id: string;
  limit?: number;
  offset?: number;
  tags?: string[];
  query?: string;
}

export interface VoiceMemoSearchParams {
  user_id: string;
  query: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

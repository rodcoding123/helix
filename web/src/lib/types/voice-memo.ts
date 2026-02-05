/**
 * Voice Memo Types
 * Phase 4.1: Voice recording, transcription, and command infrastructure
 */

export type TranscriptionModel = 'deepgram' | 'openai' | 'google';
export type AudioFormat = 'webm' | 'mp3' | 'wav';
export type TranscriptionStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type VoiceActionType = 'tool' | 'skill' | 'navigation' | 'system';

/**
 * Voice Memo: User-recorded voice message
 */
export interface VoiceMemo {
  id: string;
  user_id: string;

  // Audio
  audio_url: string;
  audio_duration_ms: number;
  audio_size_bytes?: number;
  audio_format: AudioFormat;

  // Transcription
  transcript?: string;
  transcript_confidence?: number;
  transcription_model?: TranscriptionModel;

  // Metadata
  title?: string;
  description?: string;
  tags?: string[];
  session_key?: string;
  recorded_at: string;

  // Status
  is_processing: boolean;
  transcription_status: TranscriptionStatus;
  transcription_error?: string;

  created_at: string;
  updated_at: string;
}

/**
 * Voice Transcript: Indexed transcript segment for search
 */
export interface VoiceTranscript {
  id: string;
  voice_memo_id: string;
  user_id: string;

  segment_index?: number;
  segment_start_ms?: number;
  segment_end_ms?: number;

  text: string;
  confidence?: number;
  speaker_name?: string;

  created_at: string;
}

/**
 * Voice Command: Shortcut trigger for tools/skills
 */
export interface VoiceCommand {
  id: string;
  user_id: string;

  trigger_phrase: string; // "create task", "send email", etc

  action_type: VoiceActionType;
  tool_id?: string;
  skill_id?: string;
  navigation_target?: string;

  action_params?: Record<string, any>;

  enabled: boolean;
  usage_count: number;
  last_used_at?: string;

  created_at: string;
  updated_at: string;
}

/**
 * Voicemail Message: Received voicemail
 */
export interface VoicemailMessage {
  id: string;
  user_id: string;

  audio_url: string;
  audio_duration_ms?: number;

  from_number?: string;
  from_name?: string;
  transcript?: string;

  is_read: boolean;
  is_important: boolean;
  is_archived: boolean;

  received_at: string;
  created_at: string;
}

/**
 * Voice Recording State
 */
export interface VoiceRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // milliseconds
  audioLevel?: number; // 0-100 (optional to allow extension)
  error?: string;
}

/**
 * Voice Transcription Request
 */
export interface VoiceTranscriptionRequest {
  audio_blob: Blob;
  audio_format: AudioFormat;
  model?: TranscriptionModel;
  language?: string;
}

/**
 * Voice Transcription Result
 */
export interface VoiceTranscriptionResult {
  text: string;
  confidence: number;
  duration_ms: number;
  segments?: Array<{
    start_ms: number;
    end_ms: number;
    text: string;
    confidence: number;
    speaker?: string;
  }>;
  language?: string;
}

/**
 * Voice Search Query
 */
export interface VoiceSearchQuery {
  query: string;
  limit?: number;
  offset?: number;
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    tags?: string[];
    minConfidence?: number;
  };
}

/**
 * Voice Search Results
 */
export interface VoiceSearchResult {
  memo: VoiceMemo;
  transcript: VoiceTranscript;
  snippet: string; // Highlighted context
  relevance: number; // 0-1
}

/**
 * Voice Command Execution Context
 */
export interface VoiceCommandContext {
  command: VoiceCommand;
  transcript: string;
  confidence: number;
  executedAt: string;
  result?: any;
  error?: string;
}

/**
 * Voice Memo Statistics
 */
export interface VoiceMemoStats {
  totalMemos: number;
  totalDuration: number; // seconds
  totalSize: number; // bytes
  byTag: Record<string, number>;
  byDate: Record<string, number>;
  transcriptionRate: number; // 0-1
  averageConfidence: number;
}

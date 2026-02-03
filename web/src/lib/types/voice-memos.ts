/**
 * Voice Memos Type Definitions
 * Phase 4.1 Voice Enhancements
 */

export interface VoiceMemo {
  id: string;
  userId: string;
  audioUrl: string;
  durationMs: number;
  transcript: string;
  transcriptConfidence?: number;
  model?: 'openai' | 'google' | 'deepgram';
  title?: string;
  tags?: string[];
  sessionKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceTranscriptSearch {
  id: string;
  userId: string;
  query: string;
  resultsCount: number;
  resultIds: string[];
  createdAt: string;
}

export interface VoiceCommand {
  id: string;
  userId: string;
  triggerPhrase: string;
  triggerConfidence: number;
  actionType: 'tool' | 'skill' | 'navigation';
  targetId: string; // tool_id or skill_id
  actionParams?: Record<string, any>;
  enabled: boolean;
  usageCount: number;
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VoicemailMessage {
  id: string;
  userId: string;
  audioUrl: string;
  durationMs?: number;
  transcript?: string;
  fromNumber?: string;
  fromName?: string;
  isRead: boolean;
  archived: boolean;
  receivedAt: string;
  createdAt: string;
}

export interface VoiceRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob?: Blob;
  error?: string;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  model: string;
  duration_ms: number;
}

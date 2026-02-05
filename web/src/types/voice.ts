export interface VoiceMemo {
  id: string;
  title: string;
  duration?: number;
  duration_ms?: number;
  createdAt?: Date;
  created_at?: string;
  tags: string[];
  transcript?: string;
  audio_url?: string;
  user_id?: string;
  [key: string]: any;
}

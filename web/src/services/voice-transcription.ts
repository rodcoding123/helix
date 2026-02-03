/**
 * Voice Transcription Service
 * Phase 4.1 Week 2: Voice Recording & Transcription
 *
 * Integrates with Deepgram and OpenAI for speech-to-text transcription
 * Handles:
 * - Audio blob to text conversion
 * - Confidence scoring
 * - Speaker identification
 * - Language detection
 * - Segment-level timing
 */

export interface TranscriptionSegment {
  start_ms: number;
  end_ms: number;
  text: string;
  confidence: number;
  speaker?: string;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  duration_ms: number;
  language?: string;
  segments?: TranscriptionSegment[];
  success: boolean;
  error?: string;
}

type TranscriptionProvider = 'deepgram' | 'openai';

class VoiceTranscriptionService {
  private deepgramApiKey: string | null = null;
  private openaiApiKey: string | null = null;
  private provider: TranscriptionProvider = 'deepgram';

  constructor() {
    // Load API keys from environment
    this.deepgramApiKey = import.meta.env.VITE_DEEPGRAM_API_KEY || null;
    this.openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY || null;

    // Determine which provider to use
    if (this.deepgramApiKey) {
      this.provider = 'deepgram';
    } else if (this.openaiApiKey) {
      this.provider = 'openai';
    }
  }

  /**
   * Set the preferred transcription provider
   */
  setProvider(provider: TranscriptionProvider): void {
    if (provider === 'deepgram' && !this.deepgramApiKey) {
      console.warn('Deepgram API key not configured');
      return;
    }
    if (provider === 'openai' && !this.openaiApiKey) {
      console.warn('OpenAI API key not configured');
      return;
    }
    this.provider = provider;
  }

  /**
   * Transcribe audio blob using Deepgram API
   */
  private async transcribeWithDeepgram(
    audioBlob: Blob,
    language?: string
  ): Promise<TranscriptionResult> {
    if (!this.deepgramApiKey) {
      return {
        text: '',
        confidence: 0,
        duration_ms: 0,
        success: false,
        error: 'Deepgram API key not configured',
      };
    }

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const params = new URLSearchParams({
        model: 'nova-2-general',
        detect_language: language ? 'false' : 'true',
        punctuate: 'true',
        paragraphs: 'true',
        diarize: 'true', // Speaker identification
        smart_format: 'true',
      });

      if (language) {
        params.append('language', language);
      }

      const response = await fetch(
        `https://api.deepgram.com/v1/listen?${params.toString()}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Token ${this.deepgramApiKey}`,
          },
          body: audioBlob,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Deepgram transcription failed');
      }

      const result = await response.json();

      // Extract transcript from Deepgram response
      const transcript = result.results?.channels?.[0]?.alternatives?.[0];
      if (!transcript) {
        throw new Error('No transcript in Deepgram response');
      }

      // Process words into segments
      const segments = this.processDeepgramWords(
        transcript.words || [],
        result.metadata?.duration || 0
      );

      return {
        text: transcript.transcript || '',
        confidence: this.calculateAverageConfidence(transcript.words || []),
        duration_ms: (result.metadata?.duration || 0) * 1000,
        language: result.results?.channels?.[0]?.detected_language,
        segments,
        success: true,
      };
    } catch (error) {
      return {
        text: '',
        confidence: 0,
        duration_ms: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Deepgram transcription error',
      };
    }
  }

  /**
   * Transcribe audio blob using OpenAI Whisper API
   */
  private async transcribeWithOpenAI(
    audioBlob: Blob,
    language?: string
  ): Promise<TranscriptionResult> {
    if (!this.openaiApiKey) {
      return {
        text: '',
        confidence: 0,
        duration_ms: 0,
        success: false,
        error: 'OpenAI API key not configured',
      };
    }

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');

      if (language) {
        formData.append('language', language);
      }

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.openaiApiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI transcription failed');
      }

      const result = await response.json();

      // Process OpenAI response into segments
      const segments = this.processOpenAIWords(
        result.words || [],
        result.duration || 0
      );

      return {
        text: result.text || '',
        confidence: 0.95, // Whisper doesn't provide confidence per word in standard API
        duration_ms: (result.duration || 0) * 1000,
        language: language,
        segments,
        success: true,
      };
    } catch (error) {
      return {
        text: '',
        confidence: 0,
        duration_ms: 0,
        success: false,
        error: error instanceof Error ? error.message : 'OpenAI transcription error',
      };
    }
  }

  /**
   * Process Deepgram word objects into segments
   */
  private processDeepgramWords(
    words: any[],
    totalDuration: number
  ): TranscriptionSegment[] {
    const segments: TranscriptionSegment[] = [];
    let currentSegment: Partial<TranscriptionSegment> | null = null;

    for (const word of words) {
      const confidence = word.confidence || 0.9;
      const startMs = Math.round((word.start || 0) * 1000);
      const endMs = Math.round((word.end || 0) * 1000);

      if (
        !currentSegment ||
        startMs - (currentSegment.end_ms || 0) > 1000 ||
        (currentSegment.text?.length || 0) > 200
      ) {
        // Start new segment if gap > 1s or text is getting long
        if (currentSegment) {
          segments.push(currentSegment as TranscriptionSegment);
        }
        currentSegment = {
          text: word.punctuated_word || word.word,
          confidence,
          start_ms: startMs,
          end_ms: endMs,
        };
      } else {
        // Add to current segment
        currentSegment.text = (currentSegment.text || '') + ' ' + (word.punctuated_word || word.word);
        currentSegment.confidence = Math.min(currentSegment.confidence || 1, confidence);
        currentSegment.end_ms = endMs;
      }
    }

    if (currentSegment) {
      segments.push(currentSegment as TranscriptionSegment);
    }

    return segments;
  }

  /**
   * Process OpenAI word objects into segments
   */
  private processOpenAIWords(
    words: any[],
    totalDuration: number
  ): TranscriptionSegment[] {
    const segments: TranscriptionSegment[] = [];
    let currentSegment: Partial<TranscriptionSegment> | null = null;

    for (const word of words) {
      const confidence = 0.95; // Whisper API doesn't provide per-word confidence
      const startMs = Math.round((word.start || 0) * 1000);
      const endMs = Math.round((word.end || 0) * 1000);

      if (
        !currentSegment ||
        startMs - (currentSegment.end_ms || 0) > 1000 ||
        (currentSegment.text?.length || 0) > 200
      ) {
        if (currentSegment) {
          segments.push(currentSegment as TranscriptionSegment);
        }
        currentSegment = {
          text: word.word,
          confidence,
          start_ms: startMs,
          end_ms: endMs,
        };
      } else {
        currentSegment.text = (currentSegment.text || '') + ' ' + word.word;
        currentSegment.end_ms = endMs;
      }
    }

    if (currentSegment) {
      segments.push(currentSegment as TranscriptionSegment);
    }

    return segments;
  }

  /**
   * Calculate average confidence from word list
   */
  private calculateAverageConfidence(words: any[]): number {
    if (words.length === 0) return 0;
    const sum = words.reduce((acc, word) => acc + (word.confidence || 0.9), 0);
    return sum / words.length;
  }

  /**
   * Main transcription method - routes to appropriate provider
   */
  async transcribe(
    audioBlob: Blob,
    language?: string
  ): Promise<TranscriptionResult> {
    // Validate audio blob
    if (!(audioBlob instanceof Blob) || audioBlob.size === 0) {
      return {
        text: '',
        confidence: 0,
        duration_ms: 0,
        success: false,
        error: 'Invalid audio blob',
      };
    }

    // Route to appropriate provider
    if (this.provider === 'deepgram') {
      return this.transcribeWithDeepgram(audioBlob, language);
    } else {
      return this.transcribeWithOpenAI(audioBlob, language);
    }
  }

  /**
   * Check if any transcription provider is configured
   */
  isConfigured(): boolean {
    return !!this.deepgramApiKey || !!this.openaiApiKey;
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): TranscriptionProvider[] {
    const providers: TranscriptionProvider[] = [];
    if (this.deepgramApiKey) providers.push('deepgram');
    if (this.openaiApiKey) providers.push('openai');
    return providers;
  }

  /**
   * Get current provider
   */
  getCurrentProvider(): TranscriptionProvider {
    return this.provider;
  }
}

// Singleton instance
let transcriptionService: VoiceTranscriptionService | null = null;

export function getTranscriptionService(): VoiceTranscriptionService {
  if (!transcriptionService) {
    transcriptionService = new VoiceTranscriptionService();
  }
  return transcriptionService;
}

export function resetTranscriptionService(): void {
  transcriptionService = null;
}

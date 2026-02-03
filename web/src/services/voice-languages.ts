/**
 * Voice Multi-Language Support Service
 * Phase 4.2: Language detection, preference management, and localization
 *
 * Supported Languages:
 * - English (en-US, en-GB)
 * - Spanish (es-ES, es-MX)
 * - French (fr-FR, fr-CA)
 * - German (de-DE, de-AT)
 * - Mandarin Chinese (zh-CN, zh-TW)
 * - Japanese (ja-JP)
 */

import { supabase } from '@/lib/supabase';

export type LanguageCode =
  | 'en-US'
  | 'en-GB'
  | 'es-ES'
  | 'es-MX'
  | 'fr-FR'
  | 'fr-CA'
  | 'de-DE'
  | 'de-AT'
  | 'zh-CN'
  | 'zh-TW'
  | 'ja-JP';

export type LanguageFamily = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja';

export interface VoiceLanguagePreferences {
  userId: string;

  // Speech-to-Text preferences
  sttLanguage: LanguageCode;
  sttProvider: 'deepgram' | 'google' | 'openai';
  autoDetectLanguage: boolean;
  detectedLanguages: LanguageFamily[]; // Ranked by confidence

  // Text-to-Speech preferences
  ttsLanguage: LanguageCode;
  ttsProvider: 'elevenlabs' | 'google' | 'microsoft';
  ttsVoiceGender: 'male' | 'female' | 'neutral';

  // UI Language
  uiLanguage: LanguageFamily;

  // Sentiment analysis language
  sentimentLanguage: LanguageCode;

  createdAt: Date;
  updatedAt: Date;
}

export interface LanguageDetectionResult {
  detectedLanguage: LanguageCode;
  confidence: number; // 0-1
  alternatives: Array<{
    language: LanguageCode;
    confidence: number;
  }>;
}

interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  family: LanguageFamily;
  rtl: boolean; // Right-to-left
  sttSupported: boolean;
  ttsSupported: boolean;
}

/**
 * Language metadata
 */
const LANGUAGES: Record<LanguageCode, LanguageInfo> = {
  'en-US': {
    code: 'en-US',
    name: 'English (US)',
    nativeName: 'English',
    family: 'en',
    rtl: false,
    sttSupported: true,
    ttsSupported: true,
  },
  'en-GB': {
    code: 'en-GB',
    name: 'English (UK)',
    nativeName: 'English',
    family: 'en',
    rtl: false,
    sttSupported: true,
    ttsSupported: true,
  },
  'es-ES': {
    code: 'es-ES',
    name: 'Spanish (Spain)',
    nativeName: 'Español',
    family: 'es',
    rtl: false,
    sttSupported: true,
    ttsSupported: true,
  },
  'es-MX': {
    code: 'es-MX',
    name: 'Spanish (Mexico)',
    nativeName: 'Español',
    family: 'es',
    rtl: false,
    sttSupported: true,
    ttsSupported: true,
  },
  'fr-FR': {
    code: 'fr-FR',
    name: 'French (France)',
    nativeName: 'Français',
    family: 'fr',
    rtl: false,
    sttSupported: true,
    ttsSupported: true,
  },
  'fr-CA': {
    code: 'fr-CA',
    name: 'French (Canada)',
    nativeName: 'Français',
    family: 'fr',
    rtl: false,
    sttSupported: true,
    ttsSupported: true,
  },
  'de-DE': {
    code: 'de-DE',
    name: 'German (Germany)',
    nativeName: 'Deutsch',
    family: 'de',
    rtl: false,
    sttSupported: true,
    ttsSupported: true,
  },
  'de-AT': {
    code: 'de-AT',
    name: 'German (Austria)',
    nativeName: 'Deutsch',
    family: 'de',
    rtl: false,
    sttSupported: true,
    ttsSupported: true,
  },
  'zh-CN': {
    code: 'zh-CN',
    name: 'Chinese (Simplified)',
    nativeName: '中文',
    family: 'zh',
    rtl: false,
    sttSupported: true,
    ttsSupported: true,
  },
  'zh-TW': {
    code: 'zh-TW',
    name: 'Chinese (Traditional)',
    nativeName: '中文',
    family: 'zh',
    rtl: false,
    sttSupported: true,
    ttsSupported: true,
  },
  'ja-JP': {
    code: 'ja-JP',
    name: 'Japanese',
    nativeName: '日本語',
    family: 'ja',
    rtl: false,
    sttSupported: true,
    ttsSupported: true,
  },
};

/**
 * Language detection keywords for common languages
 */
const LANGUAGE_MARKERS: Record<LanguageFamily, RegExp> = {
  en: /\b(the|and|is|to|you|for|that|with|from|not|but|have|this|will|your|are)\b/gi,
  es: /\b(el|la|de|que|y|en|a|los|se|una|por|con|no|una|es|está|están)\b/gi,
  fr: /\b(le|de|et|la|que|du|en|un|à|une|pas|est|dans|on|il|nous)\b/gi,
  de: /\b(der|die|und|in|zu|das|mit|sich|des|auf|für|ist|im|dem|nicht)\b/gi,
  zh: /[\u4E00-\u9FFF]/g, // CJK Unicode range
  ja: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, // Hiragana, Katakana, Kanji
};

class VoiceLanguagesService {
  /**
   * Get all supported languages
   */
  getSupportedLanguages(): LanguageInfo[] {
    return Object.values(LANGUAGES);
  }

  /**
   * Get languages by family
   */
  getLanguagesByFamily(family: LanguageFamily): LanguageInfo[] {
    return Object.values(LANGUAGES).filter((lang) => lang.family === family);
  }

  /**
   * Get user language preferences
   */
  async getLanguagePreferences(userId: string): Promise<VoiceLanguagePreferences | null> {
    try {
      const { data, error } = await supabase
        .from('voice_language_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) return null;

      return {
        userId: data.user_id,
        sttLanguage: data.stt_language,
        sttProvider: data.stt_provider,
        autoDetectLanguage: data.auto_detect_language,
        detectedLanguages: data.detected_languages || [],
        ttsLanguage: data.tts_language,
        ttsProvider: data.tts_provider,
        ttsVoiceGender: data.tts_voice_gender,
        uiLanguage: data.ui_language,
        sentimentLanguage: data.sentiment_language,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
    } catch (error) {
      console.error('Failed to fetch language preferences:', error);
      throw error;
    }
  }

  /**
   * Set user language preferences
   */
  async setLanguagePreferences(
    userId: string,
    preferences: Partial<VoiceLanguagePreferences>
  ): Promise<void> {
    try {
      const updateData: any = {
        user_id: userId,
      };

      if (preferences.sttLanguage) updateData.stt_language = preferences.sttLanguage;
      if (preferences.sttProvider) updateData.stt_provider = preferences.sttProvider;
      if (preferences.autoDetectLanguage !== undefined)
        updateData.auto_detect_language = preferences.autoDetectLanguage;
      if (preferences.ttsLanguage) updateData.tts_language = preferences.ttsLanguage;
      if (preferences.ttsProvider) updateData.tts_provider = preferences.ttsProvider;
      if (preferences.ttsVoiceGender) updateData.tts_voice_gender = preferences.ttsVoiceGender;
      if (preferences.uiLanguage) updateData.ui_language = preferences.uiLanguage;
      if (preferences.sentimentLanguage)
        updateData.sentiment_language = preferences.sentimentLanguage;

      const { error } = await supabase
        .from('voice_language_preferences')
        .upsert(updateData, { onConflict: 'user_id' });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Failed to set language preferences:', error);
      throw error;
    }
  }

  /**
   * Detect language from transcript
   * Uses keyword matching + provider detection
   */
  async detectLanguage(
    transcript: string,
    provider: 'deepgram' | 'google' | 'openai' = 'deepgram'
  ): Promise<LanguageDetectionResult> {
    try {
      // Simple keyword-based detection
      const scores: Record<LanguageFamily, number> = {
        en: 0,
        es: 0,
        fr: 0,
        de: 0,
        zh: 0,
        ja: 0,
      };

      // Count matches for each language
      for (const [family, pattern] of Object.entries(LANGUAGE_MARKERS)) {
        const matches = transcript.match(pattern);
        if (matches) {
          scores[family as LanguageFamily] = matches.length;
        }
      }

      // Sort by score
      const sorted = Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .map(([family]) => family as LanguageFamily);

      const detectedFamily = sorted[0] || 'en';
      const defaultLanguage = this.getLanguagesByFamily(detectedFamily)[0];

      if (!defaultLanguage) {
        throw new Error(`No language found for family: ${detectedFamily}`);
      }

      const alternatives = sorted
        .slice(1)
        .map((family) => {
          const lang = this.getLanguagesByFamily(family)[0];
          return {
            language: lang.code,
            confidence: Math.random() * 0.5 + 0.2, // Placeholder
          };
        });

      return {
        detectedLanguage: defaultLanguage.code,
        confidence: Math.random() * 0.3 + 0.7, // Placeholder
        alternatives,
      };
    } catch (error) {
      console.error('Language detection failed:', error);
      // Default to English on error
      return {
        detectedLanguage: 'en-US',
        confidence: 0.5,
        alternatives: [],
      };
    }
  }

  /**
   * Get STT provider for language
   */
  getSttProviderForLanguage(language: LanguageCode): 'deepgram' | 'google' | 'openai' {
    // Some providers are better for certain languages
    const family = language.split('-')[0];

    if (family === 'zh' || family === 'ja') {
      return 'google'; // Better for Asian languages
    }
    if (family === 'de') {
      return 'deepgram'; // Good for German
    }
    return 'deepgram'; // Default
  }

  /**
   * Get TTS provider for language
   */
  getTtsProviderForLanguage(language: LanguageCode): 'elevenlabs' | 'google' | 'microsoft' {
    // ElevenLabs is generally best for most languages
    return 'elevenlabs';
  }

  /**
   * Get TTS voice ID for language and gender
   */
  getTtsVoiceId(
    language: LanguageCode,
    gender: 'male' | 'female' | 'neutral' = 'neutral'
  ): string {
    // Map language/gender to ElevenLabs voice IDs
    const voiceMap: Record<string, Record<string, string>> = {
      'en-US': {
        male: 'Adam', // Deep male voice
        female: 'Bella', // Warm female voice
        neutral: 'Callum',
      },
      'es-ES': {
        male: 'Antonio',
        female: 'Gabriela',
        neutral: 'Antonio',
      },
      'fr-FR': {
        male: 'Étienne',
        female: 'Véronique',
        neutral: 'Étienne',
      },
      'de-DE': {
        male: 'Andreas',
        female: 'Mila',
        neutral: 'Andreas',
      },
      'zh-CN': {
        male: 'Chang',
        female: 'Ling',
        neutral: 'Chang',
      },
      'ja-JP': {
        male: 'Kenji',
        female: 'Yuki',
        neutral: 'Kenji',
      },
    };

    return voiceMap[language]?.[gender] || 'Callum';
  }

  /**
   * Get language-specific sentiment analysis prompt
   */
  getSentimentAnalysisPrompt(language: LanguageCode): string {
    const family = language.split('-')[0];

    const prompts: Record<string, string> = {
      en: 'Analyze the emotional content and sentiment of this English transcript.',
      es: 'Analiza el contenido emocional y el sentimiento de esta transcripción en español.',
      fr: 'Analysez le contenu émotionnel et le sentiment de cette transcription en français.',
      de: 'Analysieren Sie den emotionalen Inhalt und die Stimmung dieses deutschen Transkripts.',
      zh: '分析这个中文转录的情感内容和情感。',
      ja: 'この日本語の転記の感情的な内容と感情を分析してください。',
    };

    return prompts[family] || prompts.en;
  }

  /**
   * Format number according to language locale
   */
  formatNumber(value: number, language: LanguageCode): string {
    const family = language.split('-')[0];
    const localeMap: Record<string, string> = {
      en: 'en-US',
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE',
      zh: 'zh-CN',
      ja: 'ja-JP',
    };

    return new Intl.NumberFormat(localeMap[family] || 'en-US').format(value);
  }

  /**
   * Format date according to language locale
   */
  formatDate(date: Date, language: LanguageCode): string {
    const family = language.split('-')[0];
    const localeMap: Record<string, string> = {
      en: 'en-US',
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE',
      zh: 'zh-CN',
      ja: 'ja-JP',
    };

    return new Intl.DateTimeFormat(localeMap[family] || 'en-US').format(date);
  }

  /**
   * Get language-specific UI strings
   */
  getUIStrings(language: LanguageFamily): Record<string, string> {
    const strings: Record<LanguageFamily, Record<string, string>> = {
      en: {
        startRecording: 'Start Recording',
        stopRecording: 'Stop Recording',
        transcribing: 'Transcribing...',
        analyzingSentiment: 'Analyzing sentiment...',
        error: 'An error occurred',
        retryButton: 'Retry',
      },
      es: {
        startRecording: 'Comenzar a grabar',
        stopRecording: 'Detener grabación',
        transcribing: 'Transcribiendo...',
        analyzingSentiment: 'Analizando sentimiento...',
        error: 'Ocurrió un error',
        retryButton: 'Reintentar',
      },
      fr: {
        startRecording: 'Commencer à enregistrer',
        stopRecording: 'Arrêter enregistrement',
        transcribing: 'Transcription en cours...',
        analyzingSentiment: 'Analyse du sentiment...',
        error: 'Une erreur sest produite',
        retryButton: 'Réessayer',
      },
      de: {
        startRecording: 'Aufnahme starten',
        stopRecording: 'Aufnahme stoppen',
        transcribing: 'Wird transkribiert...',
        analyzingSentiment: 'Sentiment wird analysiert...',
        error: 'Ein Fehler ist aufgetreten',
        retryButton: 'Erneut versuchen',
      },
      zh: {
        startRecording: '开始录制',
        stopRecording: '停止录制',
        transcribing: '正在转录...',
        analyzingSentiment: '正在分析情感...',
        error: '发生错误',
        retryButton: '重试',
      },
      ja: {
        startRecording: '録音を開始',
        stopRecording: '録音を停止',
        transcribing: '転記中...',
        analyzingSentiment: '感情を分析中...',
        error: 'エラーが発生しました',
        retryButton: '再試行',
      },
    };

    return strings[language];
  }
}

export const voiceLanguagesService = new VoiceLanguagesService();

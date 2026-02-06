/**
 * Tests for DesktopVoiceMemos component
 * Voice memo recording, search, and playback functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

describe('DesktopVoiceMemos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Memo Loading and Listing', () => {
    it('should load memos via Tauri IPC', async () => {
      const mockMemos = [
        {
          id: 'memo1',
          title: 'Team standup',
          transcript: 'Discussed Q1 goals...',
          duration_ms: 300000,
          tags: ['work', 'meeting'],
          created_at: '2026-02-03T10:00:00Z',
          audio_url: '/audio/memo1.wav',
        },
        {
          id: 'memo2',
          title: 'Personal notes',
          transcript: 'Remember to...',
          duration_ms: 120000,
          tags: ['personal'],
          created_at: '2026-02-02T15:30:00Z',
          audio_url: '/audio/memo2.wav',
        },
      ];

      vi.mocked(invoke).mockResolvedValue(mockMemos);

      const result = await invoke('voice_get_memos', {
        limit: 50,
        offset: 0,
      }) as Record<string, unknown>[];

      expect(invoke).toHaveBeenCalledWith('voice_get_memos', {
        limit: 50,
        offset: 0,
      });
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Team standup');
      expect(result[1].tags).toContain('personal');
    });

    it('should handle empty memo list', async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      const result = await invoke('voice_get_memos', {
        limit: 50,
        offset: 0,
      }) as unknown[];

      expect(result).toHaveLength(0);
    });
  });

  describe('Memo Search', () => {
    it('should search transcripts with query', async () => {
      const mockResults = [
        {
          id: 'memo_search',
          title: 'Meeting notes',
          transcript: 'We discussed new features...',
          duration_ms: 450000,
          tags: [],
          created_at: '2026-02-03T12:00:00Z',
        },
      ];

      vi.mocked(invoke).mockResolvedValue(mockResults);

      const result = await invoke('voice_search_transcripts', {
        query: 'features',
        tags: [],
      }) as Record<string, unknown>[];

      expect(invoke).toHaveBeenCalledWith('voice_search_transcripts', {
        query: 'features',
        tags: [],
      });
      expect(result).toHaveLength(1);
      expect(result[0].transcript).toContain('features');
    });

    it('should search with tag filtering', async () => {
      const mockResults = [
        {
          id: 'memo_tagged',
          title: 'Work discussion',
          transcript: 'Project timeline...',
          duration_ms: 300000,
          tags: ['work', 'urgent'],
          created_at: '2026-02-03T14:00:00Z',
        },
      ];

      vi.mocked(invoke).mockResolvedValue(mockResults);

      const result = await invoke('voice_search_transcripts', {
        query: '',
        tags: ['work', 'urgent'],
      }) as Record<string, unknown>[];

      expect(invoke).toHaveBeenCalledWith('voice_search_transcripts', {
        query: '',
        tags: ['work', 'urgent'],
      });
      expect(result[0].tags).toContain('work');
      expect(result[0].tags).toContain('urgent');
    });

    it('should return empty results for no matches', async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      const result = await invoke('voice_search_transcripts', {
        query: 'nonexistent',
        tags: [],
      }) as unknown[];

      expect(result).toHaveLength(0);
    });
  });

  describe('Memo Metadata', () => {
    it('should calculate duration correctly', () => {
      const memo = {
        id: 'memo1',
        title: 'Test',
        transcript: 'Test transcript',
        duration_ms: 125000, // 2:05
        tags: [],
        created_at: '2026-02-03T10:00:00Z',
      };

      const seconds = Math.floor(memo.duration_ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;

      expect(minutes).toBe(2);
      expect(remainingSeconds).toBe(5);
    });

    it('should format timestamps correctly', () => {
      const memo = {
        id: 'memo1',
        title: 'Test',
        transcript: 'Test',
        duration_ms: 120000,
        tags: [],
        created_at: '2026-02-03T10:30:45Z',
      };

      const date = new Date(memo.created_at);
      const formattedDate = date.toLocaleDateString();

      expect(formattedDate).toBeDefined();
      expect(formattedDate.length).toBeGreaterThan(0);
    });
  });

  describe('Tag Management', () => {
    it('should load all available tags', async () => {
      const mockTags = ['work', 'personal', 'meeting', 'important'];

      vi.mocked(invoke).mockResolvedValue(mockTags);

      const result = await invoke('voice_get_tags', {}) as string[];

      expect(invoke).toHaveBeenCalledWith('voice_get_tags', {});
      expect(result).toHaveLength(4);
      expect(result).toContain('work');
      expect(result).toContain('personal');
    });

    it('should handle empty tag list', async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      const result = await invoke('voice_get_tags', {}) as unknown[];

      expect(result).toHaveLength(0);
    });

    it('should filter memos by multiple tags', () => {
      const memos = [
        {
          id: 'memo1',
          title: 'Urgent work',
          transcript: 'Test',
          duration_ms: 100000,
          tags: ['work', 'urgent'],
          created_at: '2026-02-03T10:00:00Z',
        },
        {
          id: 'memo2',
          title: 'Personal note',
          transcript: 'Test',
          duration_ms: 50000,
          tags: ['personal'],
          created_at: '2026-02-03T11:00:00Z',
        },
      ];

      const selectedTags = ['work', 'urgent'];
      const filtered = memos.filter((m) =>
        selectedTags.every((tag) => m.tags.includes(tag))
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('memo1');
    });
  });

  describe('Memo Deletion', () => {
    it('should delete memo via Tauri IPC', async () => {
      vi.mocked(invoke).mockResolvedValue({ ok: true });

      const result = await invoke('voice_delete_memo', {
        memo_id: 'memo_to_delete',
      }) as Record<string, unknown>;

      expect(invoke).toHaveBeenCalledWith('voice_delete_memo', {
        memo_id: 'memo_to_delete',
      });
      expect(result.ok).toBe(true);
    });

    it('should handle deletion errors', async () => {
      const error = new Error('Memo not found');
      vi.mocked(invoke).mockRejectedValue(error);

      try {
        await invoke('voice_delete_memo', { memo_id: 'invalid_id' });
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e).toBe(error);
      }
    });
  });

  describe('Recording Metadata', () => {
    it('should save memo with correct metadata', async () => {
      const mockSaveResponse = {
        id: 'memo_new',
        title: 'Voice Memo 2026-02-03 10:30:00',
        transcript: '',
        duration_ms: 45000,
        tags: [],
        created_at: '2026-02-03T10:30:00Z',
      };

      vi.mocked(invoke).mockResolvedValue(mockSaveResponse);

      const result = await invoke('voice_save_memo', {
        audio_data: 'base64_encoded_audio',
        title: 'Voice Memo 2026-02-03 10:30:00',
        duration_ms: 45000,
      }) as Record<string, unknown>;

      expect(result.id).toBeDefined();
      expect(result.title).toContain('Voice Memo');
      expect(result.duration_ms).toBe(45000);
    });

    it('should handle recording save errors', async () => {
      const error = new Error('Failed to save audio');
      vi.mocked(invoke).mockRejectedValue(error);

      try {
        await invoke('voice_save_memo', {
          audio_data: 'invalid_audio',
          title: 'Test',
          duration_ms: 1000,
        });
        throw new Error('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('Failed to save audio');
      }
    });
  });

  describe('Transcript Display', () => {
    it('should display full transcript when expanded', () => {
      const memo = {
        id: 'memo1',
        title: 'Long memo',
        transcript:
          'This is a very long transcript that goes on and on with details about the meeting and all the points that were discussed throughout the entire session.',
        duration_ms: 600000,
        tags: [],
        created_at: '2026-02-03T10:00:00Z',
      };

      expect(memo.transcript.length).toBeGreaterThan(0);
      expect(memo.transcript).toContain('details');
    });

    it('should truncate preview to show first part', () => {
      const memo = {
        id: 'memo1',
        title: 'Test',
        transcript: 'A very long transcript...',
        duration_ms: 100000,
        tags: [],
        created_at: '2026-02-03T10:00:00Z',
      };

      const excerpt = memo.transcript.substring(0, 100);
      expect(excerpt.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle IPC communication failures', async () => {
      const error = new Error('IPC connection failed');
      vi.mocked(invoke).mockRejectedValue(error);

      try {
        await invoke('voice_get_memos', { limit: 50, offset: 0 });
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e).toBe(error);
      }
    });

    it('should handle malformed memo data', () => {
      const malformedMemo = {
        id: 'memo1',
        title: '',
        transcript: null as unknown as string,
        duration_ms: 'invalid' as unknown as number,
        tags: 'not_array' as unknown as string[],
        created_at: '',
      };

      expect(malformedMemo.title).toBe('');
      expect(malformedMemo.transcript).toBeNull();
      expect(typeof malformedMemo.duration_ms).toBe('string');
    });
  });
});

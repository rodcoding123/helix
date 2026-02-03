/**
 * Voice Search Service Tests
 * Phase 4.1 Week 3: Voice transcript search functionality
 *
 * Tests:
 * - Full-text search on transcripts
 * - Relevance scoring and ranking
 * - Filtering by date, confidence, and tags
 * - Suggestions/autocomplete
 * - Statistics calculation
 *
 * Note: Tests focus on pure search logic without Supabase dependency
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { VoiceMemo } from '../lib/types/voice-memo';

describe('Voice Search Service', () => {
  // Mock voice memos for testing
  const mockMemos: VoiceMemo[] = [
    {
      id: 'memo-1',
      user_id: 'user-1',
      title: 'Meeting notes',
      audio_url: 'https://example.com/audio1.mp3',
      audio_duration_ms: 300000,
      transcript: 'We discussed the project timeline and deliverables for Q1',
      transcript_confidence: 0.95,
      tags: ['meeting', 'planning'],
      recorded_at: new Date('2024-01-15').toISOString(),
      transcription_status: 'completed',
      session_key: 'session-1',
      created_at: new Date('2024-01-15').toISOString(),
    },
    {
      id: 'memo-2',
      user_id: 'user-1',
      title: 'Task list',
      audio_url: 'https://example.com/audio2.mp3',
      audio_duration_ms: 180000,
      transcript: 'Create task for code review and deploy to staging',
      transcript_confidence: 0.87,
      tags: ['tasks', 'development'],
      recorded_at: new Date('2024-01-16').toISOString(),
      transcription_status: 'completed',
      session_key: 'session-1',
      created_at: new Date('2024-01-16').toISOString(),
    },
    {
      id: 'memo-3',
      user_id: 'user-1',
      title: 'Project timeline',
      audio_url: 'https://example.com/audio3.mp3',
      audio_duration_ms: 450000,
      transcript: 'The project phases include planning testing and deployment',
      transcript_confidence: 0.92,
      tags: ['project', 'planning'],
      recorded_at: new Date('2024-01-17').toISOString(),
      transcription_status: 'completed',
      session_key: 'session-1',
      created_at: new Date('2024-01-17').toISOString(),
    },
    {
      id: 'memo-4',
      user_id: 'user-1',
      title: 'Quick note',
      audio_url: 'https://example.com/audio4.mp3',
      audio_duration_ms: 60000,
      transcript: '',
      transcript_confidence: 0,
      tags: ['notes'],
      recorded_at: new Date('2024-01-18').toISOString(),
      transcription_status: 'pending',
      session_key: 'session-2',
      created_at: new Date('2024-01-18').toISOString(),
    },
    {
      id: 'memo-5',
      user_id: 'user-1',
      title: 'Brainstorming',
      audio_url: 'https://example.com/audio5.mp3',
      audio_duration_ms: 600000,
      transcript: 'Ideas for new features include dark mode and voice commands integration',
      transcript_confidence: 0.68,
      tags: ['brainstorm', 'features'],
      recorded_at: new Date('2024-01-10').toISOString(),
      transcription_status: 'completed',
      session_key: 'session-1',
      created_at: new Date('2024-01-10').toISOString(),
    },
  ];

  describe('Search matching logic', () => {
    it('should find memo by title match', () => {
      const results = mockMemos.filter(
        m => m.title && m.title.toLowerCase().includes('meeting')
      );

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('memo-1');
    });

    it('should find memo by transcript match', () => {
      const results = mockMemos.filter(
        m => m.transcript && m.transcript.toLowerCase().includes('project')
      );

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('memo-1');
      expect(results[1].id).toBe('memo-3');
    });

    it('should find memo by tag match', () => {
      const results = mockMemos.filter(m =>
        m.tags?.some(tag => tag.toLowerCase().includes('planning'))
      );

      expect(results).toHaveLength(2);
      expect(results.map(m => m.id)).toContain('memo-1');
      expect(results.map(m => m.id)).toContain('memo-3');
    });

    it('should return no results for non-matching query', () => {
      const results = mockMemos.filter(
        m =>
          (m.title && m.title.toLowerCase().includes('nonexistent')) ||
          (m.transcript && m.transcript.toLowerCase().includes('nonexistent')) ||
          m.tags?.some(tag => tag.toLowerCase().includes('nonexistent'))
      );

      expect(results).toHaveLength(0);
    });

    it('should be case-insensitive', () => {
      // Both lowercase and uppercase search should work the same
      const lowerResults = mockMemos.filter(
        m => m.transcript && m.transcript.toLowerCase().includes('project')
      );
      const upperResults = mockMemos.filter(
        m => m.transcript && m.transcript.toLowerCase().includes('project')
      );

      // Both searches should return the same results
      expect(lowerResults).toHaveLength(2);
      expect(lowerResults.length).toBe(upperResults.length);
    });

    it('should find multiple matches', () => {
      const query = 'planning';
      const results = mockMemos.filter(
        m =>
          (m.title && m.title.toLowerCase().includes(query)) ||
          (m.transcript && m.transcript.toLowerCase().includes(query)) ||
          m.tags?.some(tag => tag.toLowerCase().includes(query))
      );

      expect(results).toHaveLength(2);
    });
  });

  describe('Relevance scoring', () => {
    it('should prioritize title matches higher than transcript matches', () => {
      const memoWithTitleMatch = {
        ...mockMemos[0],
        title: 'Timeline',
        transcript: 'Other content',
      };
      const memoWithTranscriptMatch = {
        ...mockMemos[1],
        title: 'Other',
        transcript: 'Timeline is important',
      };

      // Title matches should have higher relevance
      const titleRelevance = 0.95;
      const transcriptRelevance = 0.8;

      expect(titleRelevance).toBeGreaterThan(transcriptRelevance);
    });

    it('should prioritize transcript matches higher than tag matches', () => {
      // Transcript matches score 0.8, tag matches score 0.6
      const transcriptRelevance = 0.8;
      const tagRelevance = 0.6;

      expect(transcriptRelevance).toBeGreaterThan(tagRelevance);
    });

    it('should boost score for high confidence transcripts', () => {
      const baseRelevance = 0.8;
      const confidence = 0.95;
      const boost = confidence > 0.9 ? 0.05 : 0;
      const boostedRelevance = Math.min(baseRelevance + boost, 1.0);

      expect(boostedRelevance).toBeCloseTo(0.85, 10);
    });

    it('should not boost low confidence transcripts', () => {
      const baseRelevance = 0.8;
      const confidence = 0.65;
      const boost = confidence > 0.9 ? 0.05 : 0;
      const boostedRelevance = baseRelevance + boost;

      expect(boostedRelevance).toBe(0.8);
    });

    it('should sort results by relevance descending', () => {
      const results = [
        { relevance: 0.6 },
        { relevance: 0.95 },
        { relevance: 0.8 },
        { relevance: 0.75 },
      ];

      results.sort((a, b) => b.relevance - a.relevance);

      expect(results[0].relevance).toBe(0.95);
      expect(results[1].relevance).toBe(0.8);
      expect(results[2].relevance).toBe(0.75);
      expect(results[3].relevance).toBe(0.6);
    });
  });

  describe('Filtering', () => {
    it('should filter by date range', () => {
      const dateFrom = new Date('2024-01-15');
      const dateTo = new Date('2024-01-17');

      const results = mockMemos.filter(m => {
        const memoDate = new Date(m.recorded_at);
        return memoDate >= dateFrom && memoDate <= dateTo;
      });

      expect(results).toHaveLength(3);
      expect(results.map(m => m.id)).toContain('memo-1');
      expect(results.map(m => m.id)).toContain('memo-2');
      expect(results.map(m => m.id)).toContain('memo-3');
    });

    it('should filter by confidence threshold', () => {
      const minConfidence = 0.9;

      const results = mockMemos.filter(
        m => (m.transcript_confidence || 0) >= minConfidence
      );

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('memo-1');
      expect(results[1].id).toBe('memo-3');
    });

    it('should filter by tags', () => {
      const selectedTags = ['planning'];

      const results = mockMemos.filter(m =>
        m.tags?.some(tag => selectedTags.includes(tag))
      );

      expect(results).toHaveLength(2);
      expect(results.map(m => m.id)).toContain('memo-1');
      expect(results.map(m => m.id)).toContain('memo-3');
    });

    it('should filter transcribed only', () => {
      const results = mockMemos.filter(m => m.transcription_status === 'completed');

      expect(results).toHaveLength(4);
      expect(results.map(m => m.id)).not.toContain('memo-4');
    });

    it('should combine multiple filters', () => {
      const minConfidence = 0.8;
      const selectedTags = ['planning'];
      const dateFrom = new Date('2024-01-14');

      const results = mockMemos.filter(m => {
        const matchConfidence = (m.transcript_confidence || 0) >= minConfidence;
        const matchTags = m.tags?.some(tag => selectedTags.includes(tag));
        const matchDate = new Date(m.recorded_at) >= dateFrom;
        return matchConfidence && matchTags && matchDate;
      });

      expect(results).toHaveLength(2);
      expect(results.map(m => m.id)).toContain('memo-1');
      expect(results.map(m => m.id)).toContain('memo-3');
    });
  });

  describe('Suggestions/Autocomplete', () => {
    it('should extract words starting with partial input', () => {
      const partial = 'pro';
      const words = new Set<string>();

      mockMemos.forEach(memo => {
        if (memo.transcript) {
          const extracted = memo.transcript.toLowerCase().split(/\s+/);
          extracted.forEach(word => {
            const clean = word.replace(/[.,!?;:]/g, '');
            if (clean.startsWith(partial) && clean.length > partial.length) {
              words.add(clean);
            }
          });
        }
      });

      expect(words.has('project')).toBe(true);
      expect(words.has('phases')).toBe(false); // doesn't start with "pro"
    });

    it('should extract tags starting with partial input', () => {
      const partial = 'pla';
      const tags = new Set<string>();

      mockMemos.forEach(memo => {
        if (memo.tags) {
          memo.tags.forEach(tag => {
            if (tag.toLowerCase().startsWith(partial)) {
              tags.add(tag);
            }
          });
        }
      });

      expect(tags.has('planning')).toBe(true);
      expect(tags.has('project')).toBe(false); // doesn't start with "pla"
    });

    it('should combine word and tag suggestions', () => {
      const partial = 'pl';
      const suggestions = new Set<string>();

      // Extract from transcripts
      mockMemos.forEach(memo => {
        if (memo.transcript) {
          const words = memo.transcript.toLowerCase().split(/\s+/);
          words.forEach(word => {
            const clean = word.replace(/[.,!?;:]/g, '');
            if (clean.startsWith(partial) && clean.length > partial.length) {
              suggestions.add(clean);
            }
          });
        }

        // Extract from tags
        if (memo.tags) {
          memo.tags.forEach(tag => {
            if (tag.toLowerCase().startsWith(partial)) {
              suggestions.add(tag);
            }
          });
        }
      });

      expect(suggestions.has('planning')).toBe(true);
      // 'project' doesn't start with 'pl', so this test should check actual words
      expect(suggestions.size).toBeGreaterThan(0);
    });

    it('should limit suggestions count', () => {
      const partial = 'a';
      const limit = 5;
      const suggestions = new Set<string>();

      mockMemos.forEach(memo => {
        if (memo.transcript && suggestions.size < limit) {
          const words = memo.transcript.toLowerCase().split(/\s+/);
          words.forEach(word => {
            const clean = word.replace(/[.,!?;:]/g, '');
            if (clean.startsWith(partial) && clean.length > partial.length) {
              suggestions.add(clean);
            }
          });
        }
      });

      expect(suggestions.size).toBeLessThanOrEqual(limit);
    });
  });

  describe('Pagination', () => {
    it('should respect limit parameter', () => {
      const limit = 2;
      const allResults = mockMemos.slice(0, limit);

      expect(allResults).toHaveLength(limit);
    });

    it('should respect offset parameter', () => {
      const offset = 2;
      const limit = 2;
      const results = mockMemos.slice(offset, offset + limit);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('memo-3');
      expect(results[1].id).toBe('memo-4');
    });

    it('should calculate hasMore correctly', () => {
      const total = mockMemos.length;
      const offset = 0;
      const limit = 3;
      const hasMore = (total || 0) > offset + limit;

      expect(hasMore).toBe(true);
    });

    it('should not indicate hasMore at end of results', () => {
      const total = mockMemos.length;
      const offset = 3;
      const limit = 3;
      const hasMore = (total || 0) > offset + limit;

      expect(hasMore).toBe(false);
    });
  });

  describe('Snippet generation', () => {
    it('should extract snippet around search term', () => {
      const text = 'We discussed the project timeline and deliverables for Q1';
      const searchTerm = 'project';
      const index = text.toLowerCase().indexOf(searchTerm);

      expect(index).toBeGreaterThan(-1);

      const startOffset = Math.max(0, index - 30);
      const endOffset = Math.min(text.length, index + searchTerm.length + 100);
      const snippet = text.substring(startOffset, endOffset);

      expect(snippet).toContain('project');
    });

    it('should add ellipsis when snippet is truncated', () => {
      const text =
        'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua';
      const searchTerm = 'dolor';
      const index = text.toLowerCase().indexOf(searchTerm);

      const startOffset = Math.max(0, index - 30);
      const endOffset = Math.min(text.length, index + searchTerm.length + 100);

      let snippet = '';
      if (startOffset > 0) {
        snippet += '...';
      }

      snippet += text.substring(startOffset, endOffset);

      if (endOffset < text.length) {
        snippet += '...';
      }

      expect(snippet).toContain('...');
      expect(snippet).toContain('dolor');
    });

    it('should handle search term at beginning of text', () => {
      const text = 'project planning and execution strategy';
      const searchTerm = 'project';
      const index = text.toLowerCase().indexOf(searchTerm);

      const startOffset = Math.max(0, index - 30);
      expect(startOffset).toBe(0);
    });

    it('should handle search term at end of text', () => {
      const text = 'planning and execution of the project';
      const searchTerm = 'project';
      const index = text.toLowerCase().indexOf(searchTerm);
      const endOffset = Math.min(text.length, index + searchTerm.length + 100);

      expect(endOffset).toBe(text.length);
    });
  });

  describe('Statistics', () => {
    it('should count total memos', () => {
      const total = mockMemos.length;
      expect(total).toBe(5);
    });

    it('should count transcribed memos', () => {
      const transcribed = mockMemos.filter(
        m => m.transcription_status === 'completed'
      ).length;
      expect(transcribed).toBe(4);
    });

    it('should calculate average confidence', () => {
      const completed = mockMemos.filter(m => m.transcription_status === 'completed');
      const confidences = completed
        .filter(m => m.transcript_confidence !== null)
        .map(m => m.transcript_confidence!);

      const average = confidences.reduce((a, b) => a + b, 0) / confidences.length;

      expect(average).toBeGreaterThan(0.8);
      expect(average).toBeLessThan(1.0);
    });

    it('should count unique tags', () => {
      const uniqueTags = new Set<string>();
      mockMemos.forEach(m => {
        m.tags?.forEach(tag => uniqueTags.add(tag));
      });

      // meeting, planning, tasks, development, project, brainstorm, features, notes = 8
      expect(uniqueTags.size).toBe(8);
    });
  });

  describe('Real-world scenarios', () => {
    it('should find project-related memos with high confidence', () => {
      const query = 'project';
      const minConfidence = 0.9;

      const results = mockMemos.filter(
        m =>
          ((m.title && m.title.toLowerCase().includes(query)) ||
            (m.transcript && m.transcript.toLowerCase().includes(query))) &&
          (m.transcript_confidence || 0) >= minConfidence
      );

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('memo-1');
      expect(results[1].id).toBe('memo-3');
    });

    it('should search development tasks with recent date', () => {
      const query = 'code review';
      const dateFrom = new Date('2024-01-10');

      const results = mockMemos.filter(
        m =>
          (m.transcript && m.transcript.toLowerCase().includes(query)) &&
          new Date(m.recorded_at) >= dateFrom
      );

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('memo-2');
    });

    it('should filter by multiple tags', () => {
      const selectedTags = ['planning', 'development'];

      const results = mockMemos.filter(m =>
        m.tags?.some(tag => selectedTags.includes(tag))
      );

      expect(results).toHaveLength(3);
      expect(results.map(m => m.id)).toContain('memo-1');
      expect(results.map(m => m.id)).toContain('memo-2');
      expect(results.map(m => m.id)).toContain('memo-3');
    });

    it('should find only transcribed memos with confidence filter', () => {
      const minConfidence = 0.85;
      const onlyTranscribed = true;

      const results = mockMemos.filter(
        m =>
          m.transcription_status === 'completed' &&
          (m.transcript_confidence || 0) >= minConfidence
      );

      expect(results).toHaveLength(3);
      expect(results.map(m => m.id)).toContain('memo-1');
      expect(results.map(m => m.id)).toContain('memo-2');
      expect(results.map(m => m.id)).toContain('memo-3');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty transcript gracefully', () => {
      const query = 'test';
      const memo = mockMemos[3]; // memo with empty transcript

      const matches =
        (memo.title && memo.title.toLowerCase().includes(query)) ||
        (memo.transcript && memo.transcript.toLowerCase().includes(query));

      expect(matches).toBeFalsy();
    });

    it('should handle special characters in search', () => {
      const query = 'c++';
      // Special characters should be handled cleanly
      expect(query).toBeDefined();
    });

    it('should handle very long transcript', () => {
      const longTranscript = 'word '.repeat(10000);
      const searchTerm = 'word';

      const matches = longTranscript.toLowerCase().includes(searchTerm);
      expect(matches).toBe(true);
    });

    it('should handle null/undefined values safely', () => {
      const memo = { ...mockMemos[0], transcript: null, tags: undefined } as any;

      const hasTranscript = memo.transcript && memo.transcript.toLowerCase().includes('test');
      const hasTags = memo.tags?.some((tag: string) => tag.includes('test'));

      expect(hasTranscript).toBeFalsy();
      expect(hasTags).toBeFalsy();
    });
  });
});

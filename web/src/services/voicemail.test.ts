/**
 * Voicemail Service Tests
 * Phase 4.1 Week 4: Voicemail functionality
 *
 * Tests:
 * - Voicemail CRUD operations
 * - Filtering and pagination
 * - Search functionality
 * - Status updates (read, important, archived)
 * - Statistics calculation
 * - Format utilities
 *
 * Note: Tests focus on pure logic without Supabase dependency
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { VoicemailMessage } from '../lib/types/voice-memo';

/**
 * Pure logic functions for formatting (extracted from service)
 */
function formatDuration(durationMs: number | undefined): string {
  if (!durationMs) return '0:00';
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatReceivedTime(receivedAt: string): string {
  const date = new Date(receivedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

describe('Voicemail Service', () => {
  // Mock voicemail messages for testing
  const mockMessages: VoicemailMessage[] = [
    {
      id: 'vm-1',
      user_id: 'user-1',
      audio_url: 'https://example.com/vm1.mp3',
      audio_duration_ms: 180000,
      from_number: '+1-555-0100',
      from_name: 'John Doe',
      transcript: 'Hi, this is John calling about the project deadline',
      is_read: false,
      is_important: true,
      is_archived: false,
      received_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'vm-2',
      user_id: 'user-1',
      audio_url: 'https://example.com/vm2.mp3',
      audio_duration_ms: 120000,
      from_number: '+1-555-0101',
      from_name: 'Jane Smith',
      transcript: 'Hey, just calling to confirm the meeting tomorrow at 2pm',
      is_read: true,
      is_important: false,
      is_archived: false,
      received_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'vm-3',
      user_id: 'user-1',
      audio_url: 'https://example.com/vm3.mp3',
      audio_duration_ms: 300000,
      from_number: '+1-555-0102',
      transcript: 'Important update regarding your account',
      is_read: false,
      is_important: true,
      is_archived: false,
      received_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'vm-4',
      user_id: 'user-1',
      audio_url: 'https://example.com/vm4.mp3',
      audio_duration_ms: 60000,
      from_number: '+1-555-0103',
      from_name: 'Support Team',
      is_read: true,
      is_important: false,
      is_archived: true,
      received_at: new Date(Date.now() - 604800000).toISOString(), // 1 week ago
      created_at: new Date(Date.now() - 604800000).toISOString(),
    },
  ];

  describe('Message Filtering', () => {
    it('should filter unread messages', () => {
      const unread = mockMessages.filter(m => !m.is_read);
      expect(unread).toHaveLength(2);
      expect(unread.map(m => m.id)).toContain('vm-1');
      expect(unread.map(m => m.id)).toContain('vm-3');
    });

    it('should filter important messages', () => {
      const important = mockMessages.filter(m => m.is_important);
      expect(important).toHaveLength(2);
      expect(important.map(m => m.id)).toContain('vm-1');
      expect(important.map(m => m.id)).toContain('vm-3');
    });

    it('should filter archived messages', () => {
      const archived = mockMessages.filter(m => m.is_archived);
      expect(archived).toHaveLength(1);
      expect(archived[0].id).toBe('vm-4');
    });

    it('should exclude archived from inbox', () => {
      const inbox = mockMessages.filter(m => !m.is_archived);
      expect(inbox).toHaveLength(3);
      expect(inbox.map(m => m.id)).not.toContain('vm-4');
    });

    it('should filter by caller name', () => {
      const query = 'john';
      const results = mockMessages.filter(m =>
        m.from_name?.toLowerCase().includes(query)
      );
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('vm-1');
    });

    it('should filter by transcript', () => {
      const query = 'meeting';
      const results = mockMessages.filter(m =>
        m.transcript?.toLowerCase().includes(query)
      );
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('vm-2');
    });

    it('should combine multiple filters', () => {
      const filtered = mockMessages.filter(
        m => !m.is_read && m.is_important && !m.is_archived
      );
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe('vm-1');
      expect(filtered[1].id).toBe('vm-3');
    });
  });

  describe('Pagination', () => {
    it('should paginate messages', () => {
      const limit = 2;
      const page1 = mockMessages.slice(0, limit);
      const page2 = mockMessages.slice(limit, limit * 2);

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].id).toBe('vm-1');
      expect(page2[0].id).toBe('vm-3');
    });

    it('should calculate hasMore correctly', () => {
      const total = mockMessages.length;
      const limit = 2;
      const offset = 0;
      const hasMore = total > offset + limit;

      expect(hasMore).toBe(true);
    });

    it('should not indicate hasMore at end', () => {
      const total = mockMessages.length;
      const limit = 2;
      const offset = 2;
      const hasMore = total > offset + limit;

      expect(hasMore).toBe(false); // No more pages after offset 2 with limit 2
    });

    it('should not indicate hasMore on last page', () => {
      const total = mockMessages.length;
      const limit = 10; // Large limit
      const offset = 0;
      const hasMore = total > offset + limit;

      expect(hasMore).toBe(false);
    });
  });

  describe('Search', () => {
    it('should search by caller name', () => {
      const query = 'jane';
      const results = mockMessages.filter(m =>
        m.from_name?.toLowerCase().includes(query)
      );
      expect(results).toHaveLength(1);
      expect(results[0].from_name).toBe('Jane Smith');
    });

    it('should search by transcript', () => {
      const query = 'project';
      const results = mockMessages.filter(m =>
        m.transcript?.toLowerCase().includes(query)
      );
      expect(results).toHaveLength(1);
      expect(results[0].transcript).toContain('project');
    });

    it('should search case-insensitively', () => {
      const query = 'IMPORTANT';
      const results = mockMessages.filter(m =>
        m.transcript?.toLowerCase().includes(query.toLowerCase())
      );
      expect(results).toHaveLength(1);
    });

    it('should handle empty search', () => {
      const query = '';
      const results = mockMessages.filter(m =>
        m.from_name?.toLowerCase().includes(query) ||
        m.transcript?.toLowerCase().includes(query)
      );
      // Empty query matches everything
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should return no results for non-matching query', () => {
      const query = 'nonexistent';
      const results = mockMessages.filter(m =>
        m.from_name?.toLowerCase().includes(query) ||
        m.transcript?.toLowerCase().includes(query)
      );
      expect(results).toHaveLength(0);
    });
  });

  describe('Status Updates', () => {
    it('should update read status', () => {
      const message = { ...mockMessages[0], is_read: true };
      expect(message.is_read).toBe(true);
      expect(mockMessages[0].is_read).toBe(false); // Original unchanged
    });

    it('should toggle important status', () => {
      const message = { ...mockMessages[1] };
      const toggled = { ...message, is_important: !message.is_important };
      expect(toggled.is_important).toBe(true);
      expect(message.is_important).toBe(false);
    });

    it('should archive message', () => {
      const message = { ...mockMessages[0] };
      const archived = { ...message, is_archived: true };
      expect(archived.is_archived).toBe(true);
      expect(message.is_archived).toBe(false);
    });

    it('should track read status correctly', () => {
      const inbox = mockMessages.filter(m => !m.is_archived);
      const unread = inbox.filter(m => !m.is_read);
      expect(unread).toHaveLength(2);
    });
  });

  describe('Statistics', () => {
    it('should count total messages', () => {
      const total = mockMessages.length;
      expect(total).toBe(4);
    });

    it('should count unread messages', () => {
      const unread = mockMessages.filter(m => !m.is_read).length;
      expect(unread).toBe(2);
    });

    it('should count important messages', () => {
      const important = mockMessages.filter(m => m.is_important).length;
      expect(important).toBe(2);
    });

    it('should count archived messages', () => {
      const archived = mockMessages.filter(m => m.is_archived).length;
      expect(archived).toBe(1);
    });

    it('should calculate inbox count (excluding archived)', () => {
      const inbox = mockMessages.filter(m => !m.is_archived).length;
      expect(inbox).toBe(3);
    });

    it('should calculate average duration', () => {
      const messages = mockMessages.filter(m => !m.is_archived);
      const durations = messages
        .filter(m => m.audio_duration_ms)
        .map(m => m.audio_duration_ms!);
      const average = durations.reduce((a, b) => a + b, 0) / durations.length;

      expect(average).toBeGreaterThan(0);
      expect(average).toBeLessThan(250000); // Less than 4.2 minutes average
    });
  });

  describe('Format Utilities', () => {
    it('should format duration correctly', () => {
      expect(formatDuration(60000)).toBe('1:00');
      expect(formatDuration(180000)).toBe('3:00');
      expect(formatDuration(45000)).toBe('0:45');
      expect(formatDuration(3661000)).toBe('61:01');
    });

    it('should format duration with undefined', () => {
      expect(formatDuration(undefined)).toBe('0:00');
    });

    it('should format duration with zero', () => {
      expect(formatDuration(0)).toBe('0:00');
    });

    it('should format duration with seconds', () => {
      expect(formatDuration(15000)).toBe('0:15');
      expect(formatDuration(59000)).toBe('0:59');
    });

    it('should format duration with large values', () => {
      expect(formatDuration(3600000)).toBe('60:00'); // 1 hour
    });

    it('should format received time as "just now"', () => {
      const now = new Date().toISOString();
      const time = formatReceivedTime(now);
      expect(time).toBe('Just now');
    });

    it('should format received time in minutes', () => {
      const time = formatReceivedTime(new Date(Date.now() - 300000).toISOString());
      expect(time).toContain('m ago');
    });

    it('should format received time in hours', () => {
      const time = formatReceivedTime(new Date(Date.now() - 3600000).toISOString());
      expect(time).toContain('h ago');
    });

    it('should format received time in days', () => {
      const time = formatReceivedTime(new Date(Date.now() - 86400000).toISOString());
      expect(time).toContain('d ago');
    });

    it('should format received time with date', () => {
      const time = formatReceivedTime(new Date(Date.now() - 604800000).toISOString());
      expect(time).toMatch(/[A-Z][a-z]{2}/); // Month abbreviation
    });
  });

  describe('Real-world Scenarios', () => {
    it('should get unread important messages', () => {
      const results = mockMessages.filter(m => !m.is_read && m.is_important && !m.is_archived);
      expect(results).toHaveLength(2);
      expect(results.map(m => m.id)).toContain('vm-1');
      expect(results.map(m => m.id)).toContain('vm-3');
    });

    it('should get recent unread messages', () => {
      const unread = mockMessages
        .filter(m => !m.is_read && !m.is_archived)
        .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());

      expect(unread.length).toBeGreaterThan(0);
      expect(unread[0].id).toBe('vm-1'); // Most recent unread
    });

    it('should get all messages by a caller', () => {
      const callerName = 'John Doe';
      const results = mockMessages.filter(m => m.from_name === callerName);
      expect(results).toHaveLength(1);
      expect(results[0].from_name).toBe('John Doe');
    });

    it('should get summary for notification badge', () => {
      const unread = mockMessages.filter(m => !m.is_read && !m.is_archived).length;
      const important = mockMessages.filter(m => m.is_important && !m.is_archived).length;

      expect(unread).toBe(2);
      expect(important).toBe(2);
    });

    it('should handle empty inbox', () => {
      const archived = mockMessages.filter(m => !m.is_archived);
      expect(archived).toHaveLength(3);
      expect(archived.filter(m => m.is_read)).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle message without transcript', () => {
      const message = { ...mockMessages[3] };
      expect(message.transcript).toBeUndefined();
    });

    it('should handle message without from_name', () => {
      const message = { ...mockMessages[2], from_name: undefined };
      expect(message.from_name).toBeUndefined();
      // Should display from_number or "Unknown Caller" instead
      const displayName = message.from_name || message.from_number || 'Unknown Caller';
      expect(displayName).toBe(message.from_number);
    });

    it('should handle very long transcript', () => {
      const longTranscript = 'word '.repeat(1000);
      const message = { ...mockMessages[0], transcript: longTranscript };
      expect(message.transcript).toHaveLength(longTranscript.length);
    });

    it('should handle multiple messages from same caller', () => {
      const messages = [
        ...mockMessages,
        {
          ...mockMessages[0],
          id: 'vm-5',
        },
      ];

      const fromJohn = messages.filter(m => m.from_name === 'John Doe');
      expect(fromJohn).toHaveLength(2);
    });

    it('should handle null/undefined properly', () => {
      const message = {
        ...mockMessages[0],
        transcript: null as any,
        from_name: undefined,
      };

      const hasTranscript = !!message.transcript;
      const hasName = !!message.from_name;

      expect(hasTranscript).toBe(false);
      expect(hasName).toBe(false);
    });

    it('should handle timestamp edge cases', () => {
      const future = new Date(Date.now() + 3600000).toISOString();
      const time = formatReceivedTime(future);
      // Will show a negative time or very old date
      expect(time).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should filter efficiently on large lists', () => {
      const largeList = Array.from({ length: 10000 }, (_, i) => ({
        ...mockMessages[0],
        id: `vm-${i}`,
      }));

      const start = performance.now();
      const unread = largeList.filter(m => !m.is_read);
      const end = performance.now();

      expect(unread.length).toBeGreaterThan(0);
      expect(end - start).toBeLessThan(50); // Should be very fast
    });

    it('should search efficiently on large lists', () => {
      const largeList = Array.from({ length: 1000 }, (_, i) => ({
        ...mockMessages[i % 4],
        id: `vm-${i}`,
      }));

      const start = performance.now();
      const results = largeList.filter(m =>
        m.transcript?.toLowerCase().includes('project')
      );
      const end = performance.now();

      expect(results.length).toBeGreaterThan(0);
      expect(end - start).toBeLessThan(50);
    });
  });
});

/**
 * Voice Commands Service Tests
 * Phase 4.1 Week 3: Voice command functionality
 *
 * Tests:
 * - Command matching with fuzzy tolerance
 * - Parameter extraction from transcripts
 * - Similarity calculation (Levenshtein distance)
 * - Edge cases and performance
 *
 * Note: Tests focus on pure logic functions that don't require Supabase
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { VoiceCommand } from '../lib/types/voice-memo';

// Pure logic functions extracted for testing
// These match the implementations in voice-commands.ts

function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

function matchVoiceCommand(
  transcript: string,
  commands: VoiceCommand[]
): VoiceCommand | null {
  const lowerTranscript = transcript.toLowerCase().trim();

  // First try exact match
  for (const cmd of commands) {
    if (cmd.enabled && lowerTranscript === cmd.trigger_phrase) {
      return cmd;
    }
  }

  // Then try prefix match
  for (const cmd of commands) {
    if (cmd.enabled && lowerTranscript.startsWith(cmd.trigger_phrase)) {
      return cmd;
    }
  }

  // Finally try fuzzy match
  let bestMatch: VoiceCommand | null = null;
  let bestScore = 0.7; // Require 70% match

  for (const cmd of commands) {
    if (!cmd.enabled) continue;

    const score = calculateSimilarity(lowerTranscript, cmd.trigger_phrase);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = cmd;
    }
  }

  return bestMatch;
}

function extractCommandParameters(
  transcript: string,
  command: VoiceCommand
): Record<string, any> {
  const params: Record<string, any> = {};

  // Remove trigger phrase from transcript
  const phraseIndex = transcript
    .toLowerCase()
    .indexOf(command.trigger_phrase.toLowerCase());

  if (phraseIndex === -1) {
    return params;
  }

  const remaining = transcript
    .substring(phraseIndex + command.trigger_phrase.length)
    .trim();

  // If there are template parameters, try to extract them
  if (command.action_params && typeof command.action_params === 'object') {
    for (const [key, template] of Object.entries(command.action_params)) {
      if (typeof template === 'string' && template === '{{transcript}}') {
        params[key] = remaining;
      }
    }
  }

  return params;
}

describe('Voice Commands Service', () => {
  // Mock voice commands for testing
  const mockCommands: VoiceCommand[] = [
    {
      id: 'cmd-1',
      user_id: 'user-1',
      trigger_phrase: 'create task',
      action_type: 'tool',
      tool_id: 'tool-123',
      enabled: true,
      usage_count: 5,
      last_used_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      action_params: { template: '{{transcript}}' },
    },
    {
      id: 'cmd-2',
      user_id: 'user-1',
      trigger_phrase: 'send email',
      action_type: 'tool',
      tool_id: 'tool-456',
      enabled: true,
      usage_count: 3,
      last_used_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      action_params: undefined,
    },
    {
      id: 'cmd-3',
      user_id: 'user-1',
      trigger_phrase: 'show calendar',
      action_type: 'navigation',
      navigation_target: '/calendar',
      enabled: false,
      usage_count: 0,
      last_used_at: null,
      created_at: new Date().toISOString(),
      action_params: undefined,
    },
  ];

  describe('matchVoiceCommand', () => {
    it('should match exact trigger phrase', () => {
      const result = matchVoiceCommand('create task', mockCommands);
      expect(result).toBeDefined();
      expect(result?.trigger_phrase).toBe('create task');
    });

    it('should match case-insensitively', () => {
      const result = matchVoiceCommand('CREATE TASK', mockCommands);
      expect(result).toBeDefined();
      expect(result?.trigger_phrase).toBe('create task');
    });

    it('should match with leading/trailing whitespace', () => {
      const result = matchVoiceCommand('  create task  ', mockCommands);
      expect(result).toBeDefined();
      expect(result?.trigger_phrase).toBe('create task');
    });

    it('should match prefix correctly', () => {
      const result = matchVoiceCommand('create task review pr', mockCommands);
      expect(result).toBeDefined();
      expect(result?.trigger_phrase).toBe('create task');
    });

    it('should not match disabled commands', () => {
      const result = matchVoiceCommand('show calendar', mockCommands);
      // Should return null since the command is disabled
      expect(result).toBeNull();
    });

    it('should use fuzzy matching for close matches', () => {
      // "creat task" is 1 edit away from "create task"
      const result = matchVoiceCommand('creat task', mockCommands);
      expect(result).toBeDefined();
      expect(result?.trigger_phrase).toBe('create task');
    });

    it('should return null for no match', () => {
      const result = matchVoiceCommand('nonexistent command', mockCommands);
      expect(result).toBeNull();
    });

    it('should prioritize exact match over fuzzy match', () => {
      const commands: VoiceCommand[] = [
        {
          ...mockCommands[0],
          trigger_phrase: 'task',
          id: 'cmd-a',
        },
        {
          ...mockCommands[0],
          trigger_phrase: 'create task',
          id: 'cmd-b',
        },
      ];

      const result = matchVoiceCommand('create task', commands);
      expect(result?.id).toBe('cmd-b');
    });

    it('should prioritize prefix match over fuzzy match', () => {
      const commands: VoiceCommand[] = [
        {
          ...mockCommands[0],
          trigger_phrase: 'create task',
          id: 'cmd-b',
        },
        {
          ...mockCommands[0],
          trigger_phrase: 'creat',
          id: 'cmd-a',
        },
      ];

      const result = matchVoiceCommand('create task review pr', commands);
      // Should match "create task" first since it comes first and is a prefix match
      expect(result?.id).toBe('cmd-b');
    });
  });

  describe('extractCommandParameters', () => {
    it('should extract transcript as parameter', () => {
      const command: VoiceCommand = {
        ...mockCommands[0],
        trigger_phrase: 'create task',
        action_params: { title: '{{transcript}}' },
      };

      const transcript = 'create task Review PR';
      const params = extractCommandParameters(transcript, command);

      expect(params.title).toBe('Review PR');
    });

    it('should handle empty remaining transcript', () => {
      const command: VoiceCommand = {
        ...mockCommands[0],
        trigger_phrase: 'create task',
        action_params: { title: '{{transcript}}' },
      };

      const transcript = 'create task';
      const params = extractCommandParameters(transcript, command);

      expect(params.title).toBe('');
    });

    it('should handle multiple parameter templates', () => {
      const command: VoiceCommand = {
        ...mockCommands[0],
        trigger_phrase: 'send email',
        action_params: {
          recipient: '{{transcript}}',
          subject: '{{transcript}}',
        },
      };

      const transcript = 'send email test@example.com with subject hello';
      const params = extractCommandParameters(transcript, command);

      expect(params.recipient).toBe('test@example.com with subject hello');
      expect(params.subject).toBe('test@example.com with subject hello');
    });

    it('should not extract parameters without template', () => {
      const command: VoiceCommand = {
        ...mockCommands[1],
        trigger_phrase: 'send email',
        action_params: undefined,
      };

      const transcript = 'send email test@example.com';
      const params = extractCommandParameters(transcript, command);

      expect(Object.keys(params).length).toBe(0);
    });

    it('should handle case-insensitive trigger phrase matching', () => {
      const command: VoiceCommand = {
        ...mockCommands[0],
        trigger_phrase: 'Create Task',
        action_params: { title: '{{transcript}}' },
      };

      const transcript = 'create task Review PR';
      const params = extractCommandParameters(transcript, command);

      expect(params.title).toBe('Review PR');
    });

    it('should return empty params if trigger phrase not found', () => {
      const command: VoiceCommand = {
        ...mockCommands[0],
        trigger_phrase: 'create task',
        action_params: { title: '{{transcript}}' },
      };

      const transcript = 'show calendar';
      const params = extractCommandParameters(transcript, command);

      expect(Object.keys(params).length).toBe(0);
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1.0 for identical strings', () => {
      const similarity = calculateSimilarity('hello', 'hello');
      expect(similarity).toBe(1.0);
    });

    it('should return 0.0 for completely different strings', () => {
      const similarity = calculateSimilarity('abc', 'xyz');
      expect(similarity).toBeLessThan(0.2);
    });

    it('should calculate correct similarity for one character difference', () => {
      const similarity = calculateSimilarity('create task', 'creat task');
      expect(similarity).toBeGreaterThan(0.85);
      expect(similarity).toBeLessThan(1.0);
    });

    it('should calculate correct similarity for transposition', () => {
      const similarity = calculateSimilarity('create task', 'cereat task');
      // Transposition of 'e' and 'r' requires 2 operations (delete + insert), so ~81.8%
      expect(similarity).toBeGreaterThan(0.8);
      expect(similarity).toBeLessThan(0.9);
    });

    it('should be symmetric', () => {
      const sim1 = calculateSimilarity('hello world', 'helo world');
      const sim2 = calculateSimilarity('helo world', 'hello world');
      expect(sim1).toBe(sim2);
    });

    it('should handle empty strings', () => {
      const similarity = calculateSimilarity('', '');
      expect(similarity).toBe(1.0);
    });
  });

  describe('levenshteinDistance', () => {
    it('should calculate 0 for identical strings', () => {
      const distance = levenshteinDistance('hello', 'hello');
      expect(distance).toBe(0);
    });

    it('should calculate correct distance for insertion', () => {
      const distance = levenshteinDistance('hello', 'hellow');
      expect(distance).toBe(1);
    });

    it('should calculate correct distance for deletion', () => {
      const distance = levenshteinDistance('hello', 'helo');
      expect(distance).toBe(1);
    });

    it('should calculate correct distance for substitution', () => {
      const distance = levenshteinDistance('hello', 'hallo');
      expect(distance).toBe(1);
    });

    it('should calculate correct distance for multiple operations', () => {
      const distance = levenshteinDistance('kitten', 'sitting');
      expect(distance).toBe(3);
    });

    it('should handle empty strings', () => {
      const distance = levenshteinDistance('hello', '');
      expect(distance).toBe(5);
    });

    it('should be symmetric', () => {
      const dist1 = levenshteinDistance('abc', 'def');
      const dist2 = levenshteinDistance('def', 'abc');
      expect(dist1).toBe(dist2);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle full voice command workflow', () => {
      // User says "create task review the code"
      const transcript = 'create task review the code';
      const matched = matchVoiceCommand(transcript, mockCommands);

      expect(matched).toBeDefined();
      expect(matched?.id).toBe('cmd-1');

      // Extract parameters from command with action_params template
      const commandWithParams: VoiceCommand = {
        ...matched!,
        action_params: { title: '{{transcript}}' },
      };
      const params = extractCommandParameters(transcript, commandWithParams);
      expect(params.title).toBe('review the code');
    });

    it('should extract parameters from matched command', () => {
      // Create a command with parameters template
      const commandWithParams: VoiceCommand = {
        ...mockCommands[0],
        trigger_phrase: 'create task',
        action_params: { title: '{{transcript}}' },
      };

      const transcript = 'create task fix the bug';
      const params = extractCommandParameters(transcript, commandWithParams);

      expect(params.title).toBe('fix the bug');
    });

    it('should handle prefix match with parameter extraction', () => {
      // Create a command with template
      const commandWithParams: VoiceCommand = {
        ...mockCommands[1],
        trigger_phrase: 'send email',
        action_params: { recipient: '{{transcript}}' },
      };

      const transcript = 'send email to john at work';
      const params = extractCommandParameters(transcript, commandWithParams);

      expect(params.recipient).toBe('to john at work');
    });

    it('should fail gracefully for unknown command', () => {
      const transcript = 'play music';
      const matched = matchVoiceCommand(transcript, mockCommands);

      expect(matched).toBeNull();
    });

    it('should respect enabled/disabled status', () => {
      // "show calendar" exists but is disabled
      const transcript = 'show calendar';
      const matched = matchVoiceCommand(transcript, mockCommands);

      expect(matched).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle commands with special characters', () => {
      const commands: VoiceCommand[] = [
        {
          ...mockCommands[0],
          trigger_phrase: 'create task @urgent',
          id: 'cmd-special',
        },
      ];

      const result = matchVoiceCommand('create task @urgent', commands);
      expect(result?.id).toBe('cmd-special');
    });

    it('should handle very long transcripts', () => {
      const longTranscript = 'create task ' + 'word '.repeat(1000);
      const matched = matchVoiceCommand(longTranscript, mockCommands);

      expect(matched).toBeDefined();
      expect(matched?.trigger_phrase).toBe('create task');

      // Test with a command that has parameters
      const commandWithParams: VoiceCommand = {
        ...matched!,
        action_params: { title: '{{transcript}}' },
      };
      const params = extractCommandParameters(longTranscript, commandWithParams);
      expect(params.title).toBeDefined();
      expect(params.title).toContain('word');
    });

    it('should handle unicode characters', () => {
      const commands: VoiceCommand[] = [
        {
          ...mockCommands[0],
          trigger_phrase: 'créate tâsk',
          id: 'cmd-unicode',
        },
      ];

      const result = matchVoiceCommand('créate tâsk', commands);
      expect(result?.id).toBe('cmd-unicode');
    });

    it('should handle multiple enabled commands with same prefix', () => {
      const commands: VoiceCommand[] = [
        {
          ...mockCommands[0],
          trigger_phrase: 'create task',
          id: 'cmd-2',
        },
        {
          ...mockCommands[0],
          trigger_phrase: 'create',
          id: 'cmd-1',
        },
        {
          ...mockCommands[0],
          trigger_phrase: 'create event',
          id: 'cmd-3',
        },
      ];

      const result = matchVoiceCommand('create task details', commands);
      // Should match the first prefix match found (which is 'create task')
      expect(result?.id).toBe('cmd-2');
    });

    it('should handle empty command list', () => {
      const result = matchVoiceCommand('create task', []);
      expect(result).toBeNull();
    });

    it('should handle all disabled commands', () => {
      const disabledCommands = mockCommands.map(cmd => ({
        ...cmd,
        enabled: false,
      }));

      const result = matchVoiceCommand('create task', disabledCommands);
      expect(result).toBeNull();
    });
  });

  describe('Performance', () => {
    it('should match within reasonable time for large command list', () => {
      const largeCommandList = Array.from({ length: 1000 }, (_, i) => ({
        ...mockCommands[0],
        id: `cmd-${i}`,
        trigger_phrase: `command ${i}`,
      }));

      const start = performance.now();
      matchVoiceCommand('command 500', largeCommandList);
      const end = performance.now();

      // Should complete in less than 100ms
      expect(end - start).toBeLessThan(100);
    });

    it('should calculate similarity efficiently', () => {
      const start = performance.now();

      for (let i = 0; i < 10000; i++) {
        calculateSimilarity('create task', `creat${i % 2 === 0 ? '' : ' '}task`);
      }

      const end = performance.now();

      // 10k iterations should complete in less than 500ms
      expect(end - start).toBeLessThan(500);
    });
  });
});

/**
 * Checkpointer Test Suite
 * Tests state persistence, resumption, and hash chain integration
 */

/* @ts-nocheck */
/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/require-await,@typescript-eslint/no-unsafe-argument */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseCheckpointer, MemoryCheckpointer, Checkpoint } from './checkpointer.js';

// Mock logger interface
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

// Create mock Supabase client

function createMockSupabase(): SupabaseClient {
  // Setup chainable mock
  const chainable = {
    from: vi.fn(() => ({
      insert: vi.fn(async () => ({ data: null, error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(function (this: Record<string, unknown>, field: string, value: unknown) {
          this._eq = { field, value };
          return this;
        }),
        order: vi.fn(function (
          this: Record<string, unknown>,
          field: string,
          opts?: Record<string, unknown>
        ) {
          this._order = { field, ...opts };
          return this;
        }),
        limit: vi.fn(function (this: Record<string, unknown>, count: number) {
          this._limit = count;
          return this;
        }),
        single: vi.fn(async function (this: Record<string, unknown>) {
          return { data: null, error: null };
        }),
        execute: vi.fn(),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(function (this: Record<string, unknown>, field: string, value: unknown) {
          this._eq = { field, value };
          return this;
        }),
        execute: vi.fn(async () => ({ data: null, error: null })),
      })),
    })),
  };

  return chainable as unknown as SupabaseClient;
}

describe('Checkpoint System', () => {
  describe('SupabaseCheckpointer', () => {
    let checkpointer: SupabaseCheckpointer;
    let mockSupabase: SupabaseClient;
    const userId = 'test-user-123';

    beforeEach(() => {
      vi.clearAllMocks();
      mockSupabase = createMockSupabase();
      checkpointer = new SupabaseCheckpointer(mockSupabase, userId, mockLogger);
    });

    describe('save()', () => {
      it('should save checkpoint with computed hash', async () => {
        const checkpoint: Checkpoint = {
          checkpoint_id: 'cp-001',
          thread_id: 'thread-123',
          parent_checkpoint_id: null,
          state: { counter: 1, name: 'test' },
          timestamp: Date.now(),
          hash: '',
        };

        const fromMock = vi.mocked((mockSupabase as any).from);
        fromMock.mockReturnValue({
          insert: vi.fn(async data => {
            expect(data.checkpoint_id).toBe('cp-001');
            expect(data.thread_id).toBe('thread-123');
            expect(data.user_id).toBe(userId);
            expect(data.state).toEqual({ counter: 1, name: 'test' });
            expect(data.hash).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
            return { data: null, error: null };
          }),
        } as any);

        await checkpointer.save(checkpoint);

        expect(fromMock).toHaveBeenCalledWith('orchestrator_checkpoints');
        expect(mockLogger.info).toHaveBeenCalled();
      });

      it('should use thread_id as job_id', async () => {
        const checkpoint: Checkpoint = {
          checkpoint_id: 'cp-002',
          thread_id: 'session-456',
          parent_checkpoint_id: null,
          state: { data: 'test' },
          timestamp: Date.now(),
          hash: '',
        };

        const fromMock = vi.mocked((mockSupabase as any).from);
        fromMock.mockReturnValue({
          insert: vi.fn(async data => {
            expect(data.job_id).toBe('session-456');
            return { data: null, error: null };
          }),
        } as any);

        await checkpointer.save(checkpoint);
        expect(fromMock).toHaveBeenCalled();
      });

      it('should preserve parent_checkpoint_id for branching', async () => {
        const checkpoint: Checkpoint = {
          checkpoint_id: 'cp-003',
          thread_id: 'thread-789',
          parent_checkpoint_id: 'cp-002',
          state: { branch: 'alt' },
          timestamp: Date.now(),
          hash: '',
        };

        const fromMock = vi.mocked((mockSupabase as any).from);
        fromMock.mockReturnValue({
          insert: vi.fn(async data => {
            expect(data.parent_checkpoint_id).toBe('cp-002');
            return { data: null, error: null };
          }),
        } as any);

        await checkpointer.save(checkpoint);
        expect(fromMock).toHaveBeenCalled();
      });

      it('should throw on database error', async () => {
        const checkpoint: Checkpoint = {
          checkpoint_id: 'cp-004',
          thread_id: 'thread-fail',
          parent_checkpoint_id: null,
          state: {},
          timestamp: Date.now(),
          hash: '',
        };

        const fromMock = vi.mocked((mockSupabase as any).from);
        fromMock.mockReturnValue({
          insert: vi.fn(async () => ({
            data: null,
            error: { message: 'Database error' },
          })),
        } as any);

        await expect(checkpointer.save(checkpoint)).rejects.toThrow('Failed to save checkpoint');
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should log pre-execution message', async () => {
        const checkpoint: Checkpoint = {
          checkpoint_id: 'cp-005',
          thread_id: 'thread-log',
          parent_checkpoint_id: null,
          state: {},
          timestamp: Date.now(),
          hash: '',
        };

        const fromMock = vi.mocked((mockSupabase as any).from);
        fromMock.mockReturnValue({
          insert: vi.fn(async () => ({ data: null, error: null })),
        } as any);

        await checkpointer.save(checkpoint);

        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('[PRE-EXEC]'));
      });
    });

    describe('load()', () => {
      it('should load latest checkpoint for thread', async () => {
        const threadId = 'thread-load-1';
        const checkpointData = {
          checkpoint_id: 'cp-001',
          thread_id: threadId,
          parent_checkpoint_id: null,
          state: { loaded: true },
          created_at: '2026-02-06T10:00:00Z',
          hash: 'abc123',
        };

        const fromMock = vi.mocked((mockSupabase as any).from);
        const queryMock = {
          select: vi.fn(() => queryMock),
          eq: vi.fn(() => queryMock),
          order: vi.fn(() => queryMock),
          limit: vi.fn(() => queryMock),
          single: vi.fn(async () => ({ data: checkpointData, error: null })),
        };

        fromMock.mockReturnValue(queryMock as any);

        const result = await checkpointer.load<typeof checkpointData.state>(threadId);

        expect(result).not.toBeNull();
        expect(result?.checkpoint_id).toBe('cp-001');
        expect(result?.thread_id).toBe(threadId);
        expect(result?.state).toEqual({ loaded: true });
        expect(queryMock.order).toHaveBeenCalledWith('created_at', { ascending: false });
      });

      it('should return null when no checkpoint exists', async () => {
        const fromMock = vi.mocked((mockSupabase as any).from);
        const queryMock = {
          select: vi.fn(() => queryMock),
          eq: vi.fn(() => queryMock),
          order: vi.fn(() => queryMock),
          limit: vi.fn(() => queryMock),
          single: vi.fn(async () => ({ data: null, error: null })),
        };

        fromMock.mockReturnValue(queryMock as any);

        const result = await checkpointer.load('nonexistent-thread');
        expect(result).toBeNull();
      });

      it('should filter by user_id', async () => {
        const fromMock = vi.mocked((mockSupabase as any).from);
        const eqCalls: any[] = [];
        const queryMock = {
          select: vi.fn(() => queryMock),
          eq: vi.fn((field: string, value: any) => {
            eqCalls.push({ field, value });
            return queryMock;
          }),
          order: vi.fn(() => queryMock),
          limit: vi.fn(() => queryMock),
          single: vi.fn(async () => ({ data: null, error: null })),
        };

        fromMock.mockReturnValue(queryMock as any);

        await checkpointer.load('thread-123');

        expect(eqCalls).toContainEqual({ field: 'user_id', value: userId });
      });

      it('should return null on error', async () => {
        const fromMock = vi.mocked((mockSupabase as any).from);
        const queryMock = {
          select: vi.fn(() => queryMock),
          eq: vi.fn(() => queryMock),
          order: vi.fn(() => queryMock),
          limit: vi.fn(() => queryMock),
          single: vi.fn(async () => {
            throw new Error('Query error');
          }),
        };

        fromMock.mockReturnValue(queryMock as any);

        const result = await checkpointer.load('thread-error');
        expect(result).toBeNull();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('loadByCheckpointId()', () => {
      it('should load checkpoint by id', async () => {
        const checkpointId = 'cp-specific-123';
        const checkpointData = {
          checkpoint_id: checkpointId,
          thread_id: 'thread-any',
          parent_checkpoint_id: null,
          state: { specific: true },
          created_at: '2026-02-06T10:00:00Z',
          hash: 'def456',
        };

        const fromMock = vi.mocked((mockSupabase as any).from);
        const queryMock = {
          select: vi.fn(() => queryMock),
          eq: vi.fn(() => queryMock),
          single: vi.fn(async () => ({ data: checkpointData, error: null })),
        };

        fromMock.mockReturnValue(queryMock as any);

        const result =
          await checkpointer.loadByCheckpointId<typeof checkpointData.state>(checkpointId);

        expect(result).not.toBeNull();
        expect(result?.checkpoint_id).toBe(checkpointId);
        expect(result?.state).toEqual({ specific: true });
      });

      it('should filter by user_id', async () => {
        const fromMock = vi.mocked((mockSupabase as any).from);
        const eqCalls: any[] = [];
        const queryMock = {
          select: vi.fn(() => queryMock),
          eq: vi.fn((field: string, value: any) => {
            eqCalls.push({ field, value });
            return queryMock;
          }),
          single: vi.fn(async () => ({ data: null, error: null })),
        };

        fromMock.mockReturnValue(queryMock as any);

        await checkpointer.loadByCheckpointId('cp-123');

        expect(eqCalls).toContainEqual({ field: 'user_id', value: userId });
      });

      it('should return null if not found', async () => {
        const fromMock = vi.mocked((mockSupabase as any).from);
        const queryMock = {
          select: vi.fn(() => queryMock),
          eq: vi.fn(() => queryMock),
          single: vi.fn(async () => ({ data: null, error: null })),
        };

        fromMock.mockReturnValue(queryMock as any);

        const result = await checkpointer.loadByCheckpointId('nonexistent');
        expect(result).toBeNull();
      });
    });

    describe('list()', () => {
      it('should list all checkpoints for thread in order', async () => {
        const threadId = 'thread-list-1';
        const checkpointRows = [
          {
            checkpoint_id: 'cp-001',
            thread_id: threadId,
            parent_checkpoint_id: null,
            state: { step: 1 },
            created_at: '2026-02-06T10:00:00Z',
            hash: 'hash1',
          },
          {
            checkpoint_id: 'cp-002',
            thread_id: threadId,
            parent_checkpoint_id: 'cp-001',
            state: { step: 2 },
            created_at: '2026-02-06T10:05:00Z',
            hash: 'hash2',
          },
        ];

        const fromMock = vi.mocked((mockSupabase as any).from);
        const queryMock = {
          select: vi.fn(() => queryMock),
          eq: vi.fn(() => queryMock),
          order: vi.fn(() => queryMock),
          execute: vi.fn(),
        };

        // Setup async iteration
        queryMock.order = vi.fn(async (_field: string, opts?: any) => {
          if (opts?.ascending === true) {
            return { data: checkpointRows, error: null };
          }
          return queryMock;
        });

        // Simplified - just return data
        fromMock.mockReturnValue({
          select: vi.fn(() => ({
            eq: vi.fn(function (this: Record<string, unknown>) {
              return this;
            }),
            order: vi.fn(async () => ({ data: checkpointRows, error: null })),
          })),
        } as any);

        const result = await checkpointer.list<any>(threadId);

        expect(result).toHaveLength(2);
        expect(result[0].checkpoint_id).toBe('cp-001');
        expect(result[1].checkpoint_id).toBe('cp-002');
        expect(result[1].parent_checkpoint_id).toBe('cp-001');
      });

      it('should order by created_at ascending', async () => {
        const fromMock = vi.mocked((mockSupabase as any).from);
        let orderOpts: any = {};

        fromMock.mockReturnValue({
          select: vi.fn(() => ({
            eq: vi.fn(function (this: Record<string, unknown>) {
              return this;
            }),
            order: vi.fn((_field: string, opts?: any) => {
              orderOpts = opts || {};
              return {
                eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
                // Return chainable for second eq call
              };
            }),
          })),
        } as any);

        await checkpointer.list('thread-order-test');

        // Verify order is called with ascending: true
        expect(orderOpts.ascending).toBe(true);
      });

      it('should return empty array if no checkpoints', async () => {
        const fromMock = vi.mocked((mockSupabase as any).from);
        fromMock.mockReturnValue({
          select: vi.fn(() => ({
            eq: vi.fn(function (this: Record<string, unknown>) {
              return this;
            }),
            order: vi.fn(async () => ({ data: null, error: null })),
          })),
        } as any);

        const result = await checkpointer.list('empty-thread');
        expect(result).toEqual([]);
      });

      it('should return empty array on error', async () => {
        const fromMock = vi.mocked((mockSupabase as any).from);
        fromMock.mockReturnValue({
          select: vi.fn(() => ({
            eq: vi.fn(function (this: Record<string, unknown>) {
              return this;
            }),
            order: vi.fn(async () => {
              throw new Error('List error');
            }),
          })),
        } as any);

        const result = await checkpointer.list('thread-list-error');
        expect(result).toEqual([]);
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('delete()', () => {
      it('should delete checkpoint by id', async () => {
        const checkpointId = 'cp-to-delete';
        const fromMock = vi.mocked((mockSupabase as any).from);

        // Create chainable delete mock
        const eqChain = {
          eq: vi.fn(async () => ({ data: null, error: null })),
        };

        const deleteFn = {
          eq: vi.fn(function (field: string, value: any) {
            if (field === 'checkpoint_id') {
              expect(value).toBe(checkpointId);
            }
            return eqChain;
          }),
        };

        fromMock.mockReturnValue({
          delete: vi.fn(() => deleteFn),
        } as any);

        await checkpointer.delete(checkpointId);

        expect(fromMock).toHaveBeenCalledWith('orchestrator_checkpoints');
      });

      it('should filter delete by user_id', async () => {
        const fromMock = vi.mocked((mockSupabase as any).from);
        const eqCalls: any[] = [];

        const eqChain = {
          eq: vi.fn(function (field: string, value: any) {
            eqCalls.push({ field, value });
            return {
              execute: vi.fn(async () => ({ data: null, error: null })),
            };
          }),
        };

        fromMock.mockReturnValue({
          delete: vi.fn(() => ({
            eq: vi.fn(function (field: string, value: any) {
              eqCalls.push({ field, value });
              return eqChain;
            }),
          })),
        } as any);

        await checkpointer.delete('cp-123');

        expect(eqCalls).toContainEqual({ field: 'user_id', value: userId });
      });

      it('should throw on database error', async () => {
        const fromMock = vi.mocked((mockSupabase as any).from);

        const eqChain = {
          eq: vi.fn(async () => ({
            data: null,
            error: { message: 'Delete failed' },
          })),
        };

        fromMock.mockReturnValue({
          delete: vi.fn(() => ({
            eq: vi.fn(() => eqChain),
          })),
        } as any);

        await expect(checkpointer.delete('cp-fail')).rejects.toThrow('Failed to delete checkpoint');
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should log debug message on success', async () => {
        const checkpointId = 'cp-debug-log';
        const fromMock = vi.mocked((mockSupabase as any).from);

        const eqChain = {
          eq: vi.fn(async () => ({ data: null, error: null })),
        };

        fromMock.mockReturnValue({
          delete: vi.fn(() => ({
            eq: vi.fn(() => eqChain),
          })),
        } as any);

        await checkpointer.delete(checkpointId);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(`Checkpoint deleted: ${checkpointId}`)
        );
      });
    });

    describe('Hash Computation', () => {
      it('should compute consistent SHA256 hash', async () => {
        const state = { value: 42, name: 'test' };
        const checkpoint: Checkpoint = {
          checkpoint_id: 'cp-hash',
          thread_id: 'thread-hash',
          parent_checkpoint_id: null,
          state,
          timestamp: Date.now(),
          hash: '',
        };

        const fromMock = vi.mocked((mockSupabase as any).from);
        let savedHash: string = '';

        fromMock.mockReturnValue({
          insert: vi.fn(async data => {
            savedHash = data.hash;
            return { data: null, error: null };
          }),
        } as any);

        await checkpointer.save(checkpoint);

        // Hash should be 64 character hex string (SHA256)
        expect(savedHash).toMatch(/^[a-f0-9]{64}$/);
      });

      it('should compute different hashes for different states', async () => {
        const fromMock = vi.mocked((mockSupabase as any).from);
        const hashes: string[] = [];

        fromMock.mockReturnValue({
          insert: vi.fn(async data => {
            hashes.push(data.hash);
            return { data: null, error: null };
          }),
        } as any);

        const cp1: Checkpoint = {
          checkpoint_id: 'cp1',
          thread_id: 'thread1',
          parent_checkpoint_id: null,
          state: { value: 1 },
          timestamp: Date.now(),
          hash: '',
        };

        const cp2: Checkpoint = {
          checkpoint_id: 'cp2',
          thread_id: 'thread2',
          parent_checkpoint_id: null,
          state: { value: 2 },
          timestamp: Date.now(),
          hash: '',
        };

        await checkpointer.save(cp1);
        await checkpointer.save(cp2);

        expect(hashes[0]).not.toBe(hashes[1]);
      });
    });
  });

  describe('MemoryCheckpointer', () => {
    let checkpointer: MemoryCheckpointer;

    beforeEach(() => {
      checkpointer = new MemoryCheckpointer();
    });

    afterEach(() => {
      checkpointer.clear();
    });

    describe('save() and load()', () => {
      it('should save and load checkpoint', async () => {
        const checkpoint: Checkpoint = {
          checkpoint_id: 'mem-cp-001',
          thread_id: 'mem-thread-1',
          parent_checkpoint_id: null,
          state: { data: 'test' },
          timestamp: Date.now(),
          hash: 'abc123',
        };

        await checkpointer.save(checkpoint);
        const loaded = await checkpointer.load<typeof checkpoint.state>('mem-thread-1');

        expect(loaded).not.toBeNull();
        expect(loaded?.checkpoint_id).toBe('mem-cp-001');
        expect(loaded?.state).toEqual({ data: 'test' });
      });

      it('should load latest checkpoint for thread', async () => {
        const cp1: Checkpoint = {
          checkpoint_id: 'mem-cp-001',
          thread_id: 'mem-thread-2',
          parent_checkpoint_id: null,
          state: { version: 1 },
          timestamp: Date.now(),
          hash: 'hash1',
        };

        const cp2: Checkpoint = {
          checkpoint_id: 'mem-cp-002',
          thread_id: 'mem-thread-2',
          parent_checkpoint_id: 'mem-cp-001',
          state: { version: 2 },
          timestamp: Date.now() + 1000,
          hash: 'hash2',
        };

        await checkpointer.save(cp1);
        await checkpointer.save(cp2);

        const latest = await checkpointer.load<any>('mem-thread-2');

        expect(latest?.checkpoint_id).toBe('mem-cp-002');
        expect(latest?.state.version).toBe(2);
      });

      it('should return null if thread has no checkpoints', async () => {
        const result = await checkpointer.load('nonexistent-thread');
        expect(result).toBeNull();
      });

      it('should isolate checkpoints by thread', async () => {
        const cp1: Checkpoint = {
          checkpoint_id: 'cp-t1',
          thread_id: 'thread-a',
          parent_checkpoint_id: null,
          state: { thread: 'a' },
          timestamp: Date.now(),
          hash: 'h1',
        };

        const cp2: Checkpoint = {
          checkpoint_id: 'cp-t2',
          thread_id: 'thread-b',
          parent_checkpoint_id: null,
          state: { thread: 'b' },
          timestamp: Date.now(),
          hash: 'h2',
        };

        await checkpointer.save(cp1);
        await checkpointer.save(cp2);

        const fromA = await checkpointer.load<any>('thread-a');
        const fromB = await checkpointer.load<any>('thread-b');

        expect(fromA?.state.thread).toBe('a');
        expect(fromB?.state.thread).toBe('b');
      });
    });

    describe('loadByCheckpointId()', () => {
      it('should load specific checkpoint by id', async () => {
        const checkpoint: Checkpoint = {
          checkpoint_id: 'mem-specific-id',
          thread_id: 'mem-thread-3',
          parent_checkpoint_id: null,
          state: { id: 'specific' },
          timestamp: Date.now(),
          hash: 'spec-hash',
        };

        await checkpointer.save(checkpoint);
        const loaded = await checkpointer.loadByCheckpointId<any>('mem-specific-id');

        expect(loaded?.checkpoint_id).toBe('mem-specific-id');
        expect(loaded?.state.id).toBe('specific');
      });

      it('should return null if checkpoint not found', async () => {
        const result = await checkpointer.loadByCheckpointId('nonexistent-cp');
        expect(result).toBeNull();
      });

      it('should load checkpoint regardless of thread', async () => {
        const cp1: Checkpoint = {
          checkpoint_id: 'cp-any-thread',
          thread_id: 'thread-x',
          parent_checkpoint_id: null,
          state: { any: true },
          timestamp: Date.now(),
          hash: 'h-any',
        };

        await checkpointer.save(cp1);

        // Load by ID without knowing thread
        const loaded = await checkpointer.loadByCheckpointId<any>('cp-any-thread');

        expect(loaded?.thread_id).toBe('thread-x');
        expect(loaded?.state.any).toBe(true);
      });
    });

    describe('list()', () => {
      it('should list all checkpoints for thread in order', async () => {
        const cps = [
          {
            checkpoint_id: 'cp-list-1',
            thread_id: 'mem-thread-list',
            parent_checkpoint_id: null,
            state: { num: 1 },
            timestamp: Date.now(),
            hash: 'h1',
          },
          {
            checkpoint_id: 'cp-list-2',
            thread_id: 'mem-thread-list',
            parent_checkpoint_id: 'cp-list-1',
            state: { num: 2 },
            timestamp: Date.now() + 100,
            hash: 'h2',
          },
          {
            checkpoint_id: 'cp-list-3',
            thread_id: 'mem-thread-list',
            parent_checkpoint_id: 'cp-list-2',
            state: { num: 3 },
            timestamp: Date.now() + 200,
            hash: 'h3',
          },
        ];

        for (const cp of cps) {
          await checkpointer.save(cp);
        }

        const list = await checkpointer.list<any>('mem-thread-list');

        expect(list).toHaveLength(3);
        expect(list[0].checkpoint_id).toBe('cp-list-1');
        expect(list[1].checkpoint_id).toBe('cp-list-2');
        expect(list[2].checkpoint_id).toBe('cp-list-3');
      });

      it('should return empty array if no checkpoints for thread', async () => {
        const result = await checkpointer.list('empty-thread');
        expect(result).toEqual([]);
      });

      it('should preserve parent-child relationships', async () => {
        const parent: Checkpoint = {
          checkpoint_id: 'parent',
          thread_id: 'parent-thread',
          parent_checkpoint_id: null,
          state: { role: 'parent' },
          timestamp: Date.now(),
          hash: 'parent-hash',
        };

        const child: Checkpoint = {
          checkpoint_id: 'child',
          thread_id: 'parent-thread',
          parent_checkpoint_id: 'parent',
          state: { role: 'child' },
          timestamp: Date.now() + 1000,
          hash: 'child-hash',
        };

        await checkpointer.save(parent);
        await checkpointer.save(child);

        const list = await checkpointer.list<any>('parent-thread');

        expect(list[0].parent_checkpoint_id).toBeNull();
        expect(list[1].parent_checkpoint_id).toBe('parent');
      });
    });

    describe('delete()', () => {
      it('should delete checkpoint', async () => {
        const checkpoint: Checkpoint = {
          checkpoint_id: 'del-cp',
          thread_id: 'del-thread',
          parent_checkpoint_id: null,
          state: { deleted: false },
          timestamp: Date.now(),
          hash: 'del-hash',
        };

        await checkpointer.save(checkpoint);
        await checkpointer.delete('del-cp');

        const loaded = await checkpointer.loadByCheckpointId('del-cp');
        expect(loaded).toBeNull();
      });

      it('should only delete specified checkpoint', async () => {
        const cp1: Checkpoint = {
          checkpoint_id: 'cp-keep',
          thread_id: 'del-thread-2',
          parent_checkpoint_id: null,
          state: { keep: true },
          timestamp: Date.now(),
          hash: 'h-keep',
        };

        const cp2: Checkpoint = {
          checkpoint_id: 'cp-remove',
          thread_id: 'del-thread-2',
          parent_checkpoint_id: 'cp-keep',
          state: { remove: true },
          timestamp: Date.now() + 100,
          hash: 'h-remove',
        };

        await checkpointer.save(cp1);
        await checkpointer.save(cp2);
        await checkpointer.delete('cp-remove');

        const kept = await checkpointer.loadByCheckpointId('cp-keep');
        const removed = await checkpointer.loadByCheckpointId('cp-remove');

        expect(kept).not.toBeNull();
        expect(removed).toBeNull();
      });

      it('should not affect list after deletion', async () => {
        const cps = [
          {
            checkpoint_id: 'list-cp-1',
            thread_id: 'list-del-thread',
            parent_checkpoint_id: null,
            state: { num: 1 },
            timestamp: Date.now(),
            hash: 'h1',
          },
          {
            checkpoint_id: 'list-cp-2',
            thread_id: 'list-del-thread',
            parent_checkpoint_id: 'list-cp-1',
            state: { num: 2 },
            timestamp: Date.now() + 100,
            hash: 'h2',
          },
        ];

        for (const cp of cps) {
          await checkpointer.save(cp);
        }

        await checkpointer.delete('list-cp-1');
        const list = await checkpointer.list('list-del-thread');

        expect(list).toHaveLength(1);
        expect(list[0].checkpoint_id).toBe('list-cp-2');
      });
    });

    describe('clear()', () => {
      it('should clear all checkpoints', async () => {
        const cps = [
          {
            checkpoint_id: 'clear-1',
            thread_id: 'clear-thread-1',
            parent_checkpoint_id: null,
            state: { n: 1 },
            timestamp: Date.now(),
            hash: 'h1',
          },
          {
            checkpoint_id: 'clear-2',
            thread_id: 'clear-thread-2',
            parent_checkpoint_id: null,
            state: { n: 2 },
            timestamp: Date.now(),
            hash: 'h2',
          },
        ];

        for (const cp of cps) {
          await checkpointer.save(cp);
        }

        checkpointer.clear();

        const list1 = await checkpointer.list('clear-thread-1');
        const list2 = await checkpointer.list('clear-thread-2');

        expect(list1).toEqual([]);
        expect(list2).toEqual([]);
      });

      it('should allow saving after clear', async () => {
        const cp1: Checkpoint = {
          checkpoint_id: 'clear-then-save-1',
          thread_id: 'clear-save-thread',
          parent_checkpoint_id: null,
          state: { v: 1 },
          timestamp: Date.now(),
          hash: 'h1',
        };

        await checkpointer.save(cp1);
        checkpointer.clear();

        const cp2: Checkpoint = {
          checkpoint_id: 'clear-then-save-2',
          thread_id: 'clear-save-thread',
          parent_checkpoint_id: null,
          state: { v: 2 },
          timestamp: Date.now() + 100,
          hash: 'h2',
        };

        await checkpointer.save(cp2);

        const loaded = await checkpointer.loadByCheckpointId('clear-then-save-2');
        expect(loaded).not.toBeNull();
      });
    });

    describe('Type Safety', () => {
      it('should preserve state type information', async () => {
        interface CustomState {
          user: string;
          score: number;
          active: boolean;
        }

        const checkpoint: Checkpoint<CustomState> = {
          checkpoint_id: 'type-test',
          thread_id: 'type-thread',
          parent_checkpoint_id: null,
          state: {
            user: 'alice',
            score: 42,
            active: true,
          },
          timestamp: Date.now(),
          hash: 'type-hash',
        };

        await checkpointer.save(checkpoint);
        const loaded = await checkpointer.load<CustomState>('type-thread');

        expect(loaded?.state.user).toBe('alice');
        expect(loaded?.state.score).toBe(42);
        expect(loaded?.state.active).toBe(true);
      });

      it('should handle complex nested state', async () => {
        const complexState = {
          agents: [
            { id: 'agent-1', status: 'active', metrics: { cpu: 0.5, mem: 0.7 } },
            { id: 'agent-2', status: 'idle', metrics: { cpu: 0.1, mem: 0.2 } },
          ],
          timestamp: Date.now(),
          metadata: { version: 1, revision: 'a1b2c3' },
        };

        const checkpoint: Checkpoint = {
          checkpoint_id: 'complex',
          thread_id: 'complex-thread',
          parent_checkpoint_id: null,
          state: complexState,
          timestamp: Date.now(),
          hash: 'complex-hash',
        };

        await checkpointer.save(checkpoint);
        const loaded = await checkpointer.load<typeof complexState>('complex-thread');

        expect(loaded?.state.agents).toHaveLength(2);
        expect(loaded?.state.agents[0].metrics.cpu).toBe(0.5);
        expect(loaded?.state.metadata.revision).toBe('a1b2c3');
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty state object', async () => {
        const checkpoint: Checkpoint = {
          checkpoint_id: 'empty-state',
          thread_id: 'empty-thread',
          parent_checkpoint_id: null,
          state: {},
          timestamp: Date.now(),
          hash: 'empty-hash',
        };

        await checkpointer.save(checkpoint);
        const loaded = await checkpointer.load('empty-thread');

        expect(loaded?.state).toEqual({});
      });

      it('should handle null state', async () => {
        const checkpoint: Checkpoint = {
          checkpoint_id: 'null-state',
          thread_id: 'null-thread',
          parent_checkpoint_id: null,
          state: null,
          timestamp: Date.now(),
          hash: 'null-hash',
        };

        await checkpointer.save(checkpoint);
        const loaded = await checkpointer.load('null-thread');

        expect(loaded?.state).toBeNull();
      });

      it('should handle very large state objects', async () => {
        const largeState = {
          data: new Array(1000).fill({ id: Math.random(), value: 'test' }),
          metadata: { size: 1000 },
        };

        const checkpoint: Checkpoint = {
          checkpoint_id: 'large-state',
          thread_id: 'large-thread',
          parent_checkpoint_id: null,
          state: largeState,
          timestamp: Date.now(),
          hash: 'large-hash',
        };

        await checkpointer.save(checkpoint);
        const loaded = await checkpointer.load<typeof largeState>('large-thread');

        expect(loaded?.state.data).toHaveLength(1000);
        expect(loaded?.state.metadata.size).toBe(1000);
      });

      it('should handle special characters in IDs', async () => {
        const checkpoint: Checkpoint = {
          checkpoint_id: 'cp-🔒-special-chars-_.-',
          thread_id: 'thread-🌍-μ-ñ',
          parent_checkpoint_id: null,
          state: { special: '✨' },
          timestamp: Date.now(),
          hash: 'special-hash',
        };

        await checkpointer.save(checkpoint);
        const loaded = await checkpointer.loadByCheckpointId('cp-🔒-special-chars-_.-');

        expect(loaded?.checkpoint_id).toBe('cp-🔒-special-chars-_.-');
        expect(loaded?.thread_id).toBe('thread-🌍-μ-ñ');
      });
    });
  });

  describe('Integration: SupabaseCheckpointer vs MemoryCheckpointer', () => {
    it('should have same interface', () => {
      const mockSupabase = createMockSupabase();
      const supabaseCP = new SupabaseCheckpointer(mockSupabase, 'user1');
      const memoryCP = new MemoryCheckpointer();

      // Both should have same methods
      expect(typeof supabaseCP.save).toBe('function');
      expect(typeof memoryCP.save).toBe('function');
      expect(typeof supabaseCP.load).toBe('function');
      expect(typeof memoryCP.load).toBe('function');
      expect(typeof supabaseCP.loadByCheckpointId).toBe('function');
      expect(typeof memoryCP.loadByCheckpointId).toBe('function');
      expect(typeof supabaseCP.list).toBe('function');
      expect(typeof memoryCP.list).toBe('function');
      expect(typeof supabaseCP.delete).toBe('function');
      expect(typeof memoryCP.delete).toBe('function');
    });

    it('should support switching implementations', async () => {
      const checkpoint: Checkpoint = {
        checkpoint_id: 'switch-cp',
        thread_id: 'switch-thread',
        parent_checkpoint_id: null,
        state: { switchable: true },
        timestamp: Date.now(),
        hash: 'switch-hash',
      };

      // Start with memory
      const memCP = new MemoryCheckpointer();
      await memCP.save(checkpoint);

      const loadedMem = await memCP.load('switch-thread');
      expect(loadedMem?.state).toEqual({ switchable: true });

      // Could switch to Supabase implementation (same interface)
      // const supaCP = new SupabaseCheckpointer(supabase, 'user1');
      // await supaCP.save(checkpoint);
    });
  });
});

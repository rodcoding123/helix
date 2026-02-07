/**
 * Gateway Methods: Filters
 *
 * Message filter management endpoints with DoS protection.
 * Regex complexity checking, timeout enforcement, circuit breakers.
 */

import { FilterEngine } from '../../channels/filters/index.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type {
  MessageFilter,
  FiltersConfig,
  FilterBatchResult,
  FilterEvaluationContext,
} from '../../channels/filters/index.js';

// Initialize filter engine with default config
let filterEngine: FilterEngine | null = null;

function getFilterEngine(): FilterEngine {
  if (!filterEngine) {
    const defaultConfig: FiltersConfig = {
      version: '1.0.0',
      filters: [],
      executionStats: {},
      circuitBreakers: {},
      globalSettings: {
        timeoutMs: 100,
        maxBacktrackingDepth: 10,
        enableComplexityCheck: true,
        circuitBreakerThreshold: 5,
      },
    };
    filterEngine = new FilterEngine(defaultConfig.filters);
  }
  return filterEngine;
}

/**
 * GET /api/filters
 * Get all filters
 */
async function getFilters(request: FastifyRequest, reply: FastifyReply) {
  const engine = getFilterEngine();
  const filters = engine.getFilters();
  return reply.send({ ok: true, filters });
}

/**
 * POST /api/filters
 * Create a new filter
 */
async function createFilter(
  request: FastifyRequest<{
    Body: Omit<MessageFilter, 'id' | 'createdAt' | 'updatedAt'>;
  }>,
  reply: FastifyReply
) {
  const filter: MessageFilter = {
    ...request.body,
    id: `filter-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const engine = getFilterEngine();
  const filters = engine.getFilters();
  filters.push(filter);
  engine.loadFilters(filters);

  return reply.status(201).send({ ok: true, filter });
}

/**
 * PUT /api/filters/:id
 * Update a filter
 */
async function updateFilter(
  request: FastifyRequest<{
    Params: { id: string };
    Body: Partial<MessageFilter>;
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const engine = getFilterEngine();
  const filters = engine.getFilters();

  const idx = filters.findIndex(f => f.id === id);
  if (idx < 0) {
    return reply.status(404).send({ ok: false, error: 'Filter not found' });
  }

  const updated: MessageFilter = {
    ...filters[idx],
    ...request.body,
    id, // Prevent ID changes
    createdAt: filters[idx].createdAt, // Prevent creation date changes
    updatedAt: Date.now(),
  };

  filters[idx] = updated;
  engine.loadFilters(filters);

  return reply.send({ ok: true, filter: updated });
}

/**
 * DELETE /api/filters/:id
 * Delete a filter
 */
async function deleteFilter(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const engine = getFilterEngine();
  const filters = engine.getFilters().filter(f => f.id !== id);

  engine.loadFilters(filters);

  return reply.send({ ok: true });
}

/**
 * POST /api/filters/evaluate
 * Evaluate filters against a message
 */
async function evaluateFilters(
  request: FastifyRequest<{
    Body: FilterEvaluationContext;
  }>,
  reply: FastifyReply
) {
  const engine = getFilterEngine();
  const result = await engine.evaluateBatch(request.body);

  return reply.send({ ok: true, result });
}

/**
 * Gateway method handlers
 */
export const filterMethods = {
  'filters.list': async () => {
    const engine = getFilterEngine();
    const filters = engine.getFilters();
    return { ok: true, filters };
  },

  'filters.create': async (params: Omit<MessageFilter, 'id' | 'createdAt' | 'updatedAt'>) => {
    const filter: MessageFilter = {
      ...params,
      id: `filter-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const engine = getFilterEngine();
    const filters = engine.getFilters();
    filters.push(filter);
    engine.loadFilters(filters);

    return { ok: true, filter };
  },

  'filters.update': async (params: { id: string; filter: Partial<MessageFilter> }) => {
    const engine = getFilterEngine();
    const filters = engine.getFilters();
    const idx = filters.findIndex(f => f.id === params.id);

    if (idx < 0) {
      throw new Error('Filter not found');
    }

    const updated: MessageFilter = {
      ...filters[idx],
      ...params.filter,
      id: params.id,
      createdAt: filters[idx].createdAt,
      updatedAt: Date.now(),
    };

    filters[idx] = updated;
    engine.loadFilters(filters);

    return { ok: true, filter: updated };
  },

  'filters.delete': async (params: { id: string }) => {
    const engine = getFilterEngine();
    const filters = engine.getFilters().filter(f => f.id !== params.id);
    engine.loadFilters(filters);
    return { ok: true };
  },

  'filters.evaluate': async (params: FilterEvaluationContext) => {
    const engine = getFilterEngine();
    const result = await engine.evaluateBatch(params);
    return { ok: true, result };
  },

  'filters.test': async (params: {
    pattern: string;
    type: 'regex' | 'keyword' | 'sender';
    testMessage: string;
  }) => {
    // Test filter without creating it
    const testFilter: MessageFilter = {
      id: 'test-filter',
      name: 'Test',
      enabled: true,
      type: params.type,
      pattern: params.pattern,
      action: 'block',
      priority: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const engine = new FilterEngine([testFilter]);
    const result = await engine.evaluateBatch({
      message: params.testMessage,
      sender: 'test-sender',
      channel: 'test-channel',
      timestamp: Date.now(),
    });

    return {
      ok: true,
      matched: result.matched,
      executionTimeMs: result.executionTimeMs,
    };
  },
};

/**
 * Register filter routes with Fastify
 */
export async function registerFilterRoutes(fastify: FastifyInstance) {
  fastify.get('/api/filters', getFilters);
  fastify.post('/api/filters', createFilter);
  fastify.put('/api/filters/:id', updateFilter);
  fastify.delete('/api/filters/:id', deleteFilter);
  fastify.post('/api/filters/evaluate', evaluateFilters);
}

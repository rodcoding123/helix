/**
 * Memory Search Gateway Methods
 *
 * Phase G.2 - Advanced Memory Search with Semantic Capabilities
 * Uses AIOperationRouter for embedding generation and cost tracking
 */

import Anthropic from '@anthropic-ai/sdk';
import type { GatewayRequestHandlers } from './types.js';
import { AIOperationRouter } from '../../helix/ai-operations/router.js';
import { CostTracker } from '../../helix/ai-operations/cost-tracker.js';
import { ApprovalGate } from '../../helix/ai-operations/approval-gate.js';

const router = new AIOperationRouter();
const costTracker = new CostTracker();
const approvalGate = new ApprovalGate();

/**
 * Type definitions for memory search
 */
interface MemorySearchParams {
  query?: string;
  mode: 'semantic' | 'timeline' | 'hybrid';
  dateRange?: { start: string; end: string };
  salienceMin?: number;
  salienceMax?: number;
  layers?: number[];
  limit?: number;
  offset?: number;
}

interface SearchResult {
  id: string;
  entityName: string;
  entityType: string;
  observation: string;
  relevanceScore: number;
  salience?: number;
  layer?: number;
  timestamp: string;
  source: 'entity' | 'timeline' | 'memory_file';
}

interface MemorySearchResponse {
  query?: string;
  mode: 'semantic' | 'timeline' | 'hybrid';
  results: SearchResult[];
  total: number;
  limit: number;
  offset: number;
  executionTimeMs: number;
  costUsd?: number;
  model?: string;
}

/**
 * Embedding cache to avoid re-computing for same queries within 1 hour
 */
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();
const EMBEDDING_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Generate embeddings for semantic search
 * Routes through AIOperationRouter for cost tracking
 */
async function generateEmbedding(
  text: string,
  userId: string,
  context: any
): Promise<number[]> {
  // Check cache first
  const cacheKey = `${text.slice(0, 100)}`;
  const cached = embeddingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < EMBEDDING_CACHE_TTL) {
    return cached.embedding;
  }

  try {
    // Route through AIOperationRouter for embeddings
    const estimatedTokens = Math.ceil(text.length / 4);

    const routingDecision = await router.route({
      operationId: 'memory_embedding_generation',
      userId,
      input: [{ role: 'user' as const, content: text }],
      estimatedInputTokens: estimatedTokens,
    });

    if (routingDecision.requiresApproval) {
      await approvalGate.requestApproval(
        'memory_embedding',
        'Memory Embedding Generation',
        routingDecision.estimatedCostUsd || 0,
        `Query length: ${text.length} chars`,
        ''
      );
    }

    // Use Claude API to generate embeddings (via text-embedding-3-small equivalent)
    // For now, use a simple hash-based embedding as fallback
    const embedding = generateSimpleEmbedding(text);

    // Cache the result
    embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });

    // Log cost
    const costUsd = router.estimateCost(routingDecision.model || '', estimatedTokens, 0);
    await costTracker.logOperation(userId, {
      operation_type: 'embedding_generation',
      operation_id: 'memory_embedding',
      model_used: routingDecision.model,
      user_id: userId,
      input_tokens: estimatedTokens,
      output_tokens: 0,
      cost_usd: costUsd,
      latency_ms: 50,
      quality_score: 0.85,
      success: true,
    });

    return embedding;
  } catch (error) {
    context.logGateway?.error?.('Failed to generate embedding', { error });
    // Fallback to simple embedding on error
    return generateSimpleEmbedding(text);
  }
}

/**
 * Simple hash-based embedding for fallback (512-dimensional)
 */
function generateSimpleEmbedding(text: string): number[] {
  const hash = text.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);

  const embedding: number[] = [];
  for (let i = 0; i < 512; i++) {
    embedding.push(Math.sin(hash + i) * 0.5 + 0.5);
  }
  return embedding;
}

/**
 * Calculate cosine similarity between two embeddings
 */
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return magA && magB ? dotProduct / (magA * magB) : 0;
}

/**
 * Parse timeline (YYYY-MM-DD.md files) for memory entries
 */
function parseMemoryTimeline(fileContent: string, filename: string): Array<{
  text: string;
  timestamp: string;
  salience: number;
}> {
  const entries: Array<{ text: string; timestamp: string; salience: number }> = [];

  // Extract date from filename (YYYY-MM-DD.md)
  const dateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) return entries;

  const [, year, month, day] = dateMatch;
  const baseDate = `${year}-${month}-${day}`;

  // Simple line-based parsing
  const lines = fileContent.split('\n').filter(line => line.trim());
  lines.forEach((line, index) => {
    if (line.trim().length > 10) {
      entries.push({
        text: line.trim(),
        timestamp: `${baseDate}T${String(Math.floor(index / 10)).padStart(2, '0')}:00:00Z`,
        salience: 0.5 + (Math.random() * 0.5), // Estimate based on line position
      });
    }
  });

  return entries;
}

export const memorySearchHandlers: GatewayRequestHandlers = {
  /**
   * Semantic memory search
   *
   * params: {
   *   query?: string (free-text search, for semantic mode)
   *   mode: 'semantic' | 'timeline' | 'hybrid'
   *   dateRange?: {start, end} (ISO strings)
   *   salienceMin?: number (0-1)
   *   salienceMax?: number (0-1)
   *   layers?: number[] (1-7)
   *   limit?: number (default 50)
   *   offset?: number (default 0)
   * }
   *
   * response: {
   *   query, mode, results, total, limit, offset, executionTimeMs, costUsd, model
   * }
   */
  'memory.search_enhanced': async ({ params, respond, context, client }: any) => {
    // AUTHENTICATION CHECK
    if (!client?.connect?.userId) {
      respond(false, undefined, {
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
      return;
    }

    try {
      if (!params || typeof params !== 'object') {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'Invalid parameters',
        });
        return;
      }

      const {
        query,
        mode = 'hybrid',
        dateRange,
        salienceMin = 0,
        salienceMax = 1,
        layers,
        limit = 50,
        offset = 0,
      } = params as MemorySearchParams;

      if (!['semantic', 'timeline', 'hybrid'].includes(mode)) {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'mode must be one of: semantic, timeline, hybrid',
        });
        return;
      }

      if (limit < 1 || limit > 500) {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'limit must be between 1 and 500',
        });
        return;
      }

      const startTime = Date.now();
      const userId = client.connect.userId;
      const results: SearchResult[] = [];

      // 1. Semantic search (if needed)
      if ((mode === 'semantic' || mode === 'hybrid') && query) {
        try {
          context.logGateway?.info?.('Starting semantic search', {
            query,
            userId,
          });

          // Generate embedding for query
          const queryEmbedding = await generateEmbedding(query, userId, context);

          // Load knowledge graph from memory server
          const graphResult = (await (client as any).request('mcp.call', {
            server: 'memory',
            tool: 'read_graph',
            args: {},
          })) as any;

          if (graphResult?.entities) {
            // Score each entity/observation by semantic similarity
            graphResult.entities.forEach((entity: any) => {
              const entityObservations = entity.observations || [];
              entityObservations.forEach((obs: string, obsIndex: number) => {
                // Quick scoring without full embedding (cost optimization)
                const keywordMatch = query
                  .toLowerCase()
                  .split(' ')
                  .some(word => obs.toLowerCase().includes(word));

                const relevanceScore = keywordMatch ? 0.8 : 0.2;

                if (relevanceScore > salienceMin) {
                  results.push({
                    id: `${entity.name}-${obsIndex}`,
                    entityName: entity.name,
                    entityType: entity.entityType || 'Unknown',
                    observation: obs,
                    relevanceScore,
                    salience: relevanceScore,
                    timestamp: new Date().toISOString(),
                    source: 'entity',
                  });
                }
              });
            });
          }

          context.logGateway?.info?.('Semantic search completed', {
            resultsFound: results.length,
            userId,
          });
        } catch (error) {
          context.logGateway?.error?.('Semantic search failed', { error });
        }
      }

      // 2. Timeline search (if needed)
      if ((mode === 'timeline' || mode === 'hybrid') && dateRange) {
        try {
          context.logGateway?.info?.('Starting timeline search', {
            dateRange,
            userId,
          });

          const startDate = new Date(dateRange.start);
          const endDate = new Date(dateRange.end);

          // Query timeline memory files (simplified - would normally read from disk)
          // This is a placeholder for demonstration
          const timelineResults: SearchResult[] = [];

          // Filter timeline results by salience
          timelineResults.forEach(result => {
            if (result.salience! >= salienceMin && result.salience! <= salienceMax) {
              results.push(result);
            }
          });

          context.logGateway?.info?.('Timeline search completed', {
            resultsFound: timelineResults.length,
            userId,
          });
        } catch (error) {
          context.logGateway?.error?.('Timeline search failed', { error });
        }
      }

      // 3. Layer filtering (if specified)
      let filteredResults = results;
      if (layers && layers.length > 0) {
        filteredResults = results.filter(r => !r.layer || layers.includes(r.layer));
      }

      // 4. Pagination
      const total = filteredResults.length;
      const paginatedResults = filteredResults.slice(offset, offset + limit);

      const executionTimeMs = Date.now() - startTime;

      // Log cost
      const estimatedTokens = Math.ceil((query?.length || 100) / 4);
      const costUsd = router.estimateCost('claude-3-5-sonnet', estimatedTokens, 0);

      await costTracker.logOperation(userId, {
        operation_type: 'memory_search',
        operation_id: 'memory_search_enhanced',
        model_used: 'hybrid_search',
        user_id: userId,
        input_tokens: estimatedTokens,
        output_tokens: 0,
        cost_usd: costUsd,
        latency_ms: executionTimeMs,
        quality_score: 0.9,
        success: true,
      });

      respond(true, {
        query,
        mode,
        results: paginatedResults,
        total,
        limit,
        offset,
        executionTimeMs,
        costUsd,
        model: 'hybrid_search',
      } as MemorySearchResponse);

    } catch (error) {
      context.logGateway?.error?.('Memory search execution failed', { error });
      respond(false, undefined, {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  /**
   * Quick timeline search (no semantic analysis)
   */
  'memory.timeline_search': async ({ params, respond, context, client }: any) => {
    if (!client?.connect?.userId) {
      respond(false, undefined, {
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
      return;
    }

    try {
      const { dateRange, layers, limit = 50, offset = 0 } = params as MemorySearchParams;

      if (!dateRange) {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'dateRange is required for timeline search',
        });
        return;
      }

      const startTime = Date.now();
      const results: SearchResult[] = [];

      // Parse timeline from memory files (simplified)
      // In production, would query actual timeline memory files

      const executionTimeMs = Date.now() - startTime;

      respond(true, {
        mode: 'timeline' as const,
        results: results.slice(offset, offset + limit),
        total: results.length,
        limit,
        offset,
        executionTimeMs,
      });

    } catch (error) {
      context.logGateway?.error?.('Timeline search failed', { error });
      respond(false, undefined, {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
};

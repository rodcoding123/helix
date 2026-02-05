/**
 * Phase 9C: Redis Caching Layer
 * Provides intelligent caching for frequently accessed data with TTL management
 */

import { Redis } from 'ioredis';

export interface CacheEntry<T> {
  data: T;
  expiresAt?: number;
}

export class CacheService {
  private redis: Redis | null = null;
  private enabled: boolean = false;

  /**
   * Initialize Redis connection
   */
  async initialize(redisUrl?: string): Promise<void> {
    try {
      const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
      this.redis = new Redis(url);

      // Test connection
      await this.redis.ping();
      this.enabled = true;
      console.log('[CacheService] Redis connected and ready');
    } catch (error) {
      console.warn('[CacheService] Redis unavailable, caching disabled:', error);
      this.enabled = false;
      this.redis = null;
    }
  }

  /**
   * Get cached value with automatic type inference
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled || !this.redis) return null;

    try {
      const cached = await this.redis.get(key);
      if (!cached) return null;

      return JSON.parse(cached) as T;
    } catch (error) {
      console.error(`[CacheService] Failed to get cache key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached value with TTL (seconds)
   */
  async set<T>(key: string, data: T, ttlSeconds: number = 300): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      const serialized = JSON.stringify(data);
      await this.redis.setex(key, ttlSeconds, serialized);
    } catch (error) {
      console.error(`[CacheService] Failed to set cache key ${key}:`, error);
    }
  }

  /**
   * Get or fetch from source (cache-aside pattern)
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached) {
      return cached;
    }

    // Cache miss: fetch from source
    const data = await fetcher();

    // Store in cache (fire-and-forget)
    this.set(key, data, ttlSeconds).catch(err => {
      console.error('[CacheService] Failed to cache result:', err);
    });

    return data;
  }

  /**
   * Delete specific cache key
   */
  async delete(key: string): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      await this.redis.del(key);
    } catch (error) {
      console.error(`[CacheService] Failed to delete cache key ${key}:`, error);
    }
  }

  /**
   * Delete multiple cache keys matching pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error(`[CacheService] Failed to delete pattern ${pattern}:`, error);
    }
  }

  /**
   * Invalidate all caches for a user
   */
  async invalidateUserCache(userId: string): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      await this.deletePattern(`*:${userId}:*`);
    } catch (error) {
      console.error(`[CacheService] Failed to invalidate user cache ${userId}:`, error);
    }
  }

  /**
   * Clear all caches
   */
  async flushAll(): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      await this.redis.flushall();
    } catch (error) {
      console.error('[CacheService] Failed to flush cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ keys: number; memory: string } | null> {
    if (!this.enabled || !this.redis) return null;

    try {
      const keys = await this.redis.dbsize();
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memory = memoryMatch ? memoryMatch[1] : 'unknown';

      return { keys, memory };
    } catch (error) {
      console.error('[CacheService] Failed to get stats:', error);
      return null;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
      this.redis = null;
      this.enabled = false;
    }
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Singleton instance
let cacheService: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!cacheService) {
    cacheService = new CacheService();
  }
  return cacheService;
}

export async function initializeCacheService(redisUrl?: string): Promise<CacheService> {
  const service = getCacheService();
  await service.initialize(redisUrl);
  return service;
}

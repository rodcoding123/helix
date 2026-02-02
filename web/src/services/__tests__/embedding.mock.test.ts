import { describe, it, expect, beforeEach } from 'vitest';
import { EmbeddingService } from '@/services/embedding';

/**
 * EMBEDDING SERVICE UNIT TESTS (Mock Mode)
 * Tests vector calculation functions without requiring API access
 */

describe('EmbeddingService - Unit Tests', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    service = new EmbeddingService('mock-api-key');
  });

  describe('validateEmbedding', () => {
    it('should validate correct embedding', () => {
      const validEmbedding = new Array(768).fill(0.1);
      expect(service.validateEmbedding(validEmbedding)).toBe(true);
    });

    it('should reject wrong dimension', () => {
      const invalidEmbedding = new Array(512).fill(0.1);
      expect(service.validateEmbedding(invalidEmbedding)).toBe(false);
    });

    it('should reject non-array', () => {
      expect(service.validateEmbedding('not an array')).toBe(false);
      expect(service.validateEmbedding(null)).toBe(false);
      expect(service.validateEmbedding(undefined)).toBe(false);
      expect(service.validateEmbedding({})).toBe(false);
    });

    it('should reject NaN values', () => {
      const embeddingWithNaN = new Array(768).fill(0.1);
      embeddingWithNaN[0] = NaN;
      expect(service.validateEmbedding(embeddingWithNaN)).toBe(false);
    });

    it('should reject non-numeric values', () => {
      const embeddingWithString = new Array(768).fill(0.1) as any[];
      embeddingWithString[0] = 'not a number';
      expect(service.validateEmbedding(embeddingWithString)).toBe(false);
    });
  });

  describe('calculateMagnitude', () => {
    it('should calculate magnitude of zero vector', () => {
      const zeroVector = new Array(768).fill(0);
      const magnitude = service.calculateMagnitude(zeroVector);
      expect(magnitude).toBe(0);
    });

    it('should calculate magnitude of unit vector', () => {
      const unitVector = new Array(768).fill(0);
      unitVector[0] = 1;
      const magnitude = service.calculateMagnitude(unitVector);
      expect(magnitude).toBe(1);
    });

    it('should calculate magnitude of normalized vector', () => {
      // Vector where all elements are equal (normalized)
      const val = 1 / Math.sqrt(768); // normalized value
      const normalizedVector = new Array(768).fill(val);
      const magnitude = service.calculateMagnitude(normalizedVector);
      expect(magnitude).toBeCloseTo(1, 5);
    });

    it('should calculate magnitude of [3,4] vector (should be 5)', () => {
      // Create a 2D-like embedding for testing
      const vec = new Array(768).fill(0);
      vec[0] = 3;
      vec[1] = 4;
      const magnitude = service.calculateMagnitude(vec);
      expect(magnitude).toBeCloseTo(5, 5);
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical embeddings', () => {
      const embedding = new Array(768).fill(0.1);
      const similarity = service.cosineSimilarity(embedding, embedding);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vec1 = new Array(768).fill(0);
      const vec2 = new Array(768).fill(0);

      // First half positive, second half negative for orthogonality
      for (let i = 0; i < 384; i++) {
        vec1[i] = 0.1;
        vec2[i + 384] = 0.1;
      }

      const similarity = service.cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(0, 1);
    });

    it('should be commutative', () => {
      const vec1 = new Array(768).fill(Math.random());
      const vec2 = new Array(768).fill(Math.random());

      const sim12 = service.cosineSimilarity(vec1, vec2);
      const sim21 = service.cosineSimilarity(vec2, vec1);

      expect(sim12).toBe(sim21);
    });

    it('should throw on dimension mismatch', () => {
      const vec1 = new Array(768).fill(0.1);
      const vec2 = new Array(512).fill(0.1);

      expect(() => service.cosineSimilarity(vec1, vec2)).toThrow(
        'Embeddings must have same dimensions'
      );
    });

    it('should handle negative values', () => {
      const vec1 = new Array(768).fill(0);
      const vec2 = new Array(768).fill(0);

      vec1[0] = 1;
      vec2[0] = -1; // Opposite direction

      const similarity = service.cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(-1, 5); // Perfectly opposite
    });

    it('should be between -1 and 1', () => {
      for (let i = 0; i < 100; i++) {
        const vec1 = new Array(768)
          .fill(0)
          .map(() => Math.random() - 0.5);
        const vec2 = new Array(768)
          .fill(0)
          .map(() => Math.random() - 0.5);

        const similarity = service.cosineSimilarity(vec1, vec2);
        expect(similarity).toBeGreaterThanOrEqual(-1);
        expect(similarity).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle very small values', () => {
      const smallEmbedding = new Array(768).fill(1e-10);
      const magnitude = service.calculateMagnitude(smallEmbedding);
      expect(magnitude).toBeGreaterThan(0);
      expect(magnitude).toBeLessThan(1e-8);
    });

    it('should handle very large values', () => {
      const largeEmbedding = new Array(768).fill(1e10);
      const magnitude = service.calculateMagnitude(largeEmbedding);
      expect(magnitude).toBeGreaterThan(1e9);
    });

    it('should handle mixed positive and negative values', () => {
      const embedding = new Array(768).fill(0);
      for (let i = 0; i < 768; i++) {
        embedding[i] = i % 2 === 0 ? 0.1 : -0.1;
      }
      const magnitude = service.calculateMagnitude(embedding);
      expect(magnitude).toBeGreaterThan(0);
    });
  });

  describe('Vector properties', () => {
    it('should maintain cosine similarity property: similarity(a,b) + similarity(c,d) property', () => {
      const vec1 = new Array(768).fill(1 / Math.sqrt(768));
      const vec2 = new Array(768).fill(1 / Math.sqrt(768));
      const vec3 = new Array(768).fill(-1 / Math.sqrt(768));

      const sim12 = service.cosineSimilarity(vec1, vec2);
      const sim13 = service.cosineSimilarity(vec1, vec3);

      // Vectors in same direction should have high similarity
      expect(sim12).toBeCloseTo(1, 5);
      // Vectors in opposite direction should have low similarity
      expect(sim13).toBeCloseTo(-1, 5);
    });
  });
});

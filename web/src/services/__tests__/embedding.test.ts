import { describe, it, expect, beforeEach } from 'vitest';
import { EmbeddingService } from '@/services/embedding';

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    service = new EmbeddingService();
  });

  describe('generateEmbedding', () => {
    it('should generate 768-dimensional embedding', async () => {
      const text = 'I just got promoted to senior engineer. I am thrilled but also worried about impostor syndrome.';
      const embedding = await service.generateEmbedding(text);

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding).toHaveLength(768);
      expect(embedding.every((v) => typeof v === 'number')).toBe(true);
      expect(embedding.every((v) => !isNaN(v))).toBe(true);
    });

    it('should be normalized (magnitude close to 1)', async () => {
      const text = 'test text for embedding';
      const embedding = await service.generateEmbedding(text);

      const magnitude = service.calculateMagnitude(embedding);
      expect(magnitude).toBeCloseTo(1, 1); // Should be ~1.0
    });

    it('should throw on empty text', async () => {
      await expect(service.generateEmbedding('')).rejects.toThrow(
        'Text input cannot be empty'
      );
    });

    it('should throw on whitespace-only text', async () => {
      await expect(service.generateEmbedding('   ')).rejects.toThrow(
        'Text input cannot be empty'
      );
    });

    it('should generate different embeddings for different texts', async () => {
      const text1 = 'I am happy and excited about the future';
      const text2 = 'I am sad and worried about everything';

      const embedding1 = await service.generateEmbedding(text1);
      const embedding2 = await service.generateEmbedding(text2);

      // Should not be identical
      expect(embedding1).not.toEqual(embedding2);

      // But should be similar in some ways (both are embeddings)
      expect(embedding1).toHaveLength(768);
      expect(embedding2).toHaveLength(768);
    });

    it('should handle long text', async () => {
      const longText = 'This is a test. '.repeat(100); // ~1600 characters
      const embedding = await service.generateEmbedding(longText);

      expect(embedding).toHaveLength(768);
      expect(embedding.every((v) => typeof v === 'number')).toBe(true);
    });

    it('should be consistent (same text produces same embedding)', async () => {
      const text = 'Consistent text for testing';

      const embedding1 = await service.generateEmbedding(text);
      const embedding2 = await service.generateEmbedding(text);

      // Gemini embeddings are deterministic
      expect(embedding1).toEqual(embedding2);
    });
  });

  describe('generateBatchEmbeddings', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = [
        'First text about happiness',
        'Second text about sadness',
        'Third text about anger',
      ];

      const embeddings = await service.generateBatchEmbeddings(texts);

      expect(Array.isArray(embeddings)).toBe(true);
      expect(embeddings).toHaveLength(3);
      embeddings.forEach((emb) => {
        expect(emb).toHaveLength(768);
        expect(emb.every((v) => typeof v === 'number')).toBe(true);
      });
    });

    it('should throw on empty array', async () => {
      await expect(service.generateBatchEmbeddings([])).rejects.toThrow(
        'Texts array cannot be empty'
      );
    });

    it('should throw if any text is empty', async () => {
      const texts = ['valid text', '', 'another valid'];

      await expect(service.generateBatchEmbeddings(texts)).rejects.toThrow(
        'All texts must be non-empty'
      );
    });

    it('should preserve order of embeddings', async () => {
      const texts = ['emotion one', 'emotion two', 'emotion three'];

      const embeddings = await service.generateBatchEmbeddings(texts);

      // Generate individually to compare
      const individual = await Promise.all(
        texts.map((t) => service.generateEmbedding(t))
      );

      // Batch and individual should produce identical results
      embeddings.forEach((batch, i) => {
        expect(batch).toEqual(individual[i]);
      });
    });
  });

  describe('validateEmbedding', () => {
    it('should validate correct embedding', async () => {
      const embedding = await service.generateEmbedding('test');

      expect(service.validateEmbedding(embedding)).toBe(true);
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
    it('should calculate magnitude of normalized embedding', async () => {
      const embedding = await service.generateEmbedding('test');
      const magnitude = service.calculateMagnitude(embedding);

      expect(magnitude).toBeCloseTo(1, 1);
    });

    it('should calculate magnitude of zero vector', () => {
      const zeroVector = new Array(768).fill(0);
      const magnitude = service.calculateMagnitude(zeroVector);

      expect(magnitude).toBe(0);
    });

    it('should calculate magnitude of unit vector', () => {
      const unitVector = new Array(768).fill(0);
      unitVector[0] = 1; // One element is 1, rest are 0

      const magnitude = service.calculateMagnitude(unitVector);
      expect(magnitude).toBe(1);
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical embeddings', async () => {
      const embedding = await service.generateEmbedding('test text');
      const similarity = service.cosineSimilarity(embedding, embedding);

      expect(similarity).toBeCloseTo(1, 2);
    });

    it('should handle different embeddings', async () => {
      const text1 = 'happy and excited';
      const text2 = 'sad and depressed';

      const embedding1 = await service.generateEmbedding(text1);
      const embedding2 = await service.generateEmbedding(text2);

      const similarity = service.cosineSimilarity(embedding1, embedding2);

      // Should be between -1 and 1
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should throw on dimension mismatch', async () => {
      const embedding1 = await service.generateEmbedding('test');
      const embedding2 = new Array(512).fill(0.1);

      expect(() =>
        service.cosineSimilarity(embedding1, embedding2)
      ).toThrow('Embeddings must have same dimensions');
    });

    it('should be commutative', async () => {
      const text1 = 'first text';
      const text2 = 'second text';

      const embedding1 = await service.generateEmbedding(text1);
      const embedding2 = await service.generateEmbedding(text2);

      const sim12 = service.cosineSimilarity(embedding1, embedding2);
      const sim21 = service.cosineSimilarity(embedding2, embedding1);

      expect(sim12).toBe(sim21);
    });

    it('should return 0 for orthogonal vectors', () => {
      const orthogonal1 = new Array(768).fill(0);
      const orthogonal2 = new Array(768).fill(0);

      // Make them orthogonal: first half positive, second half negative
      for (let i = 0; i < 384; i++) {
        orthogonal1[i] = 0.1;
        orthogonal2[i + 384] = 0.1;
      }

      const similarity = service.cosineSimilarity(orthogonal1, orthogonal2);
      expect(similarity).toBeCloseTo(0, 1);
    });
  });
});

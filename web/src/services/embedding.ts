import { GoogleGenerativeAI } from '@google/generative-ai';

export class EmbeddingService {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Generate a 768-dimensional embedding for a single text
   * Uses Google's embedding-001 model (normalized vectors)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Text input cannot be empty');
      }

      const model = this.client.getGenerativeModel({
        model: 'embedding-001',
      });

      const result = await model.embedContent(text);

      // Gemini returns normalized embeddings (768-dimensional)
      const embedding = result.embedding.values;

      if (!embedding || embedding.length !== 768) {
        throw new Error(
          `Expected 768-dimensional embedding, got ${embedding?.length}`
        );
      }

      // Validate all values are numbers
      if (!embedding.every((v) => typeof v === 'number' && !isNaN(v))) {
        throw new Error('Embedding contains non-numeric or NaN values');
      }

      return embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts efficiently
   * Gemini batches these internally for better performance
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      if (!Array.isArray(texts) || texts.length === 0) {
        throw new Error('Texts array cannot be empty');
      }

      if (texts.some((t) => !t || t.trim().length === 0)) {
        throw new Error('All texts must be non-empty');
      }

      const model = this.client.getGenerativeModel({
        model: 'embedding-001',
      });

      // Gemini API requires batch embedding through batchEmbedContents
      const requests = texts.map((text) => ({
        content: { role: 'user', parts: [{ text }] },
      }));

      const result = await model.batchEmbedContents({
        requests,
      });

      // Validate each embedding
      const embeddings = result.embeddings.map((emb: any) => {
        if (!emb.values || emb.values.length !== 768) {
          throw new Error(
            `Expected 768-dimensional embedding, got ${emb.values?.length}`
          );
        }
        return emb.values;
      });

      return embeddings;
    } catch (error) {
      console.error('Failed to generate batch embeddings:', error);
      throw error;
    }
  }

  /**
   * Verify embedding is valid 768-dimensional vector
   * Useful for validation after retrieval from storage
   */
  validateEmbedding(embedding: unknown): embedding is number[] {
    return (
      Array.isArray(embedding) &&
      embedding.length === 768 &&
      embedding.every((v) => typeof v === 'number' && !isNaN(v))
    );
  }

  /**
   * Calculate the magnitude of an embedding vector
   * For normalized embeddings, should be ~1.0
   */
  calculateMagnitude(embedding: number[]): number {
    const sumOfSquares = embedding.reduce((sum, v) => sum + v * v, 0);
    return Math.sqrt(sumOfSquares);
  }

  /**
   * Calculate cosine similarity between two embeddings
   * Returns -1 to 1, where 1 is identical
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have same dimensions');
    }

    const dotProduct = embedding1.reduce((sum, a, i) => sum + a * embedding2[i], 0);
    const mag1 = this.calculateMagnitude(embedding1);
    const mag2 = this.calculateMagnitude(embedding2);

    if (mag1 === 0 || mag2 === 0) {
      return 0;
    }

    return dotProduct / (mag1 * mag2);
  }
}

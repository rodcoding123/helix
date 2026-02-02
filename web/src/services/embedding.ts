/**
 * Browser-compatible embedding service
 * Calls /api/embedding endpoint instead of using Gemini API directly
 */
export class EmbeddingService {
  /**
   * Generate a 768-dimensional embedding for a single text
   * Uses API endpoint that calls Google's embedding-001 model
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Text input cannot be empty');
      }

      const response = await fetch('/api/embedding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `Embedding API error: ${response.status} - ${error}`
        );
      }

      const data = await response.json() as { embedding: number[] };
      const embedding = data.embedding;

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
   * Calls API endpoint for batch embedding
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      if (!Array.isArray(texts) || texts.length === 0) {
        throw new Error('Texts array cannot be empty');
      }

      if (texts.some((t) => !t || t.trim().length === 0)) {
        throw new Error('All texts must be non-empty');
      }

      const response = await fetch('/api/embedding/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ texts }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `Batch embedding API error: ${response.status} - ${error}`
        );
      }

      const data = await response.json() as { embeddings: number[][] };
      const embeddings = data.embeddings;

      // Validate each embedding
      if (!Array.isArray(embeddings)) {
        throw new Error('Expected embeddings array in response');
      }

      embeddings.forEach((emb, i) => {
        if (!emb || emb.length !== 768) {
          throw new Error(
            `Expected 768-dimensional embedding, got ${emb?.length} at index ${i}`
          );
        }
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

export class EmbeddingService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // TODO: Implement Gemini embedding call
    throw new Error('Not implemented');
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    // TODO: Implement batch embeddings
    throw new Error('Not implemented');
  }
}

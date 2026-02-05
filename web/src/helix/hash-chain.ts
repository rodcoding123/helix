/**
 * Helix Hash Chain Stub for Web Project
 * Provides a stub implementation for web builds where hash chain operations
 * are handled server-side through Supabase edge functions
 */

interface HashChainEntry {
  type: string;
  [key: string]: unknown;
}

interface HashChainResult {
  hash: string;
  index: number;
}

/**
 * Hash chain singleton stub for web environment
 * Actual hash chain operations happen server-side
 */
export const hashChain = {
  /**
   * Add entry to hash chain (stub for web)
   * In production, this would call a Supabase edge function
   */
  async add(_entry: HashChainEntry): Promise<HashChainResult> {
    return {
      hash: `web-stub-${Date.now()}`,
      index: 0,
    };
  },
};

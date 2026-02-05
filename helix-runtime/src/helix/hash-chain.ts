/**
 * Hash Chain Type Stubs
 * These are type stubs for cross-project imports
 * In helix-runtime, these are no-op implementations
 */

export const hashChain = {
  async add(_entry: Record<string, unknown>): Promise<void> {
    // No-op in helix-runtime context (type stub)
  },
};

export async function logSecretOperation(_entry: Record<string, unknown>): Promise<void> {
  // No-op in helix-runtime context (type stub)
}

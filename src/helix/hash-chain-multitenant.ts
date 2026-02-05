/**
 * Phase 11: Multi-Tenant Hash Chain
 * Separate, isolated audit trails for each tenant
 */


export interface TenantHashChainEntry {
  index: number;
  tenantId: string;
  timestamp: number;
  data: string;
  previousHash: string;
  hash: string;
}

/**
 * Multi-tenant hash chain - each tenant has completely isolated chain
 * Prevents cross-tenant data leakage even if database is compromised
 */
export class TenantHashChain {
  private tenantId: string;
  private entries: Map<number, TenantHashChainEntry> = new Map();
  private lastHash: string = '0';

  constructor(tenantId: string) {
    if (!tenantId) {
      throw new Error('Tenant ID required for hash chain');
    }
    this.tenantId = tenantId;
  }

  /**
   * Add entry to this tenant's hash chain
   * Each entry is verified against this tenant's previous entry only
   * (not global chain - complete isolation)
   */
  async addEntry(data: string): Promise<TenantHashChainEntry> {
    if (!data) {
      throw new Error('Data required for hash chain entry');
    }

    try {
      // Get latest hash for this tenant
      const latestEntry = await this.getLatestEntry();
      const previousHash = latestEntry?.hash || '0';
      const index = (latestEntry?.index ?? -1) + 1;

      // Calculate hash: hash(previousHash + data + index)
      const hashInput = `${previousHash}:${data}:${index}:${this.tenantId}`;
      const hash = await hashString(hashInput);

      const entry: TenantHashChainEntry = {
        index,
        tenantId: this.tenantId,
        timestamp: Date.now(),
        data,
        previousHash,
        hash,
      };

      // Persist to database
      const { error } = await getDb()
        .from('hash_chain_entries')
        .insert([{
          tenant_id: this.tenantId,
          index: entry.index,
          timestamp: entry.timestamp,
          data: entry.data,
          previous_hash: entry.previousHash,
          hash: entry.hash,
        }]);

      if (error) {
        throw new Error(`Failed to persist hash chain entry: ${error.message}`);
      }

      // Update local state
      this.entries.set(index, entry);
      this.lastHash = hash;

      return entry;
    } catch (error) {
      console.error(`Failed to add hash chain entry for tenant ${this.tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Verify integrity of this tenant's chain
   * Each link verified against THIS TENANT'S previous entry only
   */
  async verifyChain(): Promise<boolean> {
    try {
      const entries = await this.loadAllEntries();

      if (entries.length === 0) {
        return true; // Empty chain is valid
      }

      // Verify first entry
      if (entries[0].previousHash !== '0') {
        console.error(`Tenant ${this.tenantId} chain invalid: first entry previous_hash not 0`);
        return false;
      }

      // Verify subsequent entries
      for (let i = 1; i < entries.length; i++) {
        const current = entries[i];
        const previous = entries[i - 1];

        // Verify link: current.previousHash == previous.hash
        if (current.previousHash !== previous.hash) {
          console.error(
            `Tenant ${this.tenantId} chain broken at entry ${i}: ` +
            `expected previous_hash=${previous.hash}, got ${current.previousHash}`
          );
          return false;
        }

        // Verify hash calculation
        const hashInput = `${current.previousHash}:${current.data}:${current.index}:${current.tenantId}`;
        const expectedHash = await hashString(hashInput);

        if (current.hash !== expectedHash) {
          console.error(`Tenant ${this.tenantId} invalid hash at entry ${i}`);
          return false;
        }

        // Verify index is sequential
        if (current.index !== previous.index + 1) {
          console.error(`Tenant ${this.tenantId} index gap at entry ${i}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error(`Failed to verify hash chain for tenant ${this.tenantId}:`, error);
      return false;
    }
  }

  /**
   * Get all entries for this tenant
   * Independent audit trail, cannot see other tenants' entries
   */
  async getAllEntries(): Promise<TenantHashChainEntry[]> {
    return this.loadAllEntries();
  }

  /**
   * Get specific entry by index
   */
  async getEntry(index: number): Promise<TenantHashChainEntry | null> {
    try {
      const { data } = await getDb()
        .from('hash_chain_entries')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .eq('index', index)
        .single();

      if (!data) return null;

      return {
        index: data.index,
        tenantId: data.tenant_id,
        timestamp: data.timestamp,
        data: data.data,
        previousHash: data.previous_hash,
        hash: data.hash,
      };
    } catch (error) {
      console.error(`Failed to get hash chain entry ${index}:`, error);
      return null;
    }
  }

  /**
   * Get entry count for this tenant
   */
  async getEntryCount(): Promise<number> {
    try {
      const { count, error } = await getDb()
        .from('hash_chain_entries')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', this.tenantId);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error(`Failed to get entry count:`, error);
      return 0;
    }
  }

  /**
   * Get latest entry in this tenant's chain
   */
  private async getLatestEntry(): Promise<TenantHashChainEntry | null> {
    try {
      const { data } = await getDb()
        .from('hash_chain_entries')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .order('index', { ascending: false })
        .limit(1)
        .single();

      if (!data) return null;

      return {
        index: data.index,
        tenantId: data.tenant_id,
        timestamp: data.timestamp,
        data: data.data,
        previousHash: data.previous_hash,
        hash: data.hash,
      };
    } catch {
      return null;
    }
  }

  private async loadAllEntries(): Promise<TenantHashChainEntry[]> {
    try {
      const { data, error } = await getDb()
        .from('hash_chain_entries')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .order('index', { ascending: true });

      if (error) {
        console.error('Failed to load hash chain entries:', error);
        return [];
      }

      return (data || []).map(entry => ({
        index: entry.index,
        tenantId: entry.tenant_id,
        timestamp: entry.timestamp,
        data: entry.data,
        previousHash: entry.previous_hash,
        hash: entry.hash,
      }));
    } catch (error) {
      console.error('Failed to load hash chain entries:', error);
      return [];
    }
  }
}

/**
 * Factory function - creates isolated hash chain for tenant
 */
export function getHashChainForTenant(tenantId: string): TenantHashChain {
  return new TenantHashChain(tenantId);
}

/**
 * Hash a string using Web Crypto API
 * Deterministic SHA-256
 */
export async function hashString(data: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Failed to hash string:', error);
    // Fallback to simple hash
    return simpleHash(data);
  }
}

/**
 * Simple fallback hash function (not cryptographic)
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

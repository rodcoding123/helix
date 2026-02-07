/**
 * Channel Configuration Export/Import
 *
 * Backup and restore channel configurations including policies,
 * filters, accounts, and features.
 */

import type { ChannelConfigExport } from '../monitoring/types.js';

export class ChannelConfigManager {
  /**
   * Export channel configuration
   */
  exportConfig(
    channel: string,
    data: {
      policies?: unknown;
      filters?: unknown;
      accounts?: unknown;
      features?: unknown;
      metadata?: Record<string, unknown>;
    }
  ): ChannelConfigExport {
    return {
      version: '1.0.0',
      exportedAt: Date.now(),
      channel,
      policies: data.policies,
      filters: data.filters,
      accounts: data.accounts,
      features: data.features,
      metadata: data.metadata || {},
    };
  }

  /**
   * Export to JSON string
   */
  exportToJson(config: ChannelConfigExport): string {
    return JSON.stringify(config, null, 2);
  }

  /**
   * Export to base64 (for sharing)
   */
  exportToBase64(config: ChannelConfigExport): string {
    const json = this.exportToJson(config);
    return Buffer.from(json).toString('base64');
  }

  /**
   * Import from JSON string
   */
  importFromJson(jsonString: string): ChannelConfigExport {
    try {
      const parsed = JSON.parse(jsonString);

      // Validate version
      if (!parsed.version) {
        throw new Error('Missing version field');
      }

      if (!parsed.channel) {
        throw new Error('Missing channel field');
      }

      if (!parsed.exportedAt || typeof parsed.exportedAt !== 'number') {
        throw new Error('Invalid exportedAt timestamp');
      }

      return parsed as ChannelConfigExport;
    } catch (error) {
      throw new Error(`Failed to import config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Import from base64
   */
  importFromBase64(base64String: string): ChannelConfigExport {
    try {
      const json = Buffer.from(base64String, 'base64').toString('utf-8');
      return this.importFromJson(json);
    } catch (error) {
      throw new Error(`Failed to decode base64: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate config compatibility
   */
  validateCompatibility(
    config: ChannelConfigExport,
    currentChannel: string
  ): { compatible: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.channel !== currentChannel) {
      errors.push(`Channel mismatch: export is for ${config.channel}, target is ${currentChannel}`);
    }

    if (!config.version.startsWith('1.')) {
      errors.push(
        `Version mismatch: export is version ${config.version}, expected 1.x`
      );
    }

    // Check for future version (warn but don't error)
    const [major, minor] = config.version.split('.').map(Number);
    if (major > 1 || (major === 1 && minor > 0)) {
      errors.push(
        `Future version: export is version ${config.version}, may have incompatible fields`
      );
    }

    return {
      compatible: errors.length === 0,
      errors,
    };
  }

  /**
   * Merge configurations (import into existing)
   */
  mergeConfig(
    existing: ChannelConfigExport,
    imported: ChannelConfigExport,
    strategy: 'replace' | 'merge' | 'skip' = 'merge'
  ): ChannelConfigExport {
    if (strategy === 'replace') {
      return imported;
    }

    if (strategy === 'skip') {
      return existing;
    }

    // Merge strategy
    return {
      ...existing,
      version: imported.version,
      exportedAt: imported.exportedAt,
      policies: imported.policies || existing.policies,
      filters: imported.filters || existing.filters,
      accounts: imported.accounts || existing.accounts,
      features: imported.features || existing.features,
      metadata: {
        ...existing.metadata,
        ...imported.metadata,
        lastMerged: Date.now(),
        mergedFrom: imported.exportedAt,
      },
    };
  }

  /**
   * Calculate config checksum
   */
  calculateChecksum(config: ChannelConfigExport): string {
    // Simple checksum: count total config items
    const count =
      (Array.isArray(config.policies) ? config.policies.length : 0) +
      (Array.isArray(config.filters) ? config.filters.length : 0) +
      (Array.isArray(config.accounts) ? config.accounts.length : 0) +
      (Array.isArray(config.features) ? config.features.length : 0) +
      (config.metadata ? Object.keys(config.metadata).length : 0);

    return `${config.channel}:${config.exportedAt}:${count}`;
  }

  /**
   * Compare two configs
   */
  compareConfigs(
    config1: ChannelConfigExport,
    config2: ChannelConfigExport
  ): {
    identical: boolean;
    differences: string[];
  } {
    const differences: string[] = [];

    if (config1.channel !== config2.channel) {
      differences.push('Different channels');
    }

    if (JSON.stringify(config1.policies) !== JSON.stringify(config2.policies)) {
      differences.push('Policies differ');
    }

    if (JSON.stringify(config1.filters) !== JSON.stringify(config2.filters)) {
      differences.push('Filters differ');
    }

    if (JSON.stringify(config1.accounts) !== JSON.stringify(config2.accounts)) {
      differences.push('Accounts differ');
    }

    if (JSON.stringify(config1.features) !== JSON.stringify(config2.features)) {
      differences.push('Features differ');
    }

    return {
      identical: differences.length === 0,
      differences,
    };
  }

  /**
   * Create restore point (snapshot)
   */
  createRestorePoint(config: ChannelConfigExport): ChannelConfigExport {
    return {
      ...config,
      metadata: {
        ...config.metadata,
        restorePointCreatedAt: Date.now(),
        restorePointId: `rp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
    };
  }

  /**
   * Get config diff summary
   */
  getDiffSummary(
    before: ChannelConfigExport,
    after: ChannelConfigExport
  ): {
    added: number;
    removed: number;
    modified: number;
    summary: string;
  } {
    let added = 0;
    let removed = 0;
    let modified = 0;

    // This is a simple implementation
    // A real implementation would do deep object comparison
    const comparison = this.compareConfigs(before, after);

    if (!comparison.identical) {
      modified = comparison.differences.length;
    }

    return {
      added,
      removed,
      modified,
      summary: `${modified} sections modified, last updated at ${new Date(after.exportedAt).toISOString()}`,
    };
  }
}

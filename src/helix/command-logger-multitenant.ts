/**
 * Phase 11: Per-Tenant Discord Logging
 * Each tenant has isolated webhook and audit trail
 */

import { getHashChainForTenant } from './hash-chain-multitenant.js';

/**
 * Supabase-like database client interface
 */
interface DbQueryResult<T = Record<string, unknown>> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

interface DbQueryBuilder<T = Record<string, unknown>> {
  select(columns: string): DbQueryBuilder<T>;
  eq(column: string, value: string | number): DbQueryBuilder<T>;
  single(): Promise<DbQueryResult<T>>;
}

interface DbClient {
  from(table: string): DbQueryBuilder;
}

/**
 * Database client factory - can be mocked in tests
 */
let dbClient: DbClient | null = null;

export function setDbClient(client: DbClient): void {
  dbClient = client;
}

export function getDb(): DbClient {
  if (!dbClient) {
    throw new Error('Database client not initialized');
  }
  return dbClient;
}

/**
 * Tenant-specific Discord logging
 * Completely isolated per tenant - cannot access other tenants' webhooks
 */
/**
 * Command execution result
 */
interface CommandResult {
  error?: string;
  output?: string;
  exitCode?: number;
}

/**
 * Discord webhook log payload
 */
interface LogPayload {
  type: string;
  content: string;
  tenantId: string;
  timestamp: number;
  status: string;
  metadata: Record<string, unknown>;
}

export class TenantDiscordLogger {
  private tenantId: string;
  private webhookUrl: string | null = null;
  private initialized = false;

  constructor(tenantId: string) {
    if (!tenantId) {
      throw new Error('Tenant ID required for Discord logger');
    }
    this.tenantId = tenantId;
  }

  /**
   * Initialize webhook URL for this tenant
   * Loads from database, scoped to current tenant
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const { data, error } = await getDb()
        .from('tenants')
        .select('webhook_url')
        .eq('id', this.tenantId)
        .single();

      if (error) {
        console.error(`Failed to load webhook for tenant ${this.tenantId}:`, error);
        return; // Graceful fallback
      }

      if (!data?.webhook_url) {
        console.warn(`No Discord webhook configured for tenant ${this.tenantId}`);
        return;
      }

      this.webhookUrl = data.webhook_url as string;
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Discord logger:', error);
      // Don't throw - app can continue without Discord logging
    }
  }

  /**
   * Log message to tenant's Discord channel
   * Includes tenant ID in all messages for audit trail
   */
  async log(message: {
    type: string;
    content: string;
    timestamp?: number;
    status?: 'pending' | 'completed' | 'failed';
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!this.webhookUrl) {
        console.warn(`Cannot log to Discord: no webhook for tenant ${this.tenantId}`);
        return;
      }

      // Create isolated log entry for this tenant
      const payload = {
        type: message.type,
        content: message.content,
        tenantId: this.tenantId,
        timestamp: message.timestamp || Date.now(),
        status: message.status || 'completed',
        metadata: message.metadata || {},
      };

      // Send to tenant's webhook (not global webhook)
      await this.sendToWebhook(payload);

      // Also log to hash chain for immutable audit trail
      const hashChain = getHashChainForTenant(this.tenantId);
      await hashChain.add(JSON.stringify(payload));
    } catch (error) {
      console.error(`Failed to log for tenant ${this.tenantId}:`, error);
      // Don't throw - logging failure shouldn't break app
    }
  }

  /**
   * Log command execution
   */
  async logCommand(cmd: string, result?: CommandResult): Promise<void> {
    const status = result?.error ? 'failed' : 'completed';
    const metadata = result ? { result } : undefined;

    await this.log({
      type: 'command',
      content: cmd,
      status,
      metadata,
    });
  }

  /**
   * Log API call
   */
  async logAPI(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number
  ): Promise<void> {
    const status = statusCode < 400 ? 'completed' : 'failed';

    await this.log({
      type: 'api',
      content: `${method} ${path}`,
      status,
      metadata: { status_code: statusCode, duration_ms: durationMs },
    });
  }

  /**
   * Log operation execution
   */
  async logOperation(
    operationId: string,
    operationType: string,
    success: boolean,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const status = success ? 'completed' : 'failed';

    await this.log({
      type: 'operation',
      content: `${operationType} (${operationId})`,
      status,
      metadata: {
        operation_id: operationId,
        operation_type: operationType,
        ...metadata,
      },
    });
  }

  /**
   * Send webhook payload to Discord
   * Uses tenant's isolated webhook URL
   */
  private async sendToWebhook(payload: LogPayload): Promise<void> {
    if (!this.webhookUrl) {
      throw new Error('Webhook URL not initialized');
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [this.formatEmbedFromPayload(payload)],
        }),
      });

      if (!response.ok) {
        console.error(`Discord webhook failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send Discord webhook:', error);
      throw error;
    }
  }

  /**
   * Format payload as Discord embed
   */
  private formatEmbedFromPayload(payload: LogPayload): Record<string, unknown> {
    const colors: Record<string, number> = {
      completed: 0x00ff00, // Green
      failed: 0xff0000, // Red
      pending: 0xffff00, // Yellow
    };

    return {
      title: `[${payload.tenantId}] ${payload.type}`,
      description: payload.content,
      timestamp: new Date(payload.timestamp).toISOString(),
      color: colors[payload.status] || 0x0099ff,
      fields: [
        {
          name: 'Status',
          value: payload.status,
          inline: true,
        },
        {
          name: 'Tenant',
          value: payload.tenantId,
          inline: true,
        },
        ...(payload.metadata && Object.keys(payload.metadata).length > 0
          ? [
              {
                name: 'Details',
                value: `\`\`\`json\n${JSON.stringify(payload.metadata, null, 2)}\n\`\`\``,
                inline: false,
              },
            ]
          : []),
      ],
    };
  }

  /**
   * Verify webhook is accessible
   */
  async verify(): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!this.webhookUrl) {
        return false;
      }

      // Test webhook with empty message
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: 'Webhook Verification',
              description: 'Testing Discord webhook connectivity',
              color: 0x0099ff,
            },
          ],
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Webhook verification failed:', error);
      return false;
    }
  }

  /**
   * Get webhook status
   */
  async getStatus(): Promise<{
    initialized: boolean;
    webhookUrl: string | null;
    verified: boolean;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    const verified = this.webhookUrl ? await this.verify() : false;

    return {
      initialized: this.initialized,
      webhookUrl: this.webhookUrl,
      verified,
    };
  }
}

/**
 * Factory function - creates logger for tenant
 */
export function getDiscordLoggerForTenant(tenantId: string): TenantDiscordLogger {
  return new TenantDiscordLogger(tenantId);
}

/**
 * Global logger for non-tenant-specific events
 * Use sparingly - prefer per-tenant logging
 */
export class GlobalDiscordLogger {
  private webhookUrl: string | null = null;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || null;
  }

  initialize(webhookUrl: string): void {
    this.webhookUrl = webhookUrl;
  }

  async log(message: {
    type: string;
    content: string;
    status?: 'pending' | 'completed' | 'failed';
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.webhookUrl) {
      console.warn('Global Discord logger not initialized');
      return;
    }

    try {
      const colors: Record<string, number> = {
        completed: 0x00ff00,
        failed: 0xff0000,
        pending: 0xffff00,
      };

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: `[GLOBAL] ${message.type}`,
              description: message.content,
              timestamp: new Date().toISOString(),
              color: colors[message.status || 'completed'] || 0x0099ff,
              fields: message.metadata
                ? [
                    {
                      name: 'Metadata',
                      value: `\`\`\`json\n${JSON.stringify(message.metadata, null, 2)}\n\`\`\``,
                    },
                  ]
                : [],
            },
          ],
        }),
      });

      if (!response.ok) {
        console.error(`Global Discord webhook failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send global Discord message:', error);
    }
  }
}

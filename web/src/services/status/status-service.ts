/**
 * Phase 10 Week 5: Status Page Service
 * Provides real-time system status and incident history
 */

interface ComponentStatus {
  status: 'operational' | 'degraded' | 'down';
  latency?: number;
  lastChecked?: number;
}

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  startedAt: string;
  resolvedAt?: string;
  affectedComponents: string[];
  impact: 'none' | 'partial' | 'major';
}

export interface SystemStatus {
  overall: 'operational' | 'degraded' | 'major_outage';
  lastUpdated: string;
  components: {
    api_gateway: ComponentStatus;
    database: ComponentStatus;
    webhooks: ComponentStatus;
    background_jobs: ComponentStatus;
    rate_limiting: ComponentStatus;
  };
  uptime_90d: number;
  incidents: Incident[];
  statusPageUrl: string;
}

const COMPONENT_HEALTH_ENDPOINTS: Record<string, string> = {
  api_gateway: '/api/health',
  database: '/api/health/db',
  webhooks: '/api/health/webhooks',
  background_jobs: '/api/health/jobs',
  rate_limiting: '/api/health/rate-limit',
};

const COMPONENT_DISPLAY_NAMES: Record<string, string> = {
  api_gateway: 'API Gateway',
  database: 'Database',
  webhooks: 'Webhook Service',
  background_jobs: 'Background Jobs',
  rate_limiting: 'Rate Limiting',
};

export class StatusService {
  private lastStatus: SystemStatus | null = null;
  private lastStatusUpdate: number = 0;
  private statusCacheDuration = 30000; // 30 seconds

  /**
   * Get current system status (cached)
   */
  async getStatus(): Promise<SystemStatus> {
    const now = Date.now();

    // Return cached status if fresh
    if (this.lastStatus && now - this.lastStatusUpdate < this.statusCacheDuration) {
      return this.lastStatus;
    }

    const [apiStatus, dbStatus, webhookStatus, jobsStatus, rateLimitStatus] = await Promise.all([
      this.checkComponent('api_gateway'),
      this.checkComponent('database'),
      this.checkComponent('webhooks'),
      this.checkComponent('background_jobs'),
      this.checkComponent('rate_limiting'),
    ]);

    const components = {
      api_gateway: apiStatus,
      database: dbStatus,
      webhooks: webhookStatus,
      background_jobs: jobsStatus,
      rate_limiting: rateLimitStatus,
    };

    const overall = this.calculateOverallStatus(components);
    const uptime = await this.calculate90DayUptime();
    const incidents = await this.getRecentIncidents(90);

    this.lastStatus = {
      overall,
      lastUpdated: new Date().toISOString(),
      components,
      uptime_90d: uptime,
      incidents,
      statusPageUrl: '/status',
    };

    this.lastStatusUpdate = now;
    return this.lastStatus;
  }

  /**
   * Check individual component health
   */
  private async checkComponent(componentKey: string): Promise<ComponentStatus> {
    const endpoint = COMPONENT_HEALTH_ENDPOINTS[componentKey];

    try {
      const startTime = performance.now();
      const response = await fetch(endpoint, {
        method: 'GET',
        timeout: 5000,
      });
      const latency = Math.round(performance.now() - startTime);

      if (!response.ok) {
        return {
          status: 'degraded',
          latency,
          lastChecked: Date.now(),
        };
      }

      const data = (await response.json()) as any;

      // Check if latency is within acceptable range
      if (latency > 2000) {
        return {
          status: 'degraded',
          latency,
          lastChecked: Date.now(),
        };
      }

      return {
        status: data.status || 'operational',
        latency,
        lastChecked: Date.now(),
      };
    } catch (error) {
      console.error(`[StatusService] Error checking ${componentKey}:`, error);
      return {
        status: 'down',
        latency: 0,
        lastChecked: Date.now(),
      };
    }
  }

  /**
   * Calculate overall system status
   */
  private calculateOverallStatus(components: Record<string, ComponentStatus>): 'operational' | 'degraded' | 'major_outage' {
    const componentValues = Object.values(components);

    // If any critical component is down, system is down
    const criticalComponents = ['api_gateway', 'database'];
    for (const critical of criticalComponents) {
      if (components[critical]?.status === 'down') {
        return 'major_outage';
      }
    }

    // If 2+ components degraded, system is degraded
    const degradedCount = componentValues.filter((c) => c.status === 'degraded').length;
    if (degradedCount >= 2) {
      return 'degraded';
    }

    // If any component is degraded, system is degraded
    if (degradedCount > 0) {
      return 'degraded';
    }

    return 'operational';
  }

  /**
   * Calculate 90-day uptime percentage
   */
  private async calculate90DayUptime(): Promise<number> {
    try {
      // In production, fetch from database
      // For now, return a mock value
      const randomVariation = Math.random() * 0.1; // 0-0.1% variance
      return 99.95 - randomVariation;
    } catch (error) {
      console.error('[StatusService] Error calculating uptime:', error);
      return 99.9;
    }
  }

  /**
   * Get recent incidents
   */
  private async getRecentIncidents(days: number): Promise<Incident[]> {
    try {
      // In production, fetch from database
      // For now, return mock incidents
      const now = Date.now();
      const pastDate = now - days * 24 * 60 * 60 * 1000;

      const mockIncidents: Incident[] = [
        {
          id: 'incident-001',
          title: 'Brief database maintenance',
          description: 'Scheduled maintenance completed successfully',
          severity: 'info',
          startedAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
          resolvedAt: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(),
          affectedComponents: ['database'],
          impact: 'partial',
        },
        {
          id: 'incident-002',
          title: 'Rate limiting adjustment',
          description: 'Updated rate limiting configuration for improved throughput',
          severity: 'info',
          startedAt: new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString(),
          resolvedAt: new Date(now - 15 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
          affectedComponents: ['rate_limiting'],
          impact: 'none',
        },
      ];

      return mockIncidents.filter((i) => new Date(i.startedAt).getTime() > pastDate);
    } catch (error) {
      console.error('[StatusService] Error fetching incidents:', error);
      return [];
    }
  }

  /**
   * Get uptime status for last 30 days with daily breakdown
   */
  async getMonthlyUptime(): Promise<
    Array<{
      date: string;
      uptime: number;
      incidents: number;
    }>
  > {
    const result = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Mock daily uptime (99.5-99.99%)
      const uptime = 99.5 + Math.random() * 0.49;
      const incidents = Math.random() > 0.9 ? 1 : 0;

      result.push({
        date: dateStr,
        uptime: Math.round(uptime * 100) / 100,
        incidents,
      });
    }

    return result;
  }

  /**
   * Subscribe to status updates
   */
  subscribeToUpdates(callback: (status: SystemStatus) => void): () => void {
    const intervalId = setInterval(async () => {
      const status = await this.getStatus();
      callback(status);
    }, 30000); // Update every 30 seconds

    // Call immediately
    this.getStatus().then(callback).catch(console.error);

    // Return unsubscribe function
    return () => clearInterval(intervalId);
  }

  /**
   * Get status history for incident timeline
   */
  async getStatusHistory(days: number = 90): Promise<
    Array<{
      timestamp: string;
      status: 'operational' | 'degraded' | 'major_outage';
    }>
  > {
    // In production, fetch from database
    // For now, return mock history
    const history = [];
    const now = Date.now();

    for (let i = 0; i < days; i++) {
      const timestamp = new Date(now - i * 24 * 60 * 60 * 1000).toISOString();
      const status = Math.random() > 0.95 ? 'degraded' : 'operational';

      history.push({
        timestamp,
        status: status as 'operational' | 'degraded' | 'major_outage',
      });
    }

    return history.reverse();
  }
}

// Singleton instance
let statusService: StatusService | null = null;

export function getStatusService(): StatusService {
  if (!statusService) {
    statusService = new StatusService();
  }
  return statusService;
}

/**
 * Phase 10 Week 5: Public Status Page Service
 */

import { getDb } from '@/lib/supabase';

export type ComponentStatusType = 'operational' | 'degraded' | 'down';

export interface ComponentStatus {
  status: ComponentStatusType;
  latency?: number;
  lastChecked?: string;
}

export interface Incident {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical';
  startTime: string;
  endTime?: string;
  description: string;
  affectedComponents: string[];
}

export interface SystemStatus {
  overall: 'operational' | 'degraded' | 'major_outage';
  components: {
    api_gateway: ComponentStatus;
    database: ComponentStatus;
    webhooks: ComponentStatus;
    background_jobs: ComponentStatus;
  };
  uptime_90d: number;
  incidents: Incident[];
  lastUpdated: string;
}

export class StatusService {
  async getStatus(): Promise<SystemStatus> {
    try {
      const [apiStatus, dbStatus, webhookStatus, jobsStatus, incidents, uptime] = await Promise.all([
        this.checkAPIGateway(),
        this.checkDatabase(),
        this.checkWebhooks(),
        this.checkBackgroundJobs(),
        this.getRecentIncidents(30),
        this.calculate90DayUptime(),
      ]);

      const overall = this.calculateOverallStatus([apiStatus, dbStatus, webhookStatus, jobsStatus]);

      return {
        overall,
        components: {
          api_gateway: apiStatus,
          database: dbStatus,
          webhooks: webhookStatus,
          background_jobs: jobsStatus,
        },
        uptime_90d: uptime,
        incidents,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[StatusService] Failed to get status:', error);
      return {
        overall: 'degraded',
        components: {
          api_gateway: { status: 'degraded' },
          database: { status: 'degraded' },
          webhooks: { status: 'degraded' },
          background_jobs: { status: 'degraded' },
        },
        uptime_90d: 0,
        incidents: [],
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  private async checkAPIGateway(): Promise<ComponentStatus> {
    try {
      const startTime = Date.now();
      const response = await fetch('/api/health', { method: 'GET' });
      const latency = Date.now() - startTime;

      if (response.ok && latency < 1000) {
        return {
          status: 'operational',
          latency,
          lastChecked: new Date().toISOString(),
        };
      }

      return {
        status: 'degraded',
        latency,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'down',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private async checkDatabase(): Promise<ComponentStatus> {
    try {
      const startTime = Date.now();
      const data = await getDb().from('heartbeats').select('count');
      const latency = Date.now() - startTime;

      if (latency < 500) {
        return {
          status: 'operational',
          latency,
          lastChecked: new Date().toISOString(),
        };
      }

      return {
        status: 'degraded',
        latency,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'down',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private async checkWebhooks(): Promise<ComponentStatus> {
    try {
      const data = await getDb()
        .from('webhook_events')
        .select('*')
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .limit(100);

      if (!data) {
        return { status: 'degraded' };
      }

      return {
        status: 'operational',
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'degraded',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private async checkBackgroundJobs(): Promise<ComponentStatus> {
    try {
      const data = await getDb()
        .from('schedule_executions')
        .select('*')
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .limit(50);

      if (!data) {
        return { status: 'degraded' };
      }

      return {
        status: 'operational',
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'degraded',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private async calculate90DayUptime(): Promise<number> {
    try {
      const data = await getDb()
        .from('heartbeats')
        .select('*')
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

      if (!data) {
        return 99.99;
      }

      const expectedBeats = 90 * 24 * 60;
      const actualBeats = data.length;

      return Math.min(100, (actualBeats / expectedBeats) * 100);
    } catch (error) {
      console.error('[StatusService] Failed to calculate uptime:', error);
      return 99.99;
    }
  }

  private async getRecentIncidents(days: number): Promise<Incident[]> {
    try {
      const data = await getDb()
        .from('incidents')
        .select('*')
        .gte('start_time', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('start_time', { ascending: false });

      if (!data) {
        return [];
      }

      return data as Incident[];
    } catch (error) {
      console.error('[StatusService] Failed to get incidents:', error);
      return [];
    }
  }

  private calculateOverallStatus(componentStatuses: ComponentStatus[]): 'operational' | 'degraded' | 'major_outage' {
    const statuses = componentStatuses.map(c => c.status);

    if (statuses.includes('down')) {
      return 'major_outage';
    }

    if (statuses.includes('degraded')) {
      return 'degraded';
    }

    return 'operational';
  }
}

let statusService: StatusService | null = null;

export function getStatusService(): StatusService {
  if (!statusService) {
    statusService = new StatusService();
  }
  return statusService;
}

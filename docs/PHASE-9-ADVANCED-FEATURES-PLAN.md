# Phase 9: Advanced Features & Automation

**Date:** February 4, 2026
**Status:** Ready for Execution
**Duration:** Weeks 21-28 (8 weeks)
**Foundation:** Phase 8 (LLM-First Intelligence Layer - 9 operations registered in Phase 0.5)

---

## Executive Summary

Phase 9 extends Phase 8's LLM-First Intelligence Layer with production-grade advanced features:

**9A (Weeks 21-22):** Advanced Scheduling - Cron jobs, webhooks, recurring operations
**9B (Weeks 23-24):** Batch Operations - Multi-operation execution, rate limiting, cost optimization
**9C (Weeks 25-26):** Customization & Settings - Per-user model selection, operation preferences, UI theming
**9D (Weeks 27-28):** Advanced Analytics & Reporting - Dashboards, trends, cost optimization recommendations

**Integration:** All features integrate with Phase 0.5 unified AI Operations Control Plane
**Database:** Reuse existing Supabase schema with new tables for scheduling, batches, preferences
**APIs:** Gateway RPC extends with new methods for scheduling and batch execution
**UI:** React web, iOS SwiftUI, Android Jetpack Compose consistency

---

## PHASE 9A: ADVANCED SCHEDULING (Weeks 21-22)

### Week 21: Cron Scheduling Infrastructure

**Database Schema:**

```sql
-- web/supabase/migrations/045_phase9_scheduling.sql

CREATE TABLE operation_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL CHECK (operation_id IN (
    'email-compose', 'email-classify', 'email-respond',
    'calendar-prep', 'calendar-time',
    'task-prioritize', 'task-breakdown',
    'analytics-summary', 'analytics-anomaly'
  )),

  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('cron', 'webhook', 'manual')),
  cron_expression TEXT,
  webhook_url TEXT,

  enabled BOOLEAN DEFAULT TRUE,
  frequency TEXT,
  timezone TEXT DEFAULT 'UTC',

  parameters JSONB,
  max_cost_per_month DECIMAL(10, 2),

  last_execution_at TIMESTAMP,
  next_execution_at TIMESTAMP,
  execution_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_schedules_user_enabled ON operation_schedules(user_id, enabled);
CREATE INDEX idx_schedules_next_execution ON operation_schedules(next_execution_at) WHERE enabled = TRUE;

-- Execution history
CREATE TABLE schedule_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES operation_schedules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  execution_status TEXT CHECK (execution_status IN ('pending', 'running', 'success', 'failed')),
  result JSONB,
  error_message TEXT,

  cost_usd DECIMAL(10, 6),
  latency_ms INTEGER,

  triggered_by TEXT CHECK (triggered_by IN ('cron', 'webhook', 'manual')),

  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_executions_schedule ON schedule_executions(schedule_id);
CREATE INDEX idx_executions_user_status ON schedule_executions(user_id, execution_status);

-- Webhook event logs
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES operation_schedules(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL,
  payload JSONB,
  signature TEXT,

  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webhooks_schedule ON webhook_events(schedule_id);
```

**Cron Scheduler Service:**

```typescript
// web/src/services/scheduling/cron-scheduler.ts

import * as cronParser from 'cron-parser';
import { db } from '@/lib/supabase';
import { AIRouterClient } from '@/services/intelligence/router-client';

export interface ScheduleConfig {
  id: string;
  user_id: string;
  operation_id: string;
  cron_expression: string;
  timezone: string;
  parameters?: Record<string, any>;
  enabled: boolean;
}

export class CronScheduler {
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();
  private aiRouter = new AIRouterClient();

  async initializeSchedules(userId: string): Promise<void> {
    const schedules = await db
      .from('operation_schedules')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true);

    for (const schedule of schedules.data || []) {
      await this.scheduleJob(schedule);
    }
  }

  async scheduleJob(config: ScheduleConfig): Promise<void> {
    try {
      const interval = cronParser.parseExpression(config.cron_expression, {
        tz: config.timezone,
      });

      const nextRun = interval.next().toDate();
      const now = new Date();
      const delay = nextRun.getTime() - now.getTime();

      const jobId = `${config.user_id}-${config.id}`;

      // Set initial timer
      const timeout = setTimeout(
        async () => {
          await this.executeScheduledOperation(config);
          // Reschedule for next occurrence
          await this.scheduleJob(config);
        },
        Math.max(delay, 0)
      );

      this.scheduledJobs.set(jobId, timeout);

      // Update next_execution_at in database
      await db
        .from('operation_schedules')
        .update({ next_execution_at: nextRun })
        .eq('id', config.id);
    } catch (error) {
      console.error(`Failed to schedule job ${config.id}:`, error);
      await this.logScheduleError(config.id, error);
    }
  }

  private async executeScheduledOperation(config: ScheduleConfig): Promise<void> {
    const executionId = await this.createExecution(config.id, 'cron');

    try {
      await db
        .from('schedule_executions')
        .update({ execution_status: 'running' })
        .eq('id', executionId);

      // Execute operation via Phase 0.5 router
      const result = await this.aiRouter.execute(config.operation_id, {
        user_id: config.user_id,
        parameters: config.parameters || {},
      });

      // Log success
      await db
        .from('schedule_executions')
        .update({
          execution_status: 'success',
          result,
          completed_at: new Date().toISOString(),
        })
        .eq('id', executionId);

      // Update execution count
      await db.rpc('increment_schedule_execution_count', { schedule_id: config.id });
    } catch (error) {
      await db
        .from('schedule_executions')
        .update({
          execution_status: 'failed',
          error_message: error instanceof Error ? error.message : String(error),
          completed_at: new Date().toISOString(),
        })
        .eq('id', executionId);
    }
  }

  private async createExecution(scheduleId: string, triggeredBy: string): Promise<string> {
    const { data } = await db
      .from('schedule_executions')
      .insert({
        schedule_id: scheduleId,
        user_id: await this.getCurrentUserId(),
        execution_status: 'pending',
        triggered_by: triggeredBy,
      })
      .select('id')
      .single();

    return data?.id || '';
  }

  private async logScheduleError(scheduleId: string, error: any): Promise<void> {
    await db.from('schedule_executions').insert({
      schedule_id: scheduleId,
      execution_status: 'failed',
      error_message: error?.message || 'Unknown error',
      triggered_by: 'cron',
    });
  }

  cancelSchedule(jobId: string): void {
    const timeout = this.scheduledJobs.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledJobs.delete(jobId);
    }
  }

  async disableAllSchedules(userId: string): Promise<void> {
    await db.from('operation_schedules').update({ enabled: false }).eq('user_id', userId);

    const jobIds = Array.from(this.scheduledJobs.keys()).filter(id => id.startsWith(userId));

    jobIds.forEach(jobId => this.cancelSchedule(jobId));
  }
}
```

**Webhook Handler:**

```typescript
// web/supabase/edge-functions/webhook-handler.ts

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import * as crypto from 'https://deno.land/std@0.208.0/crypto/mod.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const computed = await crypto.subtle.sign('HMAC', key, data);
  const computedSignature = Array.from(new Uint8Array(computed))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return computedSignature === signature;
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const webhookId = new URL(req.url).searchParams.get('id');
    const signature = req.headers.get('X-Webhook-Signature') || '';
    const payload = await req.text();

    // Get webhook configuration
    const { data: schedule } = await supabase
      .from('operation_schedules')
      .select('*')
      .eq('id', webhookId)
      .eq('schedule_type', 'webhook')
      .single();

    if (!schedule) {
      return new Response('Webhook not found', { status: 404 });
    }

    // Verify signature (would need secret stored securely)
    const isValid = await verifyWebhookSignature(payload, signature, 'webhook-secret-here');
    if (!isValid) {
      return new Response('Invalid signature', { status: 401 });
    }

    // Log webhook event
    await supabase.from('webhook_events').insert({
      schedule_id: webhookId,
      event_type: 'webhook_received',
      payload: JSON.parse(payload),
      signature,
    });

    // Trigger operation execution
    const execution = await supabase.from('schedule_executions').insert({
      schedule_id: webhookId,
      user_id: schedule.user_id,
      execution_status: 'pending',
      triggered_by: 'webhook',
    });

    return new Response(JSON.stringify({ success: true, execution_id: execution.data?.[0]?.id }), {
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500 }
    );
  }
});
```

### Week 22: UI & Testing for Scheduling

**Web UI - Schedule Manager:**

```typescript
// web/src/pages/ScheduleManager.tsx

import { useState, useEffect } from 'react';
import { db } from '@/lib/supabase';
import { CronScheduler } from '@/services/scheduling/cron-scheduler';

export function ScheduleManager() {
  const [schedules, setSchedules] = useState([]);
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  useEffect(() => {
    loadSchedules();
  }, []);

  async function loadSchedules() {
    const { data } = await db
      .from('operation_schedules')
      .select('*')
      .eq('user_id', userId);

    setSchedules(data || []);
  }

  async function createSchedule(config: any) {
    const { data } = await db
      .from('operation_schedules')
      .insert({
        user_id: userId,
        ...config,
      });

    if (data) {
      const scheduler = new CronScheduler();
      await scheduler.scheduleJob(data[0]);
    }

    await loadSchedules();
    setShowNewSchedule(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Operation Schedules</h2>
        <button
          onClick={() => setShowNewSchedule(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          New Schedule
        </button>
      </div>

      <div className="grid gap-4">
        {schedules.map(schedule => (
          <ScheduleCard
            key={schedule.id}
            schedule={schedule}
            onSelect={() => setSelectedSchedule(schedule)}
          />
        ))}
      </div>

      {showNewSchedule && (
        <NewScheduleDialog
          operations={PHASE_8_OPERATIONS}
          onCreate={createSchedule}
          onCancel={() => setShowNewSchedule(false)}
        />
      )}

      {selectedSchedule && (
        <ScheduleDetailModal
          schedule={selectedSchedule}
          onClose={() => setSelectedSchedule(null)}
        />
      )}
    </div>
  );
}

function ScheduleCard({ schedule, onSelect }: any) {
  const nextRun = new Date(schedule.next_execution_at);

  return (
    <div
      onClick={onSelect}
      className="p-4 border rounded-lg hover:shadow-lg cursor-pointer transition"
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold">{schedule.operation_id}</h3>
          <p className="text-sm text-gray-600">{schedule.cron_expression}</p>
          <p className="text-xs text-gray-500 mt-2">
            Next run: {nextRun.toLocaleString()}
          </p>
        </div>
        <span
          className={`px-2 py-1 rounded text-xs font-semibold ${
            schedule.enabled
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {schedule.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      <div className="mt-3 text-xs text-gray-600">
        {schedule.execution_count} executions
        {schedule.last_execution_at && (
          <> • Last run: {new Date(schedule.last_execution_at).toLocaleString()}</>
        )}
      </div>
    </div>
  );
}
```

**Scheduling Tests:**

```typescript
// web/src/services/scheduling/cron-scheduler.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CronScheduler } from './cron-scheduler';

describe('CronScheduler', () => {
  let scheduler: CronScheduler;

  beforeEach(() => {
    scheduler = new CronScheduler();
  });

  afterEach(() => {
    scheduler.disableAllSchedules('test-user');
  });

  it('should schedule daily email summary at 6pm UTC', async () => {
    const config = {
      id: 'test-schedule-1',
      user_id: 'test-user',
      operation_id: 'analytics-summary',
      cron_expression: '0 18 * * *',
      timezone: 'UTC',
      parameters: { include_trends: true },
      enabled: true,
    };

    await scheduler.scheduleJob(config);

    // Verify next execution is calculated correctly
    const nextRun = new Date();
    nextRun.setUTCHours(18, 0, 0, 0);

    if (nextRun <= new Date()) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    expect(scheduler.getNextExecution('test-schedule-1')).toEqual(nextRun);
  });

  it('should execute operation and log results', async () => {
    const config = {
      id: 'test-schedule-2',
      user_id: 'test-user',
      operation_id: 'email-compose',
      cron_expression: '*/5 * * * *', // Every 5 minutes
      timezone: 'UTC',
      parameters: { draft: true },
      enabled: true,
    };

    await scheduler.scheduleJob(config);

    // Simulate execution
    const executionId = await scheduler.executeScheduledOperation(config);

    expect(executionId).toBeDefined();

    // Verify execution was logged
    const execution = await db
      .from('schedule_executions')
      .select('*')
      .eq('id', executionId)
      .single();

    expect(execution.data?.execution_status).toBe('success');
    expect(execution.data?.result).toBeDefined();
  });

  it('should handle timezone conversions', async () => {
    const config = {
      id: 'test-schedule-3',
      user_id: 'test-user',
      operation_id: 'calendar-prep',
      cron_expression: '0 9 * * *',
      timezone: 'America/New_York', // EST/EDT
      parameters: {},
      enabled: true,
    };

    await scheduler.scheduleJob(config);

    // Verify next execution accounts for timezone
    const nextRun = scheduler.getNextExecution('test-schedule-3');
    expect(nextRun).toBeDefined();
  });

  it('should handle webhook trigger events', async () => {
    const scheduleId = 'test-webhook-1';

    const event = {
      schedule_id: scheduleId,
      event_type: 'webhook_received',
      payload: { trigger: 'external' },
    };

    await db.from('webhook_events').insert(event);

    const execution = await scheduler.executeScheduledOperation({
      id: scheduleId,
      user_id: 'test-user',
      operation_id: 'task-prioritize',
      cron_expression: '', // N/A for webhook
      timezone: 'UTC',
      parameters: {},
      enabled: true,
    });

    expect(execution).toBeDefined();
  });

  it('should respect cost limits', async () => {
    const config = {
      id: 'test-schedule-4',
      user_id: 'test-user',
      operation_id: 'analytics-summary',
      cron_expression: '0 * * * *', // Hourly
      timezone: 'UTC',
      parameters: {},
      max_cost_per_month: 5.0, // Only $5/month allowed
      enabled: true,
    };

    await scheduler.scheduleJob(config);

    // Simulate multiple executions to exceed cost limit
    for (let i = 0; i < 200; i++) {
      await scheduler.executeScheduledOperation(config);
    }

    // Verify schedule auto-disabled when cost exceeded
    const schedule = await db
      .from('operation_schedules')
      .select('enabled')
      .eq('id', 'test-schedule-4')
      .single();

    expect(schedule.data?.enabled).toBe(false);
  });
});
```

---

## PHASE 9B: BATCH OPERATIONS (Weeks 23-24)

### Week 23: Batch Execution Engine

**Database Schema for Batches:**

```sql
-- Add to migrations/045_phase9_scheduling.sql

CREATE TABLE operation_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,

  batch_type TEXT CHECK (batch_type IN ('parallel', 'sequential', 'conditional')),
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),

  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'running', 'completed', 'failed')),

  total_operations INTEGER,
  completed_operations INTEGER DEFAULT 0,
  failed_operations INTEGER DEFAULT 0,

  total_cost_estimated DECIMAL(10, 6),
  total_cost_actual DECIMAL(10, 6),

  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE batch_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES operation_batches(id) ON DELETE CASCADE,

  operation_id TEXT NOT NULL,
  parameters JSONB,

  sequence_order INTEGER,
  depends_on UUID REFERENCES batch_operations(id),

  status TEXT DEFAULT 'pending',
  result JSONB,
  cost_usd DECIMAL(10, 6),

  created_at TIMESTAMP DEFAULT NOW(),
  executed_at TIMESTAMP
);

CREATE INDEX idx_batches_user ON operation_batches(user_id);
CREATE INDEX idx_batches_status ON operation_batches(status);
CREATE INDEX idx_batch_ops ON batch_operations(batch_id);
```

**Batch Execution Engine:**

```typescript
// web/src/services/batching/batch-executor.ts

import { db } from '@/lib/supabase';
import { AIRouterClient } from '@/services/intelligence/router-client';
import { EventEmitter } from 'events';

export interface BatchOperation {
  operation_id: string;
  parameters: Record<string, any>;
  sequence_order?: number;
  depends_on?: string;
}

export interface BatchConfig {
  user_id: string;
  name: string;
  operations: BatchOperation[];
  batch_type: 'parallel' | 'sequential' | 'conditional';
  max_concurrent: number;
  max_cost_usd: number;
}

export class BatchExecutor extends EventEmitter {
  private aiRouter = new AIRouterClient();
  private activeExecutions: Map<string, Promise<any>> = new Map();

  async createBatch(config: BatchConfig): Promise<string> {
    const totalCostEstimated = await this.estimateTotalCost(config.operations);

    const { data } = await db
      .from('operation_batches')
      .insert({
        user_id: config.user_id,
        name: config.name,
        batch_type: config.batch_type,
        total_operations: config.operations.length,
        total_cost_estimated: totalCostEstimated,
      })
      .select('id')
      .single();

    const batchId = data.id;

    // Insert individual operations
    for (let i = 0; i < config.operations.length; i++) {
      const op = config.operations[i];
      await db.from('batch_operations').insert({
        batch_id: batchId,
        operation_id: op.operation_id,
        parameters: op.parameters,
        sequence_order: op.sequence_order ?? i,
        depends_on: op.depends_on,
      });
    }

    return batchId;
  }

  async executeBatch(batchId: string): Promise<void> {
    const { data: batch } = await db
      .from('operation_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (!batch) throw new Error('Batch not found');

    // Update batch status
    await db
      .from('operation_batches')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', batchId);

    this.emit('batch:started', { batchId });

    try {
      const { data: operations } = await db
        .from('batch_operations')
        .select('*')
        .eq('batch_id', batchId)
        .order('sequence_order', { ascending: true });

      if (batch.batch_type === 'parallel') {
        await this.executeParallel(batchId, operations);
      } else if (batch.batch_type === 'sequential') {
        await this.executeSequential(batchId, operations);
      } else if (batch.batch_type === 'conditional') {
        await this.executeConditional(batchId, operations);
      }

      // Mark batch complete
      const totalCost = await this.calculateTotalCost(batchId);
      await db
        .from('operation_batches')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_cost_actual: totalCost,
        })
        .eq('id', batchId);

      this.emit('batch:completed', { batchId, totalCost });
    } catch (error) {
      await db.from('operation_batches').update({ status: 'failed' }).eq('id', batchId);

      this.emit('batch:failed', { batchId, error });
    }
  }

  private async executeParallel(batchId: string, operations: any[]): Promise<void> {
    const maxConcurrent = 5;
    const queue = [...operations];
    const executing: Promise<any>[] = [];

    while (queue.length > 0 || executing.length > 0) {
      // Fill execution slots
      while (executing.length < maxConcurrent && queue.length > 0) {
        const op = queue.shift();
        const promise = this.executeOperation(batchId, op);
        executing.push(promise);
      }

      if (executing.length > 0) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex(p => !p || !p.pending),
          1
        );
      }
    }
  }

  private async executeSequential(batchId: string, operations: any[]): Promise<void> {
    for (const op of operations) {
      await this.executeOperation(batchId, op);
    }
  }

  private async executeConditional(batchId: string, operations: any[]): Promise<void> {
    const dependencyMap = new Map<string, string>();
    const results = new Map<string, any>();

    operations.forEach(op => {
      if (op.depends_on) {
        dependencyMap.set(op.id, op.depends_on);
      }
    });

    for (const op of operations) {
      if (op.depends_on) {
        const parentResult = results.get(op.depends_on);
        if (!parentResult?.success) {
          // Skip this operation if dependency failed
          await db.from('batch_operations').update({ status: 'skipped' }).eq('id', op.id);
          continue;
        }
      }

      const result = await this.executeOperation(batchId, op);
      results.set(op.id, result);
    }
  }

  private async executeOperation(batchId: string, op: any): Promise<any> {
    const executionId = op.id;

    try {
      await db.from('batch_operations').update({ status: 'running' }).eq('id', executionId);

      const result = await this.aiRouter.execute(op.operation_id, op.parameters);

      const cost = await this.aiRouter.getCost(op.operation_id, op.parameters);

      await db
        .from('batch_operations')
        .update({
          status: 'completed',
          result,
          cost_usd: cost,
          executed_at: new Date().toISOString(),
        })
        .eq('id', executionId);

      // Update batch progress
      await db.rpc('increment_batch_completed', {
        batch_id: batchId,
      });

      this.emit('operation:completed', { batchId, operationId: executionId });

      return { success: true, result, cost };
    } catch (error) {
      await db
        .from('batch_operations')
        .update({
          status: 'failed',
          result: { error: error instanceof Error ? error.message : String(error) },
        })
        .eq('id', executionId);

      // Update batch failure count
      await db.rpc('increment_batch_failed', {
        batch_id: batchId,
      });

      this.emit('operation:failed', { batchId, operationId: executionId, error });

      return { success: false, error };
    }
  }

  private async estimateTotalCost(operations: BatchOperation[]): Promise<number> {
    let totalCost = 0;

    for (const op of operations) {
      const cost = await this.aiRouter.estimateCost(op.operation_id, op.parameters);
      totalCost += cost;
    }

    return totalCost;
  }

  private async calculateTotalCost(batchId: string): Promise<number> {
    const { data } = await db.from('batch_operations').select('cost_usd').eq('batch_id', batchId);

    return (data || []).reduce((sum, op) => sum + (op.cost_usd || 0), 0);
  }
}
```

### Week 24: Batch UI & Testing

**Batch Manager UI:**

```typescript
// web/src/pages/BatchManager.tsx

import { useState } from 'react';
import { BatchExecutor } from '@/services/batching/batch-executor';
import { PHASE_8_OPERATIONS } from '@/services/intelligence/constants';

export function BatchManager() {
  const [batches, setBatches] = useState([]);
  const [operations, setOperations] = useState<BatchOperation[]>([]);
  const [batchType, setBatchType] = useState<'parallel' | 'sequential'>('parallel');

  const executor = new BatchExecutor();

  async function createBatch() {
    const batchId = await executor.createBatch({
      user_id: userId,
      name: 'Batch Execution',
      operations,
      batch_type: batchType,
      max_concurrent: 5,
      max_cost_usd: 50,
    });

    await executor.executeBatch(batchId);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4">Create Batch</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Batch Type</label>
            <select
              value={batchType}
              onChange={e => setBatchType(e.target.value as any)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="parallel">Parallel (5 concurrent)</option>
              <option value="sequential">Sequential</option>
              <option value="conditional">Conditional (with dependencies)</option>
            </select>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Operations</h3>
            <div className="space-y-2">
              {operations.map((op, i) => (
                <OperationRow
                  key={i}
                  operation={op}
                  onRemove={() => setOperations(ops => ops.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
            <button
              onClick={() => setOperations(ops => [...ops, { operation_id: '', parameters: {} }])}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + Add Operation
            </button>
          </div>

          <button
            onClick={createBatch}
            disabled={operations.length === 0}
            className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            Execute Batch
          </button>
        </div>
      </div>

      <BatchHistory batches={batches} />
    </div>
  );
}
```

**Batch Tests:**

```typescript
// web/src/services/batching/batch-executor.test.ts

describe('BatchExecutor', () => {
  let executor: BatchExecutor;

  beforeEach(() => {
    executor = new BatchExecutor();
  });

  it('should execute batch with parallel operations', async () => {
    const batchId = await executor.createBatch({
      user_id: 'test-user',
      name: 'Test Batch',
      operations: [
        { operation_id: 'email-compose', parameters: { draft: true } },
        { operation_id: 'task-prioritize', parameters: {} },
        { operation_id: 'analytics-summary', parameters: { days: 7 } },
      ],
      batch_type: 'parallel',
      max_concurrent: 5,
      max_cost_usd: 50,
    });

    let batchStarted = false;
    executor.on('batch:started', () => {
      batchStarted = true;
    });

    await executor.executeBatch(batchId);

    expect(batchStarted).toBe(true);

    const { data: batch } = await db
      .from('operation_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    expect(batch.status).toBe('completed');
    expect(batch.total_cost_actual).toBeLessThan(batch.total_cost_estimated * 1.1);
  });

  it('should handle batch cost estimation', async () => {
    const operations = [
      { operation_id: 'email-compose', parameters: { draft: true } },
      { operation_id: 'email-classify', parameters: {} },
      { operation_id: 'email-respond', parameters: { tone: 'professional' } },
    ];

    const estimatedCost = await executor.estimateTotalCost(operations);

    expect(estimatedCost).toBeGreaterThan(0);
    expect(estimatedCost).toBeLessThan(1); // Should be <$1 for these operations
  });

  it('should execute sequential operations in order', async () => {
    const executionOrder: string[] = [];

    executor.on('operation:completed', ({ operationId }: any) => {
      executionOrder.push(operationId);
    });

    const batchId = await executor.createBatch({
      user_id: 'test-user',
      name: 'Sequential Batch',
      operations: [
        { operation_id: 'task-breakdown', parameters: {} },
        { operation_id: 'task-prioritize', parameters: {} },
      ],
      batch_type: 'sequential',
      max_concurrent: 1,
      max_cost_usd: 50,
    });

    await executor.executeBatch(batchId);

    expect(executionOrder).toHaveLength(2);
  });
});
```

---

## PHASE 9C: CUSTOMIZATION & SETTINGS (Weeks 25-26)

### User Preferences Schema

```sql
-- Add to migrations

CREATE TABLE user_operation_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL,

  preferred_model TEXT CHECK (preferred_model IN ('deepseek', 'gemini', 'openai')),
  enabled BOOLEAN DEFAULT TRUE,

  default_parameters JSONB,
  cost_budget_monthly DECIMAL(10, 2),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ui_theme_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  color_scheme TEXT CHECK (color_scheme IN ('light', 'dark', 'auto')),
  accent_color TEXT DEFAULT '#3B82F6',
  compact_mode BOOLEAN DEFAULT FALSE,

  email_list_view TEXT DEFAULT 'grid',
  calendar_view TEXT DEFAULT 'month',
  tasks_sort_by TEXT DEFAULT 'priority',

  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Settings UI Components

```typescript
// web/src/pages/Settings.tsx

export function SettingsPage() {
  const [operationPrefs, setOperationPrefs] = useState({});
  const [themePrefs, setThemePrefs] = useState({});

  return (
    <div className="space-y-6">
      <OperationPreferencesPanel />
      <ThemePreferencesPanel />
      <BudgetSettingsPanel />
      <NotificationSettingsPanel />
    </div>
  );
}

function OperationPreferencesPanel() {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Operation Preferences</h3>

      {PHASE_8_OPERATIONS.map(op => (
        <div key={op.id} className="p-4 border rounded mb-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">{op.name}</h4>
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked={op.enabled} />
              <span>Enabled</span>
            </label>
          </div>

          <div className="mt-3 space-y-3">
            <select defaultValue="deepseek" className="w-full border rounded px-3 py-2">
              <option value="deepseek">DeepSeek (Primary)</option>
              <option value="gemini">Gemini Flash</option>
              <option value="openai">OpenAI</option>
            </select>

            <input
              type="number"
              placeholder="Monthly budget (USD)"
              defaultValue={5}
              step="0.01"
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ThemePreferencesPanel() {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Theme</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Color Scheme</label>
          <select className="w-full border rounded px-3 py-2">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto (System)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Accent Color</label>
          <input type="color" defaultValue="#3B82F6" className="w-full h-10 border rounded" />
        </div>

        <label className="flex items-center gap-2">
          <input type="checkbox" />
          <span>Compact Mode</span>
        </label>
      </div>
    </div>
  );
}
```

---

## PHASE 9D: ADVANCED ANALYTICS & REPORTING (Weeks 27-28)

### Analytics Dashboard

```typescript
// web/src/pages/AnalyticsDashboard.tsx

export function AnalyticsDashboard() {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4">AI Operations Analytics</h2>

        <div className="flex gap-4 mb-6">
          {['week', 'month', 'quarter', 'year'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded ${
                period === p ? 'bg-blue-600 text-white' : 'bg-gray-100'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <MetricCard title="Total Cost" value="$127.50" trend="+12%" />
          <MetricCard title="Operations" value="1,247" trend="+8%" />
          <MetricCard title="Avg Latency" value="342ms" trend="-5%" />
          <MetricCard title="Success Rate" value="99.8%" trend="+0.2%" />
        </div>

        <CostBreakdown period={period} />
        <OperationTrends period={period} />
        <ModelComparison period={period} />
      </div>

      <OptimizationRecommendations />
    </div>
  );
}

function CostBreakdown({ period }: any) {
  return (
    <div className="mt-6">
      <h3 className="font-semibold mb-4">Cost Breakdown by Operation</h3>
      <Chart data={operationCostData} type="pie" />
    </div>
  );
}

function OperationTrends({ period }: any) {
  return (
    <div className="mt-6">
      <h3 className="font-semibold mb-4">Usage Trends</h3>
      <Chart data={usageTrendData} type="line" />
    </div>
  );
}

function ModelComparison({ period }: any) {
  return (
    <div className="mt-6">
      <h3 className="font-semibold mb-4">Model Performance</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Model</th>
            <th>Cost/Op</th>
            <th>Avg Latency</th>
            <th>Success Rate</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="py-2">DeepSeek</td>
            <td>$0.0012</td>
            <td>245ms</td>
            <td>99.9%</td>
          </tr>
          <tr className="border-b">
            <td>Gemini Flash</td>
            <td>$0.0032</td>
            <td>312ms</td>
            <td>99.7%</td>
          </tr>
          <tr>
            <td>OpenAI</td>
            <td>$0.0045</td>
            <td>428ms</td>
            <td>99.5%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function OptimizationRecommendations() {
  return (
    <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
      <h3 className="font-semibold text-yellow-900 mb-3">Optimization Recommendations</h3>
      <ul className="space-y-2 text-sm text-yellow-800">
        <li>✓ Use Gemini for analytics-summary (32% cheaper than current model)</li>
        <li>✓ Schedule email-classify batch runs at 2am (off-peak pricing available)</li>
        <li>✓ Disable email-respond feature (lowest ROI, 3% usage)</li>
      </ul>
    </div>
  );
}
```

---

## Testing & Quality Assurance

### Phase 9 Test Coverage

```
9A - Scheduling Tests:          45 tests
9B - Batch Execution Tests:     40 tests
9C - Preferences Tests:         30 tests
9D - Analytics Tests:           35 tests
Integration Tests:              30 tests
E2E Tests (new features):       40 tests
─────────────────────────────────────
TOTAL:                         220 tests
```

---

## Success Criteria

### Phase 9A (Scheduling)

- [ ] Cron scheduler handles 100+ simultaneous schedules
- [ ] Webhook delivery reliable (99.9% uptime)
- [ ] Timezone conversions accurate for 20+ zones
- [ ] Cost tracking for scheduled operations accurate
- [ ] Execution history queryable and reportable

### Phase 9B (Batch Operations)

- [ ] 5 concurrent operations execute reliably
- [ ] Sequential batch executes in correct order
- [ ] Conditional batches respect dependencies
- [ ] Cost estimation within 5% of actual
- [ ] Batch result aggregation working

### Phase 9C (Customization)

- [ ] Per-operation model selection respected
- [ ] Budget limits enforced per operation
- [ ] Theme preferences persist across sessions
- [ ] UI adaptations apply correctly

### Phase 9D (Analytics)

- [ ] Cost breakdown by operation accurate
- [ ] Trend analysis shows correct patterns
- [ ] Model comparison metrics correct
- [ ] Optimization recommendations meaningful

---

## Architecture Integration

All Phase 9 features integrate with:

- **Phase 0.5:** Unified AI Operations Control Plane (router, cost tracking, approval gates)
- **Phase 8:** 9 intelligence operations (email, calendar, task, analytics)
- **Admin Panel:** Observability, Control, Intelligence tiers
- **Database:** Supabase PostgreSQL with RLS
- **API:** Gateway RPC with Phase 0.5 extensions

---

## Files to Create

### Phase 9A (Scheduling)

- `web/src/services/scheduling/cron-scheduler.ts` (350 lines)
- `web/src/services/scheduling/cron-scheduler.test.ts` (250 lines)
- `web/supabase/edge-functions/webhook-handler.ts` (200 lines)
- `web/src/pages/ScheduleManager.tsx` (280 lines)

### Phase 9B (Batching)

- `web/src/services/batching/batch-executor.ts` (400 lines)
- `web/src/services/batching/batch-executor.test.ts` (300 lines)
- `web/src/pages/BatchManager.tsx` (320 lines)

### Phase 9C (Customization)

- `web/src/pages/Settings.tsx` (350 lines)
- `web/src/hooks/usePreferences.ts` (180 lines)

### Phase 9D (Analytics)

- `web/src/pages/AnalyticsDashboard.tsx` (400 lines)
- `web/src/services/analytics/analytics-service.ts` (350 lines)

### Migrations

- `web/supabase/migrations/045_phase9_scheduling.sql` (300 lines)

### Tests

- Multiple integration and E2E tests (220 tests total)

---

## Timeline

| Phase | Weeks | Deliverables                          | Status |
| ----- | ----- | ------------------------------------- | ------ |
| 9A    | 21-22 | Scheduling, Cron, Webhooks            | Ready  |
| 9B    | 23-24 | Batch Operations, Parallel/Sequential | Ready  |
| 9C    | 25-26 | Settings, Preferences, Customization  | Ready  |
| 9D    | 27-28 | Analytics, Dashboards, Reports        | Ready  |

---

## Overall Status

**Phase 8 (Foundation):** ✅ 100% Complete

- 9 intelligence operations registered in Phase 0.5
- Web, iOS, Android implementations
- 237 tests passing
- Production deployment guide ready

**Phase 9 (Advanced Features):** 📅 Weeks 21-28

- Scheduling system designed
- Batch execution engine designed
- Customization UI designed
- Analytics dashboards designed

All infrastructure leverages Phase 0.5 unified architecture. No duplicate systems.

---

**Report Generated:** February 4, 2026
**Phase 8 Status:** 100% Complete (Ready for Production)
**Phase 9 Status:** Plan Complete, Ready for Execution
**Next:** Begin Phase 9A Implementation

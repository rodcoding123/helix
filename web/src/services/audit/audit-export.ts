/**
 * Phase 10 Week 6: Audit Log Export Service
 * Export audit logs in multiple formats for compliance
 */

import { getDb } from '@/lib/supabase';

export interface AuditLogEntry {
  id: string;
  user_id: string;
  operation_id: string;
  operation_type: string;
  status: 'success' | 'failure';
  started_at: string;
  completed_at: string;
  duration_ms: number;
  cost_usd: number;
  latency_ms: number;
  input_tokens?: number;
  output_tokens?: number;
  model_used?: string;
  error_message?: string;
}

export interface ExportOptions {
  format: 'csv' | 'json';
  startDate: Date;
  endDate: Date;
  includeDetails?: boolean;
  fields?: (keyof AuditLogEntry)[];
}

export interface ExportResult {
  data: Blob;
  filename: string;
  size: number;
  recordCount: number;
}

/**
 * Export audit logs for compliance and analysis
 */
export async function exportAuditLogs(
  userId: string,
  options: ExportOptions
): Promise<ExportResult> {
  // Fetch audit logs from database
  const logs = await fetchAuditLogs(userId, options.startDate, options.endDate);

  // Filter fields if specified
  const processedLogs = options.fields
    ? logs.map(log => {
        const filtered: Record<string, any> = {};
        options.fields?.forEach(field => {
          filtered[field] = log[field];
        });
        return filtered;
      })
    : logs;

  let blob: Blob;
  let filename: string;

  if (options.format === 'csv') {
    blob = generateCSV(processedLogs);
    filename = `audit-logs-${formatDate(options.startDate)}-${formatDate(
      options.endDate
    )}.csv`;
  } else {
    blob = generateJSON(processedLogs);
    filename = `audit-logs-${formatDate(options.startDate)}-${formatDate(
      options.endDate
    )}.json`;
  }

  return {
    data: blob,
    filename,
    size: blob.size,
    recordCount: logs.length,
  };
}

/**
 * Fetch audit logs from database
 */
async function fetchAuditLogs(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<AuditLogEntry[]> {
  const { data, error } = await getDb()
    .from('ai_operation_log')
    .select(
      `id,
       user_id,
       operation_id,
       operation_type,
       status,
       started_at,
       completed_at,
       duration_ms,
       cost_usd,
       latency_ms,
       input_tokens,
       output_tokens,
       model_used,
       error_message`
    )
    .eq('user_id', userId)
    .gte('started_at', startDate.toISOString())
    .lte('completed_at', endDate.toISOString())
    .order('started_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch audit logs: ${error.message}`);
  }

  return (data || []) as AuditLogEntry[];
}

/**
 * Generate CSV format from logs
 */
function generateCSV(logs: AuditLogEntry[] | Record<string, any>[]): Blob {
  if (logs.length === 0) {
    return new Blob([''], { type: 'text/csv;charset=utf-8' });
  }

  // Get headers from first record
  const headers = Object.keys(logs[0]);

  // Generate header row
  const headerRow = headers.map(h => escapeCSVField(h)).join(',');

  // Generate data rows
  const dataRows = logs.map(log =>
    headers.map(header => {
      const value = log[header];
      return escapeCSVField(value);
    }).join(',')
  );

  const csv = [headerRow, ...dataRows].join('\n');
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

/**
 * Generate JSON format from logs
 */
function generateJSON(logs: AuditLogEntry[] | Record<string, any>[]): Blob {
  const json = JSON.stringify(logs, null, 2);
  return new Blob([json], { type: 'application/json;charset=utf-8' });
}

/**
 * Escape CSV field values
 */
function escapeCSVField(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // Check if field needs quoting
  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n')
  ) {
    // Escape quotes by doubling them
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Format date for filename
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get audit log statistics
 */
export async function getAuditLogStats(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalRecords: number;
  successCount: number;
  failureCount: number;
  totalCost: number;
  averageLatency: number;
  operationTypes: Record<string, number>;
}> {
  const { data, error } = await getDb()
    .from('ai_operation_log')
    .select('status,cost_usd,latency_ms,operation_type')
    .eq('user_id', userId)
    .gte('started_at', startDate.toISOString())
    .lte('completed_at', endDate.toISOString());

  if (error) {
    throw new Error(`Failed to fetch audit statistics: ${error.message}`);
  }

  const logs = data || [];

  const stats = {
    totalRecords: logs.length,
    successCount: logs.filter((l: any) => l.status === 'success').length,
    failureCount: logs.filter((l: any) => l.status === 'failure').length,
    totalCost: logs.reduce((sum: number, l: any) => sum + (l.cost_usd || 0), 0),
    averageLatency: logs.length > 0
      ? logs.reduce((sum: number, l: any) => sum + (l.latency_ms || 0), 0) /
        logs.length
      : 0,
    operationTypes: {} as Record<string, number>,
  };

  // Count by operation type
  logs.forEach((log: any) => {
    const type = log.operation_type || 'unknown';
    stats.operationTypes[type] = (stats.operationTypes[type] || 0) + 1;
  });

  return stats;
}

/**
 * Download audit logs directly from browser
 */
export async function downloadAuditLogs(
  userId: string,
  options: ExportOptions
): Promise<void> {
  const result = await exportAuditLogs(userId, options);

  // Create download link
  const url = URL.createObjectURL(result.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.filename;

  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up URL
  URL.revokeObjectURL(url);
}

/**
 * Schedule regular audit log exports
 */
export function scheduleAuditExport(
  userId: string,
  interval: 'daily' | 'weekly' | 'monthly' = 'weekly'
): NodeJS.Timer {
  const getInterval = () => {
    switch (interval) {
      case 'daily':
        return 24 * 60 * 60 * 1000; // 24 hours
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000; // 7 days
      case 'monthly':
        return 30 * 24 * 60 * 60 * 1000; // 30 days
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  };

  return setInterval(async () => {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - getInterval());

      await exportAuditLogs(userId, {
        format: 'json',
        startDate,
        endDate,
        includeDetails: true,
      });

      console.log(
        `[AuditExport] Successfully exported logs from ${startDate.toISOString()} to ${endDate.toISOString()}`
      );
    } catch (error) {
      console.error('[AuditExport] Failed to export logs:', error);
    }
  }, getInterval());
}

/**
 * Export logs by operation type
 */
export async function exportLogsByOperationType(
  userId: string,
  operationType: string,
  startDate: Date,
  endDate: Date,
  format: 'csv' | 'json' = 'csv'
): Promise<ExportResult> {
  const { data, error } = await getDb()
    .from('ai_operation_log')
    .select('*')
    .eq('user_id', userId)
    .eq('operation_type', operationType)
    .gte('started_at', startDate.toISOString())
    .lte('completed_at', endDate.toISOString())
    .order('started_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch logs: ${error.message}`);
  }

  const logs = data || [];

  let blob: Blob;
  let filename: string;

  if (format === 'csv') {
    blob = generateCSV(logs);
    filename = `audit-logs-${operationType}-${formatDate(startDate)}-${formatDate(
      endDate
    )}.csv`;
  } else {
    blob = generateJSON(logs);
    filename = `audit-logs-${operationType}-${formatDate(startDate)}-${formatDate(
      endDate
    )}.json`;
  }

  return {
    data: blob,
    filename,
    size: blob.size,
    recordCount: logs.length,
  };
}

/**
 * Export logs with custom filtering
 */
export async function exportLogsWithFilter(
  userId: string,
  filter: {
    startDate: Date;
    endDate: Date;
    status?: 'success' | 'failure';
    operationType?: string;
    minCost?: number;
    maxCost?: number;
    minLatency?: number;
    maxLatency?: number;
  },
  format: 'csv' | 'json' = 'csv'
): Promise<ExportResult> {
  let query = getDb()
    .from('ai_operation_log')
    .select('*')
    .eq('user_id', userId)
    .gte('started_at', filter.startDate.toISOString())
    .lte('completed_at', filter.endDate.toISOString());

  // Apply optional filters
  if (filter.status) {
    query = query.eq('status', filter.status);
  }

  if (filter.operationType) {
    query = query.eq('operation_type', filter.operationType);
  }

  if (filter.minCost !== undefined) {
    query = query.gte('cost_usd', filter.minCost);
  }

  if (filter.maxCost !== undefined) {
    query = query.lte('cost_usd', filter.maxCost);
  }

  if (filter.minLatency !== undefined) {
    query = query.gte('latency_ms', filter.minLatency);
  }

  if (filter.maxLatency !== undefined) {
    query = query.lte('latency_ms', filter.maxLatency);
  }

  const { data, error } = await query.order('started_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch logs: ${error.message}`);
  }

  const logs = data || [];

  let blob: Blob;
  let filename: string;

  if (format === 'csv') {
    blob = generateCSV(logs);
  } else {
    blob = generateJSON(logs);
  }

  filename = `audit-logs-filtered-${formatDate(filter.startDate)}-${formatDate(
    filter.endDate
  )}.${format}`;

  return {
    data: blob,
    filename,
    size: blob.size,
    recordCount: logs.length,
  };
}

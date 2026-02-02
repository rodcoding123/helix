export type AuditAction = 'read' | 'create' | 'update' | 'rotate' | 'delete' | 'list';
export type AuditSource = 'api' | 'web-ui' | 'cli' | 'scheduled-rotation';

export interface ApiKeyAccessAudit {
  id: string;
  user_id: string;
  secret_id: string;
  action: AuditAction;
  accessed_at: string; // ISO 8601
  context: string | null;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  error_message: string | null;
  source: AuditSource;
}

export interface AuditQueryParams {
  user_id?: string;
  secret_id?: string;
  action?: AuditAction;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

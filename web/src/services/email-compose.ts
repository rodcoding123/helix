/**
 * Email Compose Service - Phase 5.1
 *
 * Handles email composition, draft management, templates, signatures, and scheduling.
 *
 * Key Features:
 * - Draft CRUD operations with auto-save support
 * - Email template management
 * - Email signature management
 * - Scheduled send scheduling
 * - Attachment tracking
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

const supabase = createClient<Database>(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

// ============================================================================
// TYPES
// ============================================================================

export interface EmailDraft {
  id: string;
  user_id: string;
  account_id: string;
  subject: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  body_html: string;
  body_plain?: string;
  attachment_ids?: string[];
  scheduled_send_time?: Date;
  created_at: Date;
  updated_at: Date;
  last_saved?: Date;
}

export interface EmailTemplate {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  body_html: string;
  body_plain?: string;
  category?: string;
  usage_count: number;
  last_used?: Date;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface EmailSignature {
  id: string;
  user_id: string;
  account_id?: string;
  name: string;
  html_content: string;
  plain_text_content: string;
  is_default: boolean;
  is_account_specific: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ComposeServiceOptions {
  userId: string;
  accountId: string;
}

// ============================================================================
// EMAIL COMPOSE SERVICE
// ============================================================================

export class EmailComposeService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  // =========================================================================
  // DRAFT MANAGEMENT
  // =========================================================================

  /**
   * Create a new draft
   */
  async createDraft(accountId: string): Promise<string> {
    const { data, error } = await (supabase as any)
      .from('email_drafts')
      .insert({
        user_id: this.userId,
        account_id: accountId,
        subject: '',
        to_addresses: [],
        body: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create draft: ${error.message}`);
    }

    return (data as any).id;
  }

  /**
   * Save draft with auto-save support (debounced from component)
   * - Updates existing draft or creates if not found
   * - Tracks last_saved timestamp
   */
  async saveDraft(draft: Partial<EmailDraft>): Promise<EmailDraft> {
    if (!draft.id && !draft.account_id) {
      throw new Error('Draft ID or Account ID required for save');
    }

    const now = new Date().toISOString();

    // Build insert/update payload
    const payload = {
      id: draft.id,
      user_id: this.userId,
      account_id: draft.account_id,
      subject: draft.subject || '',
      to_addresses: draft.to || [],
      cc_addresses: draft.cc || [],
      bcc_addresses: draft.bcc || [],
      body: draft.body_html || '',
      body_plain: draft.body_plain,
      attachment_ids: draft.attachment_ids || [],
      scheduled_send_time: draft.scheduled_send_time?.toISOString(),
      updated_at: now,
      last_saved: now,
    };

    const { data, error } = await (supabase as any)
      .from('email_drafts')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save draft: ${error.message}`);
    }

    return this.mapDraftFromDB(data);
  }

  /**
   * Get draft by ID
   */
  async getDraft(draftId: string): Promise<EmailDraft> {
    const { data, error } = await supabase
      .from('email_drafts')
      .select('*')
      .eq('id', draftId)
      .eq('user_id', this.userId)
      .single();

    if (error) {
      throw new Error(`Failed to load draft: ${error.message}`);
    }

    return this.mapDraftFromDB(data);
  }

  /**
   * Get all drafts for user
   */
  async getDrafts(limit: number = 50): Promise<EmailDraft[]> {
    const { data, error } = await supabase
      .from('email_drafts')
      .select('*')
      .eq('user_id', this.userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to load drafts: ${error.message}`);
    }

    return (data || []).map(d => this.mapDraftFromDB(d));
  }

  /**
   * Delete draft (soft delete by setting deleted_at, or hard delete if needed)
   */
  async deleteDraft(draftId: string): Promise<void> {
    const { error } = await supabase
      .from('email_drafts')
      .delete()
      .eq('id', draftId)
      .eq('user_id', this.userId);

    if (error) {
      throw new Error(`Failed to delete draft: ${error.message}`);
    }
  }

  // =========================================================================
  // TEMPLATE MANAGEMENT
  // =========================================================================

  /**
   * Get all templates for user
   */
  async getTemplates(limit: number = 100): Promise<EmailTemplate[]> {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('user_id', this.userId)
      .order('last_used', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to load templates: ${error.message}`);
    }

    return (data || []).map(t => this.mapTemplateFromDB(t));
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<EmailTemplate> {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .eq('user_id', this.userId)
      .single();

    if (error) {
      throw new Error(`Failed to load template: ${error.message}`);
    }

    return this.mapTemplateFromDB(data);
  }

  /**
   * Create or update template
   */
  async createTemplate(template: Omit<EmailTemplate, 'id' | 'user_id' | 'usage_count' | 'created_at' | 'updated_at' | 'last_used'>): Promise<EmailTemplate> {
    // Validate required fields
    if (!template.name || !template.subject || !template.body_html) {
      throw new Error('Template name, subject, and body are required');
    }

    const now = new Date().toISOString();

    const { data, error } = await (supabase as any)
      .from('email_templates')
      .insert({
        user_id: this.userId,
        name: template.name,
        subject: template.subject,
        body_html: template.body_html,
        body_plain: template.body_plain,
        category: template.category,
        is_public: template.is_public || false,
        created_at: now,
        updated_at: now,
        usage_count: 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create template: ${error.message}`);
    }

    return this.mapTemplateFromDB(data);
  }

  /**
   * Apply template to draft (merge content)
   * - Keeps existing recipients
   * - Applies subject and body from template
   * - Appends to existing content if draft has body
   */
  async applyTemplate(draftId: string, templateId: string): Promise<EmailDraft> {
    // Load template
    const template = await this.getTemplate(templateId);

    // Load draft
    const draft = await this.getDraft(draftId);

    // Merge: template subject, template body + draft body
    const merged = await this.saveDraft({
      ...draft,
      subject: template.subject,
      body_html: draft.body_html ? `${template.body_html}\n<hr/>\n${draft.body_html}` : template.body_html,
      body_plain: draft.body_plain ? `${template.body_plain}\n---\n${draft.body_plain}` : template.body_plain,
    });

    // Update template usage
    await this.updateTemplateUsage(templateId);

    return merged;
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', templateId)
      .eq('user_id', this.userId);

    if (error) {
      throw new Error(`Failed to delete template: ${error.message}`);
    }
  }

  /**
   * Update template usage stats (called when template is applied)
   */
  private async updateTemplateUsage(templateId: string): Promise<void> {
    const { error } = await (supabase as any).rpc('update_template_usage', {
      template_id: templateId,
    });

    if (error) {
      console.warn('Failed to update template usage:', error);
      // Don't throw - this is non-critical
    }
  }

  // =========================================================================
  // SIGNATURE MANAGEMENT
  // =========================================================================

  /**
   * Get all signatures for user
   */
  async getSignatures(accountId?: string): Promise<EmailSignature[]> {
    let query = supabase
      .from('email_signatures')
      .select('*')
      .eq('user_id', this.userId);

    if (accountId) {
      // Get account-specific + global signatures
      query = query.or(`account_id.eq.${accountId},account_id.is.null`);
    }

    const { data, error } = await query.order('is_default', { ascending: false });

    if (error) {
      throw new Error(`Failed to load signatures: ${error.message}`);
    }

    return (data || []).map(s => this.mapSignatureFromDB(s));
  }

  /**
   * Get default signature for account
   */
  async getDefaultSignature(accountId: string): Promise<EmailSignature | null> {
    const { data, error } = await supabase
      .from('email_signatures')
      .select('*')
      .eq('user_id', this.userId)
      .eq('is_default', true)
      .or(`account_id.eq.${accountId},account_id.is.null`)
      .order('account_id', { ascending: false }) // Prefer account-specific
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (which is OK)
      console.warn('Failed to load default signature:', error);
    }

    return data ? this.mapSignatureFromDB(data) : null;
  }

  /**
   * Create or update signature
   */
  async createSignature(signature: Omit<EmailSignature, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<EmailSignature> {
    if (!signature.name || !signature.html_content || !signature.plain_text_content) {
      throw new Error('Signature name and content are required');
    }

    const now = new Date().toISOString();

    const { data, error } = await (supabase as any)
      .from('email_signatures')
      .insert({
        user_id: this.userId,
        account_id: signature.account_id,
        name: signature.name,
        html_content: signature.html_content,
        plain_text_content: signature.plain_text_content,
        is_default: signature.is_default || false,
        is_account_specific: signature.is_account_specific || false,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create signature: ${error.message}`);
    }

    return this.mapSignatureFromDB(data);
  }

  /**
   * Insert signature into draft body
   */
  async insertSignature(draftId: string, signatureId: string): Promise<EmailDraft> {
    const signature = await this.getSignatureById(signatureId);
    const draft = await this.getDraft(draftId);

    // Append signature with separator
    const updated = await this.saveDraft({
      ...draft,
      body_html: draft.body_html ? `${draft.body_html}\n<hr/>\n${signature.html_content}` : signature.html_content,
      body_plain: draft.body_plain ? `${draft.body_plain}\n---\n${signature.plain_text_content}` : signature.plain_text_content,
    });

    return updated;
  }

  /**
   * Get signature by ID (private helper)
   */
  private async getSignatureById(signatureId: string): Promise<EmailSignature> {
    const { data, error } = await supabase
      .from('email_signatures')
      .select('*')
      .eq('id', signatureId)
      .eq('user_id', this.userId)
      .single();

    if (error) {
      throw new Error(`Failed to load signature: ${error.message}`);
    }

    return this.mapSignatureFromDB(data);
  }

  /**
   * Delete signature
   */
  async deleteSignature(signatureId: string): Promise<void> {
    const { error } = await supabase
      .from('email_signatures')
      .delete()
      .eq('id', signatureId)
      .eq('user_id', this.userId);

    if (error) {
      throw new Error(`Failed to delete signature: ${error.message}`);
    }
  }

  // =========================================================================
  // SCHEDULED SEND
  // =========================================================================

  /**
   * Schedule email to be sent at specified time
   * - Validates that sendTime is in future
   * - Stores scheduled_send_time in draft
   */
  async scheduleSend(draftId: string, sendTime: Date, timezone?: string): Promise<EmailDraft> {
    // Validate send time is in future
    if (sendTime <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }

    // Update draft
    const draft = await this.getDraft(draftId);
    const updated = await this.saveDraft({
      ...draft,
      scheduled_send_time: sendTime,
    });

    return updated;
  }

  /**
   * Cancel scheduled send
   */
  async cancelScheduledSend(draftId: string): Promise<EmailDraft> {
    const draft = await this.getDraft(draftId);
    const updated = await this.saveDraft({
      ...draft,
      scheduled_send_time: undefined,
    });

    return updated;
  }

  // =========================================================================
  // VALIDATION
  // =========================================================================

  /**
   * Validate draft before sending
   * Returns validation result with any errors
   */
  validateDraft(draft: Partial<EmailDraft>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check recipients
    if (!draft.to || draft.to.length === 0) {
      errors.push('At least one recipient is required');
    }

    if (draft.to) {
      const invalidEmails = draft.to.filter(email => !this.isValidEmail(email));
      if (invalidEmails.length > 0) {
        errors.push(`Invalid email addresses: ${invalidEmails.join(', ')}`);
      }
    }

    // Check subject
    if (!draft.subject || draft.subject.trim().length === 0) {
      errors.push('Subject is required');
    }

    // Check body
    if (!draft.body_html || draft.body_html.trim().length === 0) {
      errors.push('Message body is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate email address format
   */
  private isValidEmail(email: string): boolean {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email) && email.length <= 254; // RFC 5321
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  /**
   * Map database draft to service type
   */
  private mapDraftFromDB(dbDraft: any): EmailDraft {
    return {
      id: dbDraft.id,
      user_id: dbDraft.user_id,
      account_id: dbDraft.account_id,
      subject: dbDraft.subject,
      to: dbDraft.to_addresses || [],
      cc: dbDraft.cc_addresses || [],
      bcc: dbDraft.bcc_addresses || [],
      body_html: dbDraft.body,
      body_plain: dbDraft.body_plain,
      attachment_ids: dbDraft.attachment_ids || [],
      scheduled_send_time: dbDraft.scheduled_send_time ? new Date(dbDraft.scheduled_send_time) : undefined,
      created_at: new Date(dbDraft.created_at),
      updated_at: new Date(dbDraft.updated_at),
      last_saved: dbDraft.last_saved ? new Date(dbDraft.last_saved) : undefined,
    };
  }

  /**
   * Map database template to service type
   */
  private mapTemplateFromDB(dbTemplate: any): EmailTemplate {
    return {
      id: dbTemplate.id,
      user_id: dbTemplate.user_id,
      name: dbTemplate.name,
      subject: dbTemplate.subject,
      body_html: dbTemplate.body_html,
      body_plain: dbTemplate.body_plain,
      category: dbTemplate.category,
      usage_count: dbTemplate.usage_count || 0,
      last_used: dbTemplate.last_used ? new Date(dbTemplate.last_used) : undefined,
      is_public: dbTemplate.is_public || false,
      created_at: new Date(dbTemplate.created_at),
      updated_at: new Date(dbTemplate.updated_at),
    };
  }

  /**
   * Map database signature to service type
   */
  private mapSignatureFromDB(dbSignature: any): EmailSignature {
    return {
      id: dbSignature.id,
      user_id: dbSignature.user_id,
      account_id: dbSignature.account_id,
      name: dbSignature.name,
      html_content: dbSignature.html_content,
      plain_text_content: dbSignature.plain_text_content,
      is_default: dbSignature.is_default || false,
      is_account_specific: dbSignature.is_account_specific || false,
      created_at: new Date(dbSignature.created_at),
      updated_at: new Date(dbSignature.updated_at),
    };
  }
}

// ============================================================================
// EXPORT FACTORY FUNCTION
// ============================================================================

export function useEmailComposeService(userId: string): EmailComposeService {
  return new EmailComposeService(userId);
}

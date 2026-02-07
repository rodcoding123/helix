/**
 * WhatsApp Broadcasts and Status Updates
 *
 * WhatsApp-specific features:
 * - Broadcast lists (send to multiple recipients)
 * - Status updates (24h ephemeral posts)
 * - Group admin commands (kick, mute, promote)
 */

export interface BroadcastList {
  id: string;
  name: string;
  recipients: string[]; // Phone numbers with country code
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface StatusUpdate {
  id: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio';
  mediaUrl?: string;
  caption?: string;
  expiresAt: number; // 24 hours after creation
  viewers: string[]; // Contacts who viewed
  createdAt: number;
}

export interface GroupAdminAction {
  groupId: string;
  action: 'kick' | 'remove' | 'promote' | 'demote' | 'mute' | 'unmute';
  participantId: string;
  reason?: string;
  timestamp: number;
}

export interface WhatsAppBroadcastConfig {
  version: string;
  broadcasts: BroadcastList[];
  statusUpdates: StatusUpdate[];
  adminActions: GroupAdminAction[];
}

/**
 * WhatsApp Broadcast Manager
 */
export class WhatsAppBroadcastManager {
  private config: WhatsAppBroadcastConfig;

  constructor(config: WhatsAppBroadcastConfig) {
    this.config = config;
  }

  /**
   * Create broadcast list
   */
  createBroadcast(name: string, recipients: string[], description?: string): BroadcastList {
    const broadcast: BroadcastList = {
      id: `broadcast-${Date.now()}`,
      name,
      recipients,
      description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.config.broadcasts.push(broadcast);
    return broadcast;
  }

  /**
   * Get broadcast list
   */
  getBroadcast(broadcastId: string): BroadcastList | null {
    return this.config.broadcasts.find(b => b.id === broadcastId) || null;
  }

  /**
   * Add recipient to broadcast
   */
  addRecipient(broadcastId: string, phoneNumber: string): BroadcastList {
    const broadcast = this.getBroadcast(broadcastId);
    if (!broadcast) {
      throw new Error(`Broadcast ${broadcastId} not found`);
    }

    if (!broadcast.recipients.includes(phoneNumber)) {
      broadcast.recipients.push(phoneNumber);
      broadcast.updatedAt = Date.now();
    }

    return broadcast;
  }

  /**
   * Remove recipient from broadcast
   */
  removeRecipient(broadcastId: string, phoneNumber: string): BroadcastList {
    const broadcast = this.getBroadcast(broadcastId);
    if (!broadcast) {
      throw new Error(`Broadcast ${broadcastId} not found`);
    }

    broadcast.recipients = broadcast.recipients.filter(p => p !== phoneNumber);
    broadcast.updatedAt = Date.now();

    return broadcast;
  }

  /**
   * Delete broadcast list
   */
  deleteBroadcast(broadcastId: string): void {
    this.config.broadcasts = this.config.broadcasts.filter(b => b.id !== broadcastId);
  }

  /**
   * Create status update (24h expiry)
   */
  createStatus(
    content: string,
    type: 'text' | 'image' | 'video' | 'audio' = 'text',
    mediaUrl?: string,
    caption?: string
  ): StatusUpdate {
    const status: StatusUpdate = {
      id: `status-${Date.now()}`,
      content,
      type,
      mediaUrl,
      caption,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      viewers: [],
      createdAt: Date.now(),
    };

    this.config.statusUpdates.push(status);
    return status;
  }

  /**
   * Get active statuses (not expired)
   */
  getActiveStatuses(): StatusUpdate[] {
    const now = Date.now();
    return this.config.statusUpdates.filter(s => s.expiresAt > now);
  }

  /**
   * Record status view
   */
  recordStatusView(statusId: string, viewerId: string): void {
    const status = this.config.statusUpdates.find(s => s.id === statusId);
    if (!status) return;

    if (!status.viewers.includes(viewerId)) {
      status.viewers.push(viewerId);
    }
  }

  /**
   * Delete status
   */
  deleteStatus(statusId: string): void {
    this.config.statusUpdates = this.config.statusUpdates.filter(s => s.id !== statusId);
  }

  /**
   * Log admin action
   */
  logAdminAction(action: GroupAdminAction): void {
    this.config.adminActions.push(action);

    // Keep only last 1000 actions
    if (this.config.adminActions.length > 1000) {
      this.config.adminActions = this.config.adminActions.slice(-1000);
    }
  }

  /**
   * Get admin actions for group
   */
  getGroupAdminActions(groupId: string): GroupAdminAction[] {
    return this.config.adminActions.filter(a => a.groupId === groupId);
  }

  /**
   * Clean up expired statuses
   */
  cleanupExpiredStatuses(): number {
    const before = this.config.statusUpdates.length;
    const now = Date.now();
    this.config.statusUpdates = this.config.statusUpdates.filter(s => s.expiresAt > now);
    return before - this.config.statusUpdates.length;
  }

  /**
   * Get config
   */
  getConfig(): WhatsAppBroadcastConfig {
    return this.config;
  }

  /**
   * Update config
   */
  updateConfig(config: WhatsAppBroadcastConfig): void {
    this.config = config;
  }
}

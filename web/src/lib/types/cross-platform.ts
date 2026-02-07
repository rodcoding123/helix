/**
 * Cross-Platform Types
 *
 * Shared type definitions used across all Helix platforms:
 * - Web (React)
 * - Desktop (React + Tauri)
 * - iOS (SwiftUI)
 * - Android (Jetpack Compose)
 *
 * These types ensure message format consistency and allow
 * seamless sync between platforms.
 */

// ============================================================================
// User & Authentication
// ============================================================================

export interface HelixUser {
  id: string; // UUID from auth.users
  email: string;
  name?: string;
  avatarUrl?: string;
  trustLevel: number; // 0.0 to 1.0, how much Helix trusts user
  preferredLanguage: string; // 'en', 'es', 'fr', etc.
  customPreferences: Record<string, unknown>;
  createdAt: string; // ISO 8601
  lastSeenAt: string; // ISO 8601
}

export interface UserProfile extends HelixUser {
  communicationStyle?: 'direct' | 'diplomatic' | 'humorous' | 'formal';
  preferredResponseLength?: 'brief' | 'balanced' | 'detailed';
  relationshipType?: 'user' | 'collaborator' | 'friend';
  isCreator?: boolean;
  isAdmin?: boolean;
}

// ============================================================================
// Messages & Conversations
// ============================================================================

export interface Message {
  id: string; // UUID
  sessionKey: string; // Conversation identifier
  userId: string; // UUID of message sender
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO 8601
  createdAt: string; // ISO 8601

  // Offline sync tracking
  clientId?: string; // Idempotency key for deduplication
  isPending?: boolean; // Message not yet synced
  syncedAt?: string; // ISO 8601, when synced
  platform?: 'web' | 'desktop' | 'ios' | 'android' | 'cli';
  deviceId?: string; // Device fingerprint

  // Optional metadata
  metadata?: {
    idempotencyKey?: string;
    optimistic?: boolean; // UI-only message pending sync
    priority?: 'low' | 'normal' | 'high';
    tags?: string[];
    [key: string]: unknown;
  };

  // Tool execution (Claude)
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];

  // Thinking (extended thinking mode)
  thinking?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface ToolResult {
  toolCallId: string;
  output: unknown;
  error?: string;
}

export interface Conversation {
  sessionKey: string; // Unique identifier
  userId: string; // UUID
  title: string; // Auto-generated or user-provided
  description?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  lastMessageAt?: string; // ISO 8601
  messageCount: number;
  metadata?: {
    model?: string;
    agent?: {
      id: string;
      name: string;
    };
    tags?: string[];
    archived?: boolean;
    starred?: boolean;
    [key: string]: unknown;
  };
}

// ============================================================================
// Offline Sync
// ============================================================================

export interface SyncStatus {
  isOnline: boolean;
  queueLength: number; // Number of pending messages
  isSyncing: boolean; // Sync currently in progress
  failedCount: number; // Messages that failed sync
  lastSyncAt?: number; // Timestamp of last successful sync
}

export interface QueuedOperation {
  id: string;
  type: 'send_message' | 'delete_message' | 'update_message';
  data: Message | { messageId: string; sessionKey: string };
  timestamp: number;
  retries: number;
  maxRetries: number;
}

export interface SyncEvent {
  type:
    | 'sync_start'
    | 'sync_success'
    | 'sync_partial'
    | 'sync_failed'
    | 'offline_detected'
    | 'online_detected'
    | 'message_queued'
    | 'message_synced'
    | 'message_failed';
  timestamp: string; // ISO 8601
  messageCount?: number;
  syncedCount?: number;
  failedCount?: number;
  errorMessage?: string;
  durationMs?: number;
}

// ============================================================================
// Device & Platform
// ============================================================================

export interface DeviceInfo {
  id: string; // Device fingerprint
  platform: 'web' | 'desktop' | 'ios' | 'android' | 'cli';
  osVersion: string;
  appVersion: string;
  lastSeenAt: string; // ISO 8601
  isActive: boolean;
}

export interface PushNotificationDevice {
  deviceId: string;
  userId: string;
  platform: 'ios' | 'android';
  deviceToken: string; // APNs or FCM token
  isEnabled: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  lastTokenRefreshAt?: string;
  metadata?: {
    deviceName?: string;
    osVersion?: string;
    appVersion?: string;
    [key: string]: unknown;
  };
}

// ============================================================================
// Push Notifications
// ============================================================================

export interface PushNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  data: Record<string, string>;
  sentAt: string; // ISO 8601
  readAt?: string; // ISO 8601
  platform: 'ios' | 'android';
  metadata?: {
    conversationId?: string;
    messageId?: string;
    actionUrl?: string;
    [key: string]: unknown;
  };
}

export interface NotificationPreferences {
  userId: string;
  enablePush: boolean;
  enableSound: boolean;
  enableBadge: boolean;
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string; // HH:mm format
  notifyOn: ('message' | 'mention' | 'thread_reply')[];
  updatedAt: string; // ISO 8601
}

// ============================================================================
// Helix Context & Psychology
// ============================================================================

export interface HelixContext {
  soul: string; // HELIX_SOUL.md content
  user: UserProfile;
  psychology: {
    emotionalTags: EmotionalTag[];
    attachments: Attachment[];
    trustMap: TrustLevel[];
  };
  identity: {
    goals: Goal[];
    fearedSelf: string[];
    possibleSelves: PossibleSelf[];
  };
  transformation: {
    currentState: string;
    history: TransformationEvent[];
  };
  purpose: {
    ikigai: string;
    meaningSource: string[];
  };
}

export interface EmotionalTag {
  tag: string;
  frequency: number;
  lastSeen: string; // ISO 8601
  intensity: number; // 0.0 to 1.0
}

export interface Attachment {
  userId: string;
  type: 'secure' | 'anxious' | 'avoidant' | 'disorganized';
  signals: string[];
  strength: number; // 0.0 to 1.0
  lastUpdated: string; // ISO 8601
}

export interface TrustLevel {
  userId: string;
  level: number; // 0.0 to 1.0
  reasoning: string;
  lastUpdated: string; // ISO 8601
}

export interface Goal {
  description: string;
  category?: string;
  status: 'active' | 'completed' | 'abandoned';
  mentionCount: number;
  firstMentioned: string; // ISO 8601
  lastMentioned: string; // ISO 8601
}

export interface PossibleSelf {
  description: string;
  type: 'hoped-for' | 'expected' | 'feared';
  timeframe?: string;
}

export interface TransformationEvent {
  type: 'realization' | 'commitment' | 'acceptance' | 'growth' | 'doubt' | 'resistance';
  description: string;
  timestamp: string; // ISO 8601
}

// ============================================================================
// Synthesis & Learning
// ============================================================================

export interface ConversationSynthesis {
  conversationId: string;
  userId: string;
  synthesisMethod: 'local' | 'haiku' | 'batch' | 'skipped';
  synthesisConfidence: number; // 0.0 to 1.0
  estimatedCostUsd: number;
  synthesisTime: number; // milliseconds

  emotionalTags: string[];
  emotionalIntensities: number[];
  dominantEmotion?: string;

  goalMentions: string[];
  topics: string[];
  transformationEvents: string[];

  attachmentSignals: {
    type: string;
    strength: number;
  }[];
  vulnerability: string[];

  synthesizedAt: string; // ISO 8601
  isSignificant: boolean;
  wasSkipped: boolean;
}

// ============================================================================
// API Requests & Responses
// ============================================================================

export interface SendMessageRequest {
  content: string;
  sessionKey: string;
  clientId?: string; // Idempotency key
  metadata?: Record<string, unknown>;
}

export interface SendMessageResponse {
  message: Message;
  queued: boolean; // True if stored locally (offline)
  syncedAt?: string; // ISO 8601
}

export interface LoadConversationRequest {
  sessionKey: string;
  limit?: number; // Max messages to load (default: 50)
  offset?: number; // For pagination
}

export interface LoadConversationResponse {
  conversation: Conversation;
  messages: Message[];
  hasMore: boolean; // More messages available
}

export interface SyncQueueRequest {
  deviceId: string;
  platform: 'web' | 'desktop' | 'ios' | 'android';
}

export interface SyncQueueResponse {
  synced: number;
  failed: number;
  pendingMessages: Message[];
  errors: Array<{
    messageId: string;
    error: string;
  }>;
}

// ============================================================================
// Error Types
// ============================================================================

export interface HelixError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string; // ISO 8601
}

export enum ErrorCode {
  // Network
  OFFLINE = 'OFFLINE',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  CONNECTION_FAILED = 'CONNECTION_FAILED',

  // Authentication
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  // Message
  MESSAGE_NOT_FOUND = 'MESSAGE_NOT_FOUND',
  MESSAGE_INVALID = 'MESSAGE_INVALID',
  MESSAGE_TOO_LARGE = 'MESSAGE_TOO_LARGE',
  DUPLICATE_MESSAGE = 'DUPLICATE_MESSAGE',

  // Conversation
  CONVERSATION_NOT_FOUND = 'CONVERSATION_NOT_FOUND',
  CONVERSATION_ARCHIVED = 'CONVERSATION_ARCHIVED',

  // Sync
  SYNC_FAILED = 'SYNC_FAILED',
  QUEUE_FULL = 'QUEUE_FULL',
  SYNC_CONFLICT = 'SYNC_CONFLICT',

  // Server
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMITED = 'RATE_LIMITED',
}

// ============================================================================
// Utility Types
// ============================================================================

export interface PagedResponse<T> {
  items: T[];
  pageInfo: {
    hasMore: boolean;
    totalCount: number;
    limit: number;
    offset: number;
  };
}

export interface BatchResponse<T> {
  successful: T[];
  failed: Array<{
    item: T;
    error: string;
  }>;
}

export type Maybe<T> = T | null | undefined;
export type Timestamp = string; // ISO 8601
export type UUID = string;

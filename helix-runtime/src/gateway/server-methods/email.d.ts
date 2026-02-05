/**
 * Email Gateway RPC Methods
 *
 * This module implements 14 RPC methods for email integration:
 * - email.add_account: Add a new email account (Gmail, Outlook, etc.)
 * - email.get_accounts: List all email accounts for a user
 * - email.remove_account: Remove an email account
 * - email.sync_inbox: Trigger inbox sync (incremental or full)
 * - email.get_sync_status: Get current sync status
 * - email.get_conversations: Get email conversations with pagination
 * - email.search_conversations: Search conversations by query
 * - email.get_conversation: Get a single conversation with all messages
 * - email.send_message: Send a new email message
 * - email.mark_read: Mark conversation as read/unread
 * - email.star_conversation: Star/unstar a conversation
 * - email.delete_conversation: Delete a conversation
 * - email.get_attachment: Get attachment metadata
 * - email.preview_attachment: Get attachment preview data
 */
import type { GatewayRequestHandlers } from "./types.js";
interface EmailAccount {
    id: string;
    userId: string;
    email: string;
    provider: "gmail" | "outlook" | "yahoo" | "custom_imap";
    authType: "oauth" | "keyring";
    isActive: boolean;
    syncState: {
        lastSyncTime: number | null;
        highestModSeq: number | null;
        uidValidity: number | null;
        syncPointer: string | null;
    };
    messageCount: number;
    createdAt: number;
    updatedAt: number;
}
interface EmailConversation {
    id: string;
    accountId: string;
    userId: string;
    threadId: string;
    subject: string;
    participants: Array<{
        name?: string;
        email: string;
    }>;
    lastMessageAt: number;
    isRead: boolean;
    isStarred: boolean;
    isArchived: boolean;
    labels: string[];
    messageCount: number;
    hasAttachments: boolean;
    synthesisAnalyzed: boolean;
    createdAt: number;
    updatedAt: number;
}
interface EmailMessage {
    id: string;
    conversationId: string;
    accountId: string;
    messageId: string;
    inReplyTo: string | null;
    references: string[];
    fromEmail: string;
    fromName: string | null;
    toEmails: string[];
    ccEmails: string[];
    bccEmails: string[];
    subject: string;
    bodyPlain: string;
    bodyHtml: string | null;
    receivedAt: number;
    flags: Record<string, boolean>;
    sizeBytes: number;
    createdAt: number;
}
interface EmailAttachment {
    id: string;
    messageId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    filePath: string | null;
    extractedText: string | null;
    extractionStatus: "pending" | "completed" | "failed";
    createdAt: number;
}
interface SyncJob {
    id: string;
    accountId: string;
    syncType: "incremental" | "full";
    status: "pending" | "running" | "completed" | "failed";
    progress: number;
    messagesSynced: number;
    conversationsCreated: number;
    conversationsUpdated: number;
    startedAt: number;
    completedAt: number | null;
    errorMessage: string | null;
}
export declare const emailHandlers: GatewayRequestHandlers;
export declare function __resetEmailStoreForTest(): void;
export declare function __getEmailStoreForTest(): {
    accounts: Map<string, EmailAccount>;
    conversations: Map<string, EmailConversation>;
    messages: Map<string, EmailMessage>;
    attachments: Map<string, EmailAttachment>;
    syncJobs: Map<string, SyncJob>;
};
export declare function __seedEmailAccountForTest(account: Partial<EmailAccount> & {
    id: string;
    userId: string;
    email: string;
}): EmailAccount;
export declare function __seedEmailConversationForTest(conversation: Partial<EmailConversation> & {
    id: string;
    accountId: string;
    userId: string;
}): EmailConversation;
export declare function __seedEmailMessageForTest(message: Partial<EmailMessage> & {
    id: string;
    conversationId: string;
    accountId: string;
}): EmailMessage;
export declare function __seedEmailAttachmentForTest(attachment: Partial<EmailAttachment> & {
    id: string;
    messageId: string;
}): EmailAttachment;
export {};
//# sourceMappingURL=email.d.ts.map
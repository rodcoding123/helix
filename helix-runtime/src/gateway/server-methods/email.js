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
import { randomUUID } from "node:crypto";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { OperationContext, executeWithCostTracking } from "../ai-operation-integration.js";
// ============================================================================
// In-Memory Storage (for testing - will be replaced with Supabase)
// ============================================================================
const emailAccounts = new Map();
const emailConversations = new Map();
const emailMessages = new Map();
const emailAttachments = new Map();
const syncJobs = new Map();
// ============================================================================
// Helper Functions
// ============================================================================
function validateRequiredParams(params, required) {
    const missing = required.filter((key) => params[key] === undefined || params[key] === null || params[key] === "");
    if (missing.length > 0) {
        return { valid: false, missing };
    }
    return { valid: true };
}
function getAccountsByUser(userId) {
    return Array.from(emailAccounts.values()).filter((account) => account.userId === userId && account.isActive);
}
function getConversationsByAccount(accountId, options = {}) {
    const { limit = 50, offset = 0, includeRead = true, labels } = options;
    let conversations = Array.from(emailConversations.values()).filter((conv) => conv.accountId === accountId);
    if (!includeRead) {
        conversations = conversations.filter((conv) => !conv.isRead);
    }
    if (labels && labels.length > 0) {
        conversations = conversations.filter((conv) => labels.some((label) => conv.labels.includes(label)));
    }
    conversations.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    return conversations.slice(offset, offset + limit);
}
function searchConversations(accountId, query, options = {}) {
    const { from, after, before, limit = 50 } = options;
    const queryLower = query.toLowerCase();
    let conversations = Array.from(emailConversations.values()).filter((conv) => conv.accountId === accountId);
    // Text search on subject and participants
    conversations = conversations.filter((conv) => {
        const subjectMatch = conv.subject.toLowerCase().includes(queryLower);
        const participantMatch = conv.participants.some((p) => p.email.toLowerCase().includes(queryLower) ||
            (p.name && p.name.toLowerCase().includes(queryLower)));
        return subjectMatch || participantMatch;
    });
    // Filter by sender
    if (from) {
        conversations = conversations.filter((conv) => conv.participants.some((p) => p.email.toLowerCase() === from.toLowerCase()));
    }
    // Filter by date range
    if (after) {
        const afterDate = new Date(after).getTime();
        conversations = conversations.filter((conv) => conv.lastMessageAt >= afterDate);
    }
    if (before) {
        const beforeDate = new Date(before).getTime();
        conversations = conversations.filter((conv) => conv.lastMessageAt <= beforeDate);
    }
    conversations.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    return conversations.slice(0, limit);
}
function getMessagesByConversation(conversationId) {
    return Array.from(emailMessages.values())
        .filter((msg) => msg.conversationId === conversationId)
        .sort((a, b) => a.receivedAt - b.receivedAt);
}
async function performBackgroundSync(accountId, syncType, daysToSync) {
    const jobId = randomUUID();
    const now = Date.now();
    const job = {
        id: jobId,
        accountId,
        syncType,
        status: "running",
        progress: 0,
        messagesSynced: 0,
        conversationsCreated: 0,
        conversationsUpdated: 0,
        startedAt: now,
        completedAt: null,
        errorMessage: null,
    };
    syncJobs.set(jobId, job);
    // Simulate background sync (in real implementation, this would connect to IMAP/OAuth)
    setTimeout(() => {
        const completedJob = syncJobs.get(jobId);
        if (completedJob) {
            completedJob.status = "completed";
            completedJob.progress = 100;
            completedJob.messagesSynced = Math.floor(Math.random() * 100) + 10;
            completedJob.conversationsCreated = Math.floor(Math.random() * 20) + 1;
            completedJob.conversationsUpdated = Math.floor(Math.random() * 10);
            completedJob.completedAt = Date.now();
            // Update account sync state
            const account = emailAccounts.get(accountId);
            if (account) {
                account.syncState.lastSyncTime = Date.now();
                account.updatedAt = Date.now();
            }
        }
    }, 2000);
}
// ============================================================================
// RPC Handlers
// ============================================================================
export const emailHandlers = {
    /**
     * Add a new email account
     */
    "email.add_account": async ({ params, respond }) => {
        const validation = validateRequiredParams(params, ["userId", "email", "provider", "authType"]);
        if (!validation.valid) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, `Missing required parameters: ${validation.missing.join(", ")}`));
            return;
        }
        const { userId, email, provider, authType, oauthToken, imapConfig } = params;
        // Validate authType matches requirements
        if (authType === "oauth" && !oauthToken) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "OAuth token required for OAuth authentication"));
            return;
        }
        if (authType === "keyring" && !imapConfig) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "IMAP config required for keyring authentication"));
            return;
        }
        // Check for duplicate account
        const existingAccount = Array.from(emailAccounts.values()).find((acc) => acc.userId === userId && acc.email === email && acc.isActive);
        if (existingAccount) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, `Account ${email} already exists`));
            return;
        }
        const now = Date.now();
        const accountId = randomUUID();
        const account = {
            id: accountId,
            userId,
            email,
            provider,
            authType,
            isActive: true,
            syncState: {
                lastSyncTime: null,
                highestModSeq: null,
                uidValidity: null,
                syncPointer: null,
            },
            messageCount: 0,
            createdAt: now,
            updatedAt: now,
        };
        emailAccounts.set(accountId, account);
        respond(true, {
            accountId,
            email,
            isActive: true,
            syncStatus: "pending",
        });
    },
    /**
     * Get all email accounts for a user
     */
    "email.get_accounts": async ({ params, respond }) => {
        const { userId } = params;
        if (!userId) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "userId is required"));
            return;
        }
        const accounts = getAccountsByUser(userId).map((acc) => ({
            id: acc.id,
            email: acc.email,
            provider: acc.provider,
            isActive: acc.isActive,
            lastSyncAt: acc.syncState.lastSyncTime,
            messageCount: acc.messageCount,
        }));
        respond(true, accounts);
    },
    /**
     * Remove an email account
     */
    "email.remove_account": async ({ params, respond }) => {
        const { accountId, userId } = params;
        const validation = validateRequiredParams(params, ["accountId", "userId"]);
        if (!validation.valid) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, `Missing required parameters: ${validation.missing.join(", ")}`));
            return;
        }
        const account = emailAccounts.get(accountId);
        if (!account || account.userId !== userId) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Account not found or unauthorized"));
            return;
        }
        // Delete account and cascade to conversations/messages
        emailAccounts.delete(accountId);
        // Delete related conversations
        for (const [convId, conv] of emailConversations) {
            if (conv.accountId === accountId) {
                emailConversations.delete(convId);
                // Delete related messages
                for (const [msgId, msg] of emailMessages) {
                    if (msg.conversationId === convId) {
                        emailMessages.delete(msgId);
                        // Delete related attachments
                        for (const [attId, att] of emailAttachments) {
                            if (att.messageId === msgId) {
                                emailAttachments.delete(attId);
                            }
                        }
                    }
                }
            }
        }
        respond(true, { ok: true });
    },
    /**
     * Trigger inbox sync
     */
    "email.sync_inbox": async ({ params, respond }) => {
        const { accountId, syncType = "incremental", daysToSync = 7 } = params;
        if (!accountId) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "accountId is required"));
            return;
        }
        const account = emailAccounts.get(accountId);
        if (!account) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Account not found"));
            return;
        }
        const syncJobId = randomUUID();
        // Queue background sync
        setImmediate(() => {
            performBackgroundSync(accountId, syncType, daysToSync);
        });
        respond(true, {
            syncJobId,
            status: "queued",
            estimatedMessages: 150,
        });
    },
    /**
     * Get sync status for an account
     */
    "email.get_sync_status": async ({ params, respond }) => {
        const { accountId } = params;
        if (!accountId) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "accountId is required"));
            return;
        }
        // Find most recent sync job for this account
        const jobs = Array.from(syncJobs.values())
            .filter((job) => job.accountId === accountId)
            .sort((a, b) => b.startedAt - a.startedAt);
        const latestJob = jobs[0];
        if (!latestJob) {
            respond(true, {
                status: "idle",
                progress: 0,
                messagesSynced: 0,
                nextSyncAt: Date.now() + 5 * 60 * 1000,
            });
            return;
        }
        const account = emailAccounts.get(accountId);
        const syncInterval = 5 * 60 * 1000; // 5 minutes
        respond(true, {
            status: latestJob.status === "running" ? "syncing" : latestJob.status,
            progress: latestJob.progress,
            messagesSynced: latestJob.messagesSynced,
            nextSyncAt: account?.syncState.lastSyncTime
                ? account.syncState.lastSyncTime + syncInterval
                : Date.now() + syncInterval,
            lastError: latestJob.errorMessage,
        });
    },
    /**
     * Get conversations for an account
     */
    "email.get_conversations": async ({ params, respond }) => {
        const { accountId, limit = 50, offset = 0, includeRead = true, labels } = params;
        if (!accountId) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "accountId is required"));
            return;
        }
        const conversations = getConversationsByAccount(accountId, {
            limit,
            offset,
            includeRead,
            labels,
        });
        respond(true, conversations);
    },
    /**
     * Search conversations
     */
    "email.search_conversations": async ({ params, respond }) => {
        const { accountId, query, from, to, after, before, limit = 50 } = params;
        const validation = validateRequiredParams(params, ["accountId", "query"]);
        if (!validation.valid) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, `Missing required parameters: ${validation.missing.join(", ")}`));
            return;
        }
        const conversations = searchConversations(accountId, query, {
            from,
            to,
            after,
            before,
            limit,
        });
        respond(true, conversations);
    },
    /**
     * Get a single conversation with all messages
     */
    "email.get_conversation": async ({ params, respond }) => {
        const { conversationId } = params;
        if (!conversationId) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "conversationId is required"));
            return;
        }
        const conversation = emailConversations.get(conversationId);
        if (!conversation) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Conversation not found"));
            return;
        }
        const messages = getMessagesByConversation(conversationId);
        respond(true, {
            ...conversation,
            messages,
        });
    },
    /**
     * Send a new email message
     */
    "email.send_message": async ({ params, respond }) => {
        const { accountId, to, cc, bcc, subject, bodyPlain, bodyHtml, inReplyTo } = params;
        const validation = validateRequiredParams(params, ["accountId", "to", "subject", "bodyPlain"]);
        if (!validation.valid) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, `Missing required parameters: ${validation.missing.join(", ")}`));
            return;
        }
        const account = emailAccounts.get(accountId);
        if (!account) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Account not found"));
            return;
        }
        // Create operation context for cost tracking
        const opContext = new OperationContext("email.send_message", "email_send", account.userId);
        try {
            // Execute with cost tracking
            await executeWithCostTracking(opContext, async () => {
                const now = Date.now();
                const messageId = `<${randomUUID()}@helix.local>`;
                const msgUuid = randomUUID();
                // Create or find conversation
                let conversationId;
                let conversation;
                if (inReplyTo) {
                    conversation = emailConversations.get(inReplyTo);
                    if (conversation) {
                        conversationId = conversation.id;
                        conversation.messageCount += 1;
                        conversation.lastMessageAt = now;
                        conversation.updatedAt = now;
                    }
                    else {
                        conversationId = randomUUID();
                    }
                }
                else {
                    conversationId = randomUUID();
                }
                // Create new conversation if needed
                if (!conversation) {
                    const newConversation = {
                        id: conversationId,
                        accountId,
                        userId: account.userId,
                        threadId: randomUUID(),
                        subject,
                        participants: to.map((email) => ({ email })),
                        lastMessageAt: now,
                        isRead: true,
                        isStarred: false,
                        isArchived: false,
                        labels: ["sent"],
                        messageCount: 1,
                        hasAttachments: false,
                        synthesisAnalyzed: false,
                        createdAt: now,
                        updatedAt: now,
                    };
                    emailConversations.set(conversationId, newConversation);
                }
                // Create message
                const message = {
                    id: msgUuid,
                    conversationId,
                    accountId,
                    messageId,
                    inReplyTo: inReplyTo || null,
                    references: [],
                    fromEmail: account.email,
                    fromName: null,
                    toEmails: to,
                    ccEmails: cc || [],
                    bccEmails: bcc || [],
                    subject,
                    bodyPlain,
                    bodyHtml: bodyHtml || null,
                    receivedAt: now,
                    flags: { seen: true, sent: true },
                    sizeBytes: bodyPlain.length + (bodyHtml?.length || 0),
                    createdAt: now,
                };
                emailMessages.set(msgUuid, message);
                // Track cost (MEDIUM cost operation)
                opContext.costUsd = 0.001;
                return {
                    messageId,
                    threadId: conversationId,
                    sentAt: now,
                    status: "sent",
                };
            });
            // Respond after operation completes
            respond(true, {
                messageId: `<${randomUUID()}@helix.local>`,
                status: "sent",
            });
        }
        catch (error) {
            respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, error instanceof Error ? error.message : String(error)));
        }
    },
    /**
     * Mark conversation as read/unread
     */
    "email.mark_read": async ({ params, respond }) => {
        const { conversationId, isRead } = params;
        const validation = validateRequiredParams(params, ["conversationId"]);
        if (!validation.valid) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, `Missing required parameters: ${validation.missing.join(", ")}`));
            return;
        }
        if (typeof isRead !== "boolean") {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "isRead must be a boolean"));
            return;
        }
        const conversation = emailConversations.get(conversationId);
        if (!conversation) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Conversation not found"));
            return;
        }
        conversation.isRead = isRead;
        conversation.updatedAt = Date.now();
        respond(true, { ok: true });
    },
    /**
     * Star/unstar a conversation
     */
    "email.star_conversation": async ({ params, respond }) => {
        const { conversationId, isStarred } = params;
        const validation = validateRequiredParams(params, ["conversationId"]);
        if (!validation.valid) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, `Missing required parameters: ${validation.missing.join(", ")}`));
            return;
        }
        if (typeof isStarred !== "boolean") {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "isStarred must be a boolean"));
            return;
        }
        const conversation = emailConversations.get(conversationId);
        if (!conversation) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Conversation not found"));
            return;
        }
        conversation.isStarred = isStarred;
        conversation.updatedAt = Date.now();
        respond(true, { ok: true });
    },
    /**
     * Delete a conversation
     */
    "email.delete_conversation": async ({ params, respond }) => {
        const { conversationId } = params;
        if (!conversationId) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "conversationId is required"));
            return;
        }
        const conversation = emailConversations.get(conversationId);
        if (!conversation) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Conversation not found"));
            return;
        }
        // Delete conversation and cascade to messages
        emailConversations.delete(conversationId);
        for (const [msgId, msg] of emailMessages) {
            if (msg.conversationId === conversationId) {
                emailMessages.delete(msgId);
                // Delete related attachments
                for (const [attId, att] of emailAttachments) {
                    if (att.messageId === msgId) {
                        emailAttachments.delete(attId);
                    }
                }
            }
        }
        respond(true, { ok: true });
    },
    /**
     * Get attachment metadata
     */
    "email.get_attachment": async ({ params, respond }) => {
        const { attachmentId } = params;
        if (!attachmentId) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "attachmentId is required"));
            return;
        }
        const attachment = emailAttachments.get(attachmentId);
        if (!attachment) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Attachment not found"));
            return;
        }
        respond(true, attachment);
    },
    /**
     * Get attachment preview data
     */
    "email.preview_attachment": async ({ params, respond }) => {
        const { attachmentId } = params;
        if (!attachmentId) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "attachmentId is required"));
            return;
        }
        const attachment = emailAttachments.get(attachmentId);
        if (!attachment) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Attachment not found"));
            return;
        }
        respond(true, {
            mimeType: attachment.mimeType,
            previewUrl: attachment.filePath ? `file://${attachment.filePath}` : null,
            width: 800,
            height: 600,
        });
    },
};
// ============================================================================
// Test Helpers (exported for testing)
// ============================================================================
export function __resetEmailStoreForTest() {
    emailAccounts.clear();
    emailConversations.clear();
    emailMessages.clear();
    emailAttachments.clear();
    syncJobs.clear();
}
export function __getEmailStoreForTest() {
    return {
        accounts: emailAccounts,
        conversations: emailConversations,
        messages: emailMessages,
        attachments: emailAttachments,
        syncJobs,
    };
}
export function __seedEmailAccountForTest(account) {
    const now = Date.now();
    const fullAccount = {
        provider: "gmail",
        authType: "oauth",
        isActive: true,
        syncState: {
            lastSyncTime: null,
            highestModSeq: null,
            uidValidity: null,
            syncPointer: null,
        },
        messageCount: 0,
        createdAt: now,
        updatedAt: now,
        ...account,
    };
    emailAccounts.set(fullAccount.id, fullAccount);
    return fullAccount;
}
export function __seedEmailConversationForTest(conversation) {
    const now = Date.now();
    const fullConversation = {
        threadId: randomUUID(),
        subject: "Test Subject",
        participants: [],
        lastMessageAt: now,
        isRead: false,
        isStarred: false,
        isArchived: false,
        labels: [],
        messageCount: 0,
        hasAttachments: false,
        synthesisAnalyzed: false,
        createdAt: now,
        updatedAt: now,
        ...conversation,
    };
    emailConversations.set(fullConversation.id, fullConversation);
    return fullConversation;
}
export function __seedEmailMessageForTest(message) {
    const now = Date.now();
    const fullMessage = {
        messageId: `<${randomUUID()}@test.local>`,
        inReplyTo: null,
        references: [],
        fromEmail: "test@example.com",
        fromName: null,
        toEmails: [],
        ccEmails: [],
        bccEmails: [],
        subject: "Test Subject",
        bodyPlain: "Test body",
        bodyHtml: null,
        receivedAt: now,
        flags: {},
        sizeBytes: 100,
        createdAt: now,
        ...message,
    };
    emailMessages.set(fullMessage.id, fullMessage);
    return fullMessage;
}
export function __seedEmailAttachmentForTest(attachment) {
    const now = Date.now();
    const fullAttachment = {
        filename: "test.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        filePath: null,
        extractedText: null,
        extractionStatus: "pending",
        createdAt: now,
        ...attachment,
    };
    emailAttachments.set(fullAttachment.id, fullAttachment);
    return fullAttachment;
}
//# sourceMappingURL=email.js.map
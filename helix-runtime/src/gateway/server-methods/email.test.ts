/**
 * Email RPC Integration Tests
 *
 * Tests for the 14 email RPC methods:
 * - Account management (4 tests)
 * - Sync operations (3 tests)
 * - Email threading (4 tests)
 * - Message operations (4 tests)
 *
 * Total: 15 tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  emailHandlers,
  __resetEmailStoreForTest,
  __getEmailStoreForTest,
  __seedEmailAccountForTest,
  __seedEmailConversationForTest,
  __seedEmailMessageForTest,
  __seedEmailAttachmentForTest,
} from "./email.js";
import type { GatewayRequestHandlerOptions } from "./types.js";

// ============================================================================
// Test Utilities
// ============================================================================

function createMockHandlerOptions(
  method: string,
  params: Record<string, unknown>,
): {
  opts: GatewayRequestHandlerOptions;
  getResult: () => { ok: boolean; payload?: unknown; error?: unknown };
} {
  let result: { ok: boolean; payload?: unknown; error?: unknown } = { ok: false };

  const opts: GatewayRequestHandlerOptions = {
    req: { method, id: "test-req-1", params },
    params,
    client: null,
    isWebchatConnect: () => false,
    respond: (ok, payload, error) => {
      result = { ok, payload, error };
    },
    context: {
      deps: {} as any,
      cron: {} as any,
      cronStorePath: "",
      loadGatewayModelCatalog: async () => [],
      getHealthCache: () => null,
      refreshHealthSnapshot: async () => ({} as any),
      logHealth: { error: () => {} },
      logGateway: { info: () => {}, warn: () => {}, error: () => {} } as any,
      incrementPresenceVersion: () => 1,
      getHealthVersion: () => 1,
      broadcast: () => {},
      nodeSendToSession: () => {},
      nodeSendToAllSubscribed: () => {},
      nodeSubscribe: () => {},
      nodeUnsubscribe: () => {},
      nodeUnsubscribeAll: () => {},
      hasConnectedMobileNode: () => false,
      nodeRegistry: {} as any,
      agentRunSeq: new Map(),
      chatAbortControllers: new Map(),
      chatAbortedRuns: new Map(),
      chatRunBuffers: new Map(),
      chatDeltaSentAt: new Map(),
      addChatRun: () => {},
      removeChatRun: () => undefined,
      dedupe: new Map(),
      wizardSessions: new Map(),
      findRunningWizard: () => null,
      purgeWizardSession: () => {},
      getRuntimeSnapshot: () => ({ channels: {} }) as any,
      startChannel: async () => {},
      stopChannel: async () => {},
      markChannelLoggedOut: () => {},
      wizardRunner: async () => {},
      broadcastVoiceWakeChanged: () => {},
    },
  };

  return { opts, getResult: () => result };
}

// ============================================================================
// Account Management Tests
// ============================================================================

describe("Email RPC - Account Management", () => {
  beforeEach(() => {
    __resetEmailStoreForTest();
  });

  it("email.add_account creates a new email account", async () => {
    const { opts, getResult } = createMockHandlerOptions("email.add_account", {
      userId: "user-123",
      email: "test@example.com",
      provider: "gmail",
      authType: "oauth",
      oauthToken: { access_token: "abc", refresh_token: "xyz" },
    });

    await emailHandlers["email.add_account"](opts);
    const result = getResult();

    expect(result.ok).toBe(true);
    expect(result.payload).toMatchObject({
      email: "test@example.com",
      isActive: true,
      syncStatus: "pending",
    });
    expect((result.payload as any).accountId).toBeDefined();
  });

  it("email.add_account rejects duplicate accounts", async () => {
    // Seed an existing account
    __seedEmailAccountForTest({
      id: "acc-1",
      userId: "user-123",
      email: "test@example.com",
    });

    const { opts, getResult } = createMockHandlerOptions("email.add_account", {
      userId: "user-123",
      email: "test@example.com",
      provider: "gmail",
      authType: "oauth",
      oauthToken: { access_token: "abc" },
    });

    await emailHandlers["email.add_account"](opts);
    const result = getResult();

    expect(result.ok).toBe(false);
    expect((result.error as any).message).toContain("already exists");
  });

  it("email.get_accounts returns all accounts for a user", async () => {
    // Seed multiple accounts
    __seedEmailAccountForTest({
      id: "acc-1",
      userId: "user-123",
      email: "personal@example.com",
    });
    __seedEmailAccountForTest({
      id: "acc-2",
      userId: "user-123",
      email: "work@example.com",
    });
    __seedEmailAccountForTest({
      id: "acc-3",
      userId: "other-user",
      email: "other@example.com",
    });

    const { opts, getResult } = createMockHandlerOptions("email.get_accounts", {
      userId: "user-123",
    });

    await emailHandlers["email.get_accounts"](opts);
    const result = getResult();

    expect(result.ok).toBe(true);
    expect(Array.isArray(result.payload)).toBe(true);
    expect((result.payload as any[]).length).toBe(2);
    expect((result.payload as any[]).map((a) => a.email)).toContain("personal@example.com");
    expect((result.payload as any[]).map((a) => a.email)).toContain("work@example.com");
  });

  it("email.remove_account deletes account and cascades to conversations", async () => {
    // Seed account with conversation
    __seedEmailAccountForTest({
      id: "acc-1",
      userId: "user-123",
      email: "test@example.com",
    });
    __seedEmailConversationForTest({
      id: "conv-1",
      accountId: "acc-1",
      userId: "user-123",
    });

    const { opts, getResult } = createMockHandlerOptions("email.remove_account", {
      accountId: "acc-1",
      userId: "user-123",
    });

    await emailHandlers["email.remove_account"](opts);
    const result = getResult();

    expect(result.ok).toBe(true);

    const store = __getEmailStoreForTest();
    expect(store.accounts.has("acc-1")).toBe(false);
    expect(store.conversations.has("conv-1")).toBe(false);
  });
});

// ============================================================================
// Sync Operations Tests
// ============================================================================

describe("Email RPC - Sync Operations", () => {
  beforeEach(() => {
    __resetEmailStoreForTest();
  });

  it("email.sync_inbox queues a sync job", async () => {
    __seedEmailAccountForTest({
      id: "acc-1",
      userId: "user-123",
      email: "test@example.com",
    });

    const { opts, getResult } = createMockHandlerOptions("email.sync_inbox", {
      accountId: "acc-1",
      syncType: "incremental",
      daysToSync: 7,
    });

    await emailHandlers["email.sync_inbox"](opts);
    const result = getResult();

    expect(result.ok).toBe(true);
    expect((result.payload as any).syncJobId).toBeDefined();
    expect((result.payload as any).status).toBe("queued");
  });

  it("email.sync_inbox rejects unknown account", async () => {
    const { opts, getResult } = createMockHandlerOptions("email.sync_inbox", {
      accountId: "nonexistent-acc",
    });

    await emailHandlers["email.sync_inbox"](opts);
    const result = getResult();

    expect(result.ok).toBe(false);
    expect((result.error as any).message).toContain("Account not found");
  });

  it("email.get_sync_status returns idle for new accounts", async () => {
    __seedEmailAccountForTest({
      id: "acc-1",
      userId: "user-123",
      email: "test@example.com",
    });

    const { opts, getResult } = createMockHandlerOptions("email.get_sync_status", {
      accountId: "acc-1",
    });

    await emailHandlers["email.get_sync_status"](opts);
    const result = getResult();

    expect(result.ok).toBe(true);
    expect((result.payload as any).status).toBe("idle");
    expect((result.payload as any).progress).toBe(0);
  });
});

// ============================================================================
// Email Threading Tests
// ============================================================================

describe("Email RPC - Email Threading", () => {
  beforeEach(() => {
    __resetEmailStoreForTest();
  });

  it("email.get_conversations returns conversations sorted by date", async () => {
    __seedEmailAccountForTest({
      id: "acc-1",
      userId: "user-123",
      email: "test@example.com",
    });

    const now = Date.now();
    __seedEmailConversationForTest({
      id: "conv-1",
      accountId: "acc-1",
      userId: "user-123",
      subject: "Older conversation",
      lastMessageAt: now - 1000,
    });
    __seedEmailConversationForTest({
      id: "conv-2",
      accountId: "acc-1",
      userId: "user-123",
      subject: "Newer conversation",
      lastMessageAt: now,
    });

    const { opts, getResult } = createMockHandlerOptions("email.get_conversations", {
      accountId: "acc-1",
      limit: 50,
      offset: 0,
    });

    await emailHandlers["email.get_conversations"](opts);
    const result = getResult();

    expect(result.ok).toBe(true);
    expect((result.payload as any[]).length).toBe(2);
    expect((result.payload as any[])[0].subject).toBe("Newer conversation");
  });

  it("email.get_conversations filters unread only", async () => {
    __seedEmailAccountForTest({
      id: "acc-1",
      userId: "user-123",
      email: "test@example.com",
    });

    __seedEmailConversationForTest({
      id: "conv-1",
      accountId: "acc-1",
      userId: "user-123",
      isRead: true,
    });
    __seedEmailConversationForTest({
      id: "conv-2",
      accountId: "acc-1",
      userId: "user-123",
      isRead: false,
    });

    const { opts, getResult } = createMockHandlerOptions("email.get_conversations", {
      accountId: "acc-1",
      includeRead: false,
    });

    await emailHandlers["email.get_conversations"](opts);
    const result = getResult();

    expect(result.ok).toBe(true);
    expect((result.payload as any[]).length).toBe(1);
    expect((result.payload as any[])[0].id).toBe("conv-2");
  });

  it("email.search_conversations finds by subject", async () => {
    __seedEmailAccountForTest({
      id: "acc-1",
      userId: "user-123",
      email: "test@example.com",
    });

    __seedEmailConversationForTest({
      id: "conv-1",
      accountId: "acc-1",
      userId: "user-123",
      subject: "Project update meeting",
    });
    __seedEmailConversationForTest({
      id: "conv-2",
      accountId: "acc-1",
      userId: "user-123",
      subject: "Invoice for services",
    });

    const { opts, getResult } = createMockHandlerOptions("email.search_conversations", {
      accountId: "acc-1",
      query: "project",
    });

    await emailHandlers["email.search_conversations"](opts);
    const result = getResult();

    expect(result.ok).toBe(true);
    expect((result.payload as any[]).length).toBe(1);
    expect((result.payload as any[])[0].subject).toContain("Project");
  });

  it("email.get_conversation returns conversation with messages", async () => {
    __seedEmailAccountForTest({
      id: "acc-1",
      userId: "user-123",
      email: "test@example.com",
    });

    __seedEmailConversationForTest({
      id: "conv-1",
      accountId: "acc-1",
      userId: "user-123",
      subject: "Test thread",
    });

    __seedEmailMessageForTest({
      id: "msg-1",
      conversationId: "conv-1",
      accountId: "acc-1",
      subject: "Test thread",
      bodyPlain: "First message",
    });
    __seedEmailMessageForTest({
      id: "msg-2",
      conversationId: "conv-1",
      accountId: "acc-1",
      subject: "Re: Test thread",
      bodyPlain: "Reply message",
    });

    const { opts, getResult } = createMockHandlerOptions("email.get_conversation", {
      conversationId: "conv-1",
    });

    await emailHandlers["email.get_conversation"](opts);
    const result = getResult();

    expect(result.ok).toBe(true);
    expect((result.payload as any).subject).toBe("Test thread");
    expect((result.payload as any).messages.length).toBe(2);
  });
});

// ============================================================================
// Message Operations Tests
// ============================================================================

describe("Email RPC - Message Operations", () => {
  beforeEach(() => {
    __resetEmailStoreForTest();
  });

  it("email.send_message creates message and conversation", async () => {
    __seedEmailAccountForTest({
      id: "acc-1",
      userId: "user-123",
      email: "sender@example.com",
    });

    const { opts, getResult } = createMockHandlerOptions("email.send_message", {
      accountId: "acc-1",
      to: ["recipient@example.com"],
      subject: "New message",
      bodyPlain: "Hello, this is a test message.",
    });

    await emailHandlers["email.send_message"](opts);
    const result = getResult();

    expect(result.ok).toBe(true);
    expect((result.payload as any).messageId).toBeDefined();
    expect((result.payload as any).status).toBe("sent");

    const store = __getEmailStoreForTest();
    expect(store.conversations.size).toBe(1);
    expect(store.messages.size).toBe(1);
  });

  it("email.mark_read updates conversation read status", async () => {
    __seedEmailAccountForTest({
      id: "acc-1",
      userId: "user-123",
      email: "test@example.com",
    });

    __seedEmailConversationForTest({
      id: "conv-1",
      accountId: "acc-1",
      userId: "user-123",
      isRead: false,
    });

    const { opts, getResult } = createMockHandlerOptions("email.mark_read", {
      conversationId: "conv-1",
      isRead: true,
    });

    await emailHandlers["email.mark_read"](opts);
    const result = getResult();

    expect(result.ok).toBe(true);

    const store = __getEmailStoreForTest();
    expect(store.conversations.get("conv-1")?.isRead).toBe(true);
  });

  it("email.star_conversation updates starred status", async () => {
    __seedEmailAccountForTest({
      id: "acc-1",
      userId: "user-123",
      email: "test@example.com",
    });

    __seedEmailConversationForTest({
      id: "conv-1",
      accountId: "acc-1",
      userId: "user-123",
      isStarred: false,
    });

    const { opts, getResult } = createMockHandlerOptions("email.star_conversation", {
      conversationId: "conv-1",
      isStarred: true,
    });

    await emailHandlers["email.star_conversation"](opts);
    const result = getResult();

    expect(result.ok).toBe(true);

    const store = __getEmailStoreForTest();
    expect(store.conversations.get("conv-1")?.isStarred).toBe(true);
  });

  it("email.delete_conversation removes conversation and messages", async () => {
    __seedEmailAccountForTest({
      id: "acc-1",
      userId: "user-123",
      email: "test@example.com",
    });

    __seedEmailConversationForTest({
      id: "conv-1",
      accountId: "acc-1",
      userId: "user-123",
    });

    __seedEmailMessageForTest({
      id: "msg-1",
      conversationId: "conv-1",
      accountId: "acc-1",
    });

    const { opts, getResult } = createMockHandlerOptions("email.delete_conversation", {
      conversationId: "conv-1",
    });

    await emailHandlers["email.delete_conversation"](opts);
    const result = getResult();

    expect(result.ok).toBe(true);

    const store = __getEmailStoreForTest();
    expect(store.conversations.has("conv-1")).toBe(false);
    expect(store.messages.has("msg-1")).toBe(false);
  });
});

// ============================================================================
// Attachment Tests
// ============================================================================

describe("Email RPC - Attachments", () => {
  beforeEach(() => {
    __resetEmailStoreForTest();
  });

  it("email.get_attachment returns attachment metadata", async () => {
    __seedEmailAttachmentForTest({
      id: "att-1",
      messageId: "msg-1",
      filename: "document.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });

    const { opts, getResult } = createMockHandlerOptions("email.get_attachment", {
      attachmentId: "att-1",
    });

    await emailHandlers["email.get_attachment"](opts);
    const result = getResult();

    expect(result.ok).toBe(true);
    expect((result.payload as any).filename).toBe("document.pdf");
    expect((result.payload as any).mimeType).toBe("application/pdf");
  });

  it("email.preview_attachment returns preview data", async () => {
    __seedEmailAttachmentForTest({
      id: "att-1",
      messageId: "msg-1",
      filename: "image.png",
      mimeType: "image/png",
      filePath: "/tmp/image.png",
    });

    const { opts, getResult } = createMockHandlerOptions("email.preview_attachment", {
      attachmentId: "att-1",
    });

    await emailHandlers["email.preview_attachment"](opts);
    const result = getResult();

    expect(result.ok).toBe(true);
    expect((result.payload as any).mimeType).toBe("image/png");
    expect((result.payload as any).previewUrl).toBe("file:///tmp/image.png");
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe("Email RPC - Error Handling", () => {
  beforeEach(() => {
    __resetEmailStoreForTest();
  });

  it("returns error for missing required parameters", async () => {
    const { opts, getResult } = createMockHandlerOptions("email.add_account", {
      userId: "user-123",
      // Missing email, provider, authType
    });

    await emailHandlers["email.add_account"](opts);
    const result = getResult();

    expect(result.ok).toBe(false);
    expect((result.error as any).message).toContain("Missing required parameters");
  });

  it("returns error for non-existent resources", async () => {
    const { opts, getResult } = createMockHandlerOptions("email.get_conversation", {
      conversationId: "nonexistent-conv",
    });

    await emailHandlers["email.get_conversation"](opts);
    const result = getResult();

    expect(result.ok).toBe(false);
    expect((result.error as any).message).toContain("Conversation not found");
  });
});

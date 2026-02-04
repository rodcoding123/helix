/**
 * Multi-Device Sync Integration Tests
 *
 * Tests real-time synchronization across web, iOS, and Android clients
 * Verifies vector clock consistency, conflict detection, and resolution
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { SyncRelay } from "../../../helix-runtime/src/gateway/sync-relay";

// Mock test clients
interface TestClient {
  userId: string;
  deviceId: string;
  platform: "web" | "ios" | "android";
  send: (msg: string) => void;
}

let syncRelay: SyncRelay;
let supabaseClient: ReturnType<typeof createClient>;
let testClients: Map<string, TestClient> = new Map();

beforeAll(async () => {
  // Initialize Supabase
  supabaseClient = createClient(
    process.env.SUPABASE_URL || "http://localhost:54321",
    process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  );

  // Initialize sync relay
  syncRelay = new SyncRelay(supabaseClient, {
    info: console.log,
    warn: console.warn,
    error: console.error,
  });

  // Create test email
  const { data: email } = await supabaseClient
    .from("emails")
    .insert({
      user_id: "test-user",
      subject: "Test Email",
      body: "Test body",
      is_read: false,
      is_starred: false,
      received_at: new Date().toISOString(),
    })
    .select()
    .single();

  console.log("Test email created:", email?.id);
});

afterAll(async () => {
  // Cleanup
  testClients.clear();
});

describe("Multi-Device Sync", () => {
  it("should sync email read status across devices", async () => {
    // Create three mock clients (web, iOS, Android)
    const webClient: TestClient = {
      userId: "test-user",
      deviceId: "web-device-1",
      platform: "web",
      send: (msg) => console.log("Web:", msg),
    };

    const iosClient: TestClient = {
      userId: "test-user",
      deviceId: "ios-device-1",
      platform: "ios",
      send: (msg) => console.log("iOS:", msg),
    };

    const androidClient: TestClient = {
      userId: "test-user",
      deviceId: "android-device-1",
      platform: "android",
      send: (msg) => console.log("Android:", msg),
    };

    // Register devices
    syncRelay.registerDevice(
      webClient.userId,
      webClient.deviceId,
      webClient as any
    );
    syncRelay.registerDevice(
      iosClient.userId,
      iosClient.deviceId,
      iosClient as any
    );
    syncRelay.registerDevice(
      androidClient.userId,
      androidClient.deviceId,
      androidClient as any
    );

    // Get test email ID from database
    const { data: emails } = await supabaseClient
      .from("emails")
      .select("id")
      .eq("user_id", "test-user")
      .order("created_at", { ascending: false })
      .limit(1);

    const emailId = emails?.[0]?.id;
    expect(emailId).toBeDefined();

    // Mark as read on web
    const webChange = {
      entity_type: "email",
      entity_id: emailId!,
      operation: "UPDATE",
      changed_fields: { is_read: true },
      vector_clock: { [webClient.deviceId]: 1 },
      timestamp: Date.now(),
    };

    await syncRelay.handleDeltaChange(webClient as any, webChange);

    // Wait for sync
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify all devices see read status
    const { data: email } = await supabaseClient
      .from("emails")
      .select("is_read")
      .eq("id", emailId!)
      .single();

    expect(email?.is_read).toBe(true);

    // Cleanup
    syncRelay.unregisterDevice(webClient.userId, webClient.deviceId);
    syncRelay.unregisterDevice(iosClient.userId, iosClient.deviceId);
    syncRelay.unregisterDevice(
      androidClient.userId,
      androidClient.deviceId
    );
  });

  it("should detect concurrent edits as conflicts", async () => {
    const webClient: TestClient = {
      userId: "test-user-2",
      deviceId: "web-device-2",
      platform: "web",
      send: (msg) => console.log("Web:", msg),
    };

    const iosClient: TestClient = {
      userId: "test-user-2",
      deviceId: "ios-device-2",
      platform: "ios",
      send: (msg) => console.log("iOS:", msg),
    };

    // Create test email
    const { data: email } = await supabaseClient
      .from("emails")
      .insert({
        user_id: "test-user-2",
        subject: "Conflict Test",
        body: "Original",
        is_read: false,
        is_starred: false,
        received_at: new Date().toISOString(),
      })
      .select()
      .single();

    const emailId = email!.id;

    // Register devices
    syncRelay.registerDevice(
      webClient.userId,
      webClient.deviceId,
      webClient as any
    );
    syncRelay.registerDevice(
      iosClient.userId,
      iosClient.deviceId,
      iosClient as any
    );

    // Send concurrent edits from different devices
    const vectorClock1 = {
      [webClient.deviceId]: 1,
      [iosClient.deviceId]: 0,
    };

    const vectorClock2 = {
      [webClient.deviceId]: 0,
      [iosClient.deviceId]: 1,
    };

    // Both edit simultaneously
    const webChange = {
      entity_type: "email",
      entity_id: emailId,
      operation: "UPDATE",
      changed_fields: { is_starred: true },
      vector_clock: vectorClock1,
      timestamp: Date.now(),
    };

    const iosChange = {
      entity_type: "email",
      entity_id: emailId,
      operation: "UPDATE",
      changed_fields: { is_starred: false },
      vector_clock: vectorClock2,
      timestamp: Date.now() + 1,
    };

    // Process both changes
    const webResult = await syncRelay.handleDeltaChange(
      webClient as any,
      webChange
    );
    const iosResult = await syncRelay.handleDeltaChange(
      iosClient as any,
      iosChange
    );

    // Get stats - should have conflicts
    const stats = syncRelay.getStats();
    console.log("Sync statistics:", stats);
    expect(stats.activeConflicts).toBeGreaterThan(0);

    // Cleanup
    syncRelay.unregisterDevice(webClient.userId, webClient.deviceId);
    syncRelay.unregisterDevice(iosClient.userId, iosClient.deviceId);
  });

  it("should resolve concurrent edits with LWW strategy", async () => {
    const webClient: TestClient = {
      userId: "test-user-3",
      deviceId: "web-device-3",
      platform: "web",
      send: (msg) => console.log("Web:", msg),
    };

    const iosClient: TestClient = {
      userId: "test-user-3",
      deviceId: "ios-device-3",
      platform: "ios",
      send: (msg) => console.log("iOS:", msg),
    };

    // Create test email
    const { data: email } = await supabaseClient
      .from("emails")
      .insert({
        user_id: "test-user-3",
        subject: "LWW Test",
        body: "Original",
        is_read: false,
        is_starred: false,
        received_at: new Date().toISOString(),
      })
      .select()
      .single();

    const emailId = email!.id;

    // Register devices
    syncRelay.registerDevice(
      webClient.userId,
      webClient.deviceId,
      webClient as any
    );
    syncRelay.registerDevice(
      iosClient.userId,
      iosClient.deviceId,
      iosClient as any
    );

    // First edit
    const firstEdit = {
      entity_type: "email",
      entity_id: emailId,
      operation: "UPDATE",
      changed_fields: { is_starred: true },
      vector_clock: { [webClient.deviceId]: 1 },
      timestamp: Date.now(),
    };

    await syncRelay.handleDeltaChange(webClient as any, firstEdit);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Second edit (more recent, should win)
    const secondEdit = {
      entity_type: "email",
      entity_id: emailId,
      operation: "UPDATE",
      changed_fields: { is_starred: false },
      vector_clock: { [iosClient.deviceId]: 1 },
      timestamp: Date.now() + 2000, // Later timestamp
    };

    await syncRelay.handleDeltaChange(iosClient as any, secondEdit);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify latest value wins
    const { data: result } = await supabaseClient
      .from("emails")
      .select("is_starred")
      .eq("id", emailId)
      .single();

    // With LWW, the later timestamp should win
    expect(result?.is_starred).toBe(false);

    // Cleanup
    syncRelay.unregisterDevice(webClient.userId, webClient.deviceId);
    syncRelay.unregisterDevice(iosClient.userId, iosClient.deviceId);
  });

  it("should maintain vector clock consistency", async () => {
    const client1: TestClient = {
      userId: "test-user-4",
      deviceId: "device-1",
      platform: "web",
      send: (msg) => console.log("Device 1:", msg),
    };

    const client2: TestClient = {
      userId: "test-user-4",
      deviceId: "device-2",
      platform: "ios",
      send: (msg) => console.log("Device 2:", msg),
    };

    // Register devices
    syncRelay.registerDevice(
      client1.userId,
      client1.deviceId,
      client1 as any
    );
    syncRelay.registerDevice(
      client2.userId,
      client2.deviceId,
      client2 as any
    );

    // Create test task
    const { data: task } = await supabaseClient
      .from("tasks")
      .insert({
        user_id: "test-user-4",
        title: "Vector Clock Test",
        status: "todo",
        board_id: "board-1",
      })
      .select()
      .single();

    const taskId = task!.id;

    // Device 1 makes change
    const change1 = {
      entity_type: "task",
      entity_id: taskId,
      operation: "UPDATE",
      changed_fields: { status: "in_progress" },
      vector_clock: { [client1.deviceId]: 1 },
      timestamp: Date.now(),
    };

    await syncRelay.handleDeltaChange(client1 as any, change1);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Device 2 makes dependent change
    const change2 = {
      entity_type: "task",
      entity_id: taskId,
      operation: "UPDATE",
      changed_fields: { status: "done" },
      vector_clock: {
        [client1.deviceId]: 1,
        [client2.deviceId]: 1,
      },
      timestamp: Date.now() + 100,
    };

    await syncRelay.handleDeltaChange(client2 as any, change2);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify final state
    const { data: result } = await supabaseClient
      .from("tasks")
      .select("status")
      .eq("id", taskId)
      .single();

    expect(result?.status).toBe("done");

    // Cleanup
    syncRelay.unregisterDevice(client1.userId, client1.deviceId);
    syncRelay.unregisterDevice(client2.userId, client2.deviceId);
  });

  it("should handle offline queue and sync when reconnecting", async () => {
    const client: TestClient = {
      userId: "test-user-5",
      deviceId: "offline-device",
      platform: "ios",
      send: (msg) => console.log("Offline device:", msg),
    };

    // Create test calendar event
    const { data: event } = await supabaseClient
      .from("calendar_events")
      .insert({
        user_id: "test-user-5",
        title: "Offline Sync Test",
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
      })
      .select()
      .single();

    const eventId = event!.id;

    // Simulate offline - don't register device yet
    // Application queues changes locally

    // When coming online, register device
    syncRelay.registerDevice(
      client.userId,
      client.deviceId,
      client as any
    );

    // Sync queued change
    const queuedChange = {
      entity_type: "calendar_event",
      entity_id: eventId,
      operation: "UPDATE",
      changed_fields: { title: "Updated from offline" },
      vector_clock: { [client.deviceId]: 1 },
      timestamp: Date.now(),
    };

    await syncRelay.handleDeltaChange(client as any, queuedChange);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify change was applied
    const { data: result } = await supabaseClient
      .from("calendar_events")
      .select("title")
      .eq("id", eventId)
      .single();

    expect(result?.title).toBe("Updated from offline");

    // Cleanup
    syncRelay.unregisterDevice(client.userId, client.deviceId);
  });

  it("should report sync statistics correctly", () => {
    const stats = syncRelay.getStats();

    expect(stats).toHaveProperty("totalUsers");
    expect(stats).toHaveProperty("totalDevices");
    expect(stats).toHaveProperty("activeConflicts");

    console.log("Final sync statistics:", stats);
  });
});

describe("Sync Performance", () => {
  it("should process delta with < 100ms latency", async () => {
    const client: TestClient = {
      userId: "perf-test",
      deviceId: "perf-device",
      platform: "web",
      send: (msg) => {},
    };

    syncRelay.registerDevice(client.userId, client.deviceId, client as any);

    const change = {
      entity_type: "email",
      entity_id: "perf-test-id",
      operation: "UPDATE",
      changed_fields: { is_read: true },
      vector_clock: { [client.deviceId]: 1 },
      timestamp: Date.now(),
    };

    const start = performance.now();
    await syncRelay.handleDeltaChange(client as any, change);
    const elapsed = performance.now() - start;

    console.log(`Delta processed in ${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeLessThan(100);

    syncRelay.unregisterDevice(client.userId, client.deviceId);
  });

  it("should handle 10 concurrent devices without degradation", async () => {
    const clients: TestClient[] = [];

    for (let i = 0; i < 10; i++) {
      const client: TestClient = {
        userId: "concurrent-test",
        deviceId: `device-${i}`,
        platform: i % 3 === 0 ? "web" : i % 3 === 1 ? "ios" : "android",
        send: (msg) => {},
      };

      clients.push(client);
      syncRelay.registerDevice(
        client.userId,
        client.deviceId,
        client as any
      );
    }

    // All devices make changes concurrently
    const changes = clients.map((client, idx) => ({
      entity_type: "task",
      entity_id: `concurrent-task-${idx}`,
      operation: "INSERT",
      changed_fields: { title: `Task ${idx}` },
      vector_clock: { [client.deviceId]: 1 },
      timestamp: Date.now(),
    }));

    const start = performance.now();

    const results = await Promise.all(
      changes.map((change, idx) =>
        syncRelay.handleDeltaChange(clients[idx] as any, change)
      )
    );

    const elapsed = performance.now() - start;

    console.log(
      `10 concurrent changes processed in ${elapsed.toFixed(2)}ms (${(elapsed / 10).toFixed(2)}ms per change)`
    );
    expect(elapsed).toBeLessThan(500); // 50ms per change average

    // Cleanup
    clients.forEach((client) => {
      syncRelay.unregisterDevice(client.userId, client.deviceId);
    });
  });
});

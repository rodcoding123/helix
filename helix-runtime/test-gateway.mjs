#!/usr/bin/env node
/**
 * Minimal test gateway server for verifying web UI connection.
 * Speaks the OpenClaw JSON-RPC 2.0 WebSocket protocol.
 *
 * Usage: node test-gateway.mjs [port]
 * Default port: 18789
 */

import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";

const PORT = parseInt(process.argv[2] || "18789", 10);
const BIND = "127.0.0.1";

// HTTP server for health checks
const httpServer = createServer((req, res) => {
  if (req.url === "/health" || req.url === "/v1/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", server: "helix-test-gateway", version: "0.1.0" }));
    return;
  }
  if (req.url === "/rpc" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const rpc = JSON.parse(body);
        console.log("[rpc]", rpc.method, JSON.stringify(rpc.params || {}).slice(0, 100));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ type: "res", id: rpc.id, ok: true, payload: {} }));
      } catch {
        res.writeHead(400);
        res.end("Bad Request");
      }
    });
    return;
  }
  res.writeHead(404);
  res.end("Not Found");
});

// WebSocket server mounted on the same HTTP server
const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws, req) => {
  const clientAddr = req.socket.remoteAddress;
  const url = req.url || "/";
  console.log(`[ws] New connection from ${clientAddr} - ${url}`);

  // Parse instance key from URL query params
  const urlObj = new URL(url, `http://${BIND}:${PORT}`);
  const instanceKey = urlObj.searchParams.get("instanceKey") || "unknown";
  console.log(`[ws] Instance key: ${instanceKey}`);

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log(`[ws] Received: type=${msg.type} method=${msg.method || "N/A"} id=${msg.id || "N/A"}`);

      // Handle JSON-RPC 2.0 connect request
      if (msg.type === "req" && msg.method === "connect") {
        const client = msg.params?.client || {};
        console.log(`[ws] Connect request from: ${client.id} (${client.mode}) v${client.version || "?"}`);
        console.log(`[ws] Protocol: ${msg.params?.minProtocol}-${msg.params?.maxProtocol}`);
        console.log(`[ws] Role: ${msg.params?.role}, Scopes: ${JSON.stringify(msg.params?.scopes)}`);

        // Send hello-ok response
        const response = {
          type: "res",
          id: msg.id,
          ok: true,
          payload: {
            type: "hello-ok",
            sessionId: randomUUID(),
            protocol: msg.params?.maxProtocol || 3,
            server: {
              id: "helix-test-gateway",
              version: "0.1.0-test",
              capabilities: ["chat", "tools"],
            },
            gateway: {
              displayName: "Helix Test Gateway",
              machineId: "test-machine",
            },
          },
        };
        ws.send(JSON.stringify(response));
        console.log(`[ws] Sent hello-ok (session: ${response.payload.sessionId})`);
        return;
      }

      // Handle heartbeat/ping
      if (msg.type === "ping" || (msg.type === "req" && msg.method === "ping")) {
        ws.send(JSON.stringify({ type: "pong", id: msg.id }));
        return;
      }

      // Handle chat requests (minimal echo)
      if (msg.type === "req" && msg.method === "chat") {
        console.log(`[ws] Chat request: ${JSON.stringify(msg.params?.message || "").slice(0, 100)}`);

        // Send a simple response
        const chatResponse = {
          type: "res",
          id: msg.id,
          ok: true,
          payload: {
            type: "chat-response",
            message: {
              role: "assistant",
              content: "Hello from Helix test gateway! The connection is working. This is a test server for verifying the web UI protocol.",
            },
          },
        };
        ws.send(JSON.stringify(chatResponse));
        return;
      }

      // Echo unknown messages
      console.log(`[ws] Unknown message type: ${msg.type}`);
      ws.send(JSON.stringify({ type: "res", id: msg.id, ok: false, error: { message: "Unknown method" } }));
    } catch (err) {
      console.error("[ws] Error parsing message:", err.message);
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`[ws] Connection closed: ${code} ${reason || ""}`);
  });

  ws.on("error", (err) => {
    console.error("[ws] WebSocket error:", err.message);
  });
});

httpServer.listen(PORT, BIND, () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║       HELIX TEST GATEWAY SERVER              ║`);
  console.log(`╠══════════════════════════════════════════════╣`);
  console.log(`║  HTTP:  http://${BIND}:${PORT}            ║`);
  console.log(`║  WS:    ws://${BIND}:${PORT}              ║`);
  console.log(`║  Health: http://${BIND}:${PORT}/health    ║`);
  console.log(`╠══════════════════════════════════════════════╣`);
  console.log(`║  Protocol: JSON-RPC 2.0 (OpenClaw v3)       ║`);
  console.log(`║  Auth: None (test mode)                      ║`);
  console.log(`║  Press Ctrl+C to stop                        ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
});

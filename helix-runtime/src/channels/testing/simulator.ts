/**
 * Channel Simulator
 *
 * Test channel integrations by simulating incoming messages
 * without sending actual messages through live channels.
 */

import type { SimulatorMessage } from '../monitoring/types.js';

export interface SimulationResult {
  success: boolean;
  messageId: string;
  timestamp: number;
  channel: string;
  sender: string;
  processedBy?: string[]; // Agents/handlers that processed
  errors?: string[];
}

export interface SimulationSession {
  id: string;
  channel: string;
  startedAt: number;
  messagesCount: number;
  results: SimulationResult[];
  active: boolean;
}

export class ChannelSimulator {
  private sessions: Map<string, SimulationSession> = new Map();
  private handlers: Map<string, SimulatorHandler[]> = new Map();

  /**
   * Register handler for simulated messages
   */
  registerHandler(
    channel: string,
    handler: (message: SimulatorMessage) => Promise<string[]>
  ): void {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, []);
    }

    this.handlers.get(channel)!.push({ handler });
  }

  /**
   * Start simulation session
   */
  startSession(channel: string): SimulationSession {
    const session: SimulationSession = {
      id: `sim-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      channel,
      startedAt: Date.now(),
      messagesCount: 0,
      results: [],
      active: true,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * End simulation session
   */
  endSession(sessionId: string): SimulationSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.active = false;
    return session;
  }

  /**
   * Send simulated message
   */
  async sendSimulatedMessage(
    sessionId: string,
    message: SimulatorMessage
  ): Promise<SimulationResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const result: SimulationResult = {
      success: false,
      messageId: `sim-msg-${Date.now()}`,
      timestamp: Date.now(),
      channel: session.channel,
      sender: message.senderId,
      processedBy: [],
      errors: [],
    };

    try {
      const handlers = this.handlers.get(session.channel) || [];

      for (const { handler } of handlers) {
        try {
          const processed = await handler(message);
          result.processedBy = [...(result.processedBy || []), ...processed];
        } catch (error) {
          result.errors?.push(error instanceof Error ? error.message : String(error));
        }
      }

      result.success = result.errors?.length === 0;
    } catch (error) {
      result.errors?.push(error instanceof Error ? error.message : String(error));
    }

    session.messagesCount += 1;
    session.results.push(result);

    return result;
  }

  /**
   * Get session
   */
  getSession(sessionId: string): SimulationSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get all sessions
   */
  getAllSessions(): SimulationSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get channel sessions
   */
  getChannelSessions(channel: string): SimulationSession[] {
    return Array.from(this.sessions.values()).filter(s => s.channel === channel);
  }

  /**
   * Clear old sessions (older than 24 hours)
   */
  clearOldSessions(): number {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    let cleared = 0;

    for (const [id, session] of this.sessions) {
      if (session.startedAt < oneDayAgo) {
        this.sessions.delete(id);
        cleared += 1;
      }
    }

    return cleared;
  }

  /**
   * Get session summary
   */
  getSessionSummary(sessionId: string): {
    totalMessages: number;
    successful: number;
    failed: number;
    successRate: number;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const successful = session.results.filter(r => r.success).length;
    const failed = session.results.length - successful;
    const successRate =
      session.results.length > 0 ? (successful / session.results.length) * 100 : 0;

    return {
      totalMessages: session.results.length,
      successful,
      failed,
      successRate,
    };
  }

  /**
   * Get test payload template for channel
   */
  getTestPayloadTemplate(channel: string): SimulatorMessage {
    const templates: Record<string, SimulatorMessage> = {
      whatsapp: {
        senderId: '+1234567890',
        content: 'Test message from WhatsApp',
        type: 'text',
      },
      telegram: {
        senderId: '123456789',
        content: 'Test message from Telegram',
        type: 'text',
      },
      discord: {
        senderId: 'user_id_123',
        content: 'Test message from Discord',
        type: 'text',
      },
      slack: {
        senderId: 'U1234567890',
        content: 'Test message from Slack',
        type: 'text',
      },
      default: {
        senderId: 'test_user',
        content: 'Test message',
        type: 'text',
      },
    };

    return templates[channel] || templates.default;
  }
}

interface SimulatorHandler {
  handler: (message: SimulatorMessage) => Promise<string[]>;
}

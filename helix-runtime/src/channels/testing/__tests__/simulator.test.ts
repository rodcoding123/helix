/**
 * Channel Simulator Tests
 *
 * Tests message simulation, session management, and payload generation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ChannelSimulator } from '../simulator';
import type { SimulatorMessage } from '../types';

describe('ChannelSimulator', () => {
  let simulator: ChannelSimulator;

  beforeEach(() => {
    simulator = new ChannelSimulator();
  });

  describe('Session Management', () => {
    it('should start session', () => {
      const session = simulator.startSession('whatsapp');

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.channel).toBe('whatsapp');
      expect(session.startedAt).toBeDefined();
    });

    it('should get session', () => {
      const created = simulator.startSession('telegram');
      const retrieved = simulator.getSession(created.sessionId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(created.sessionId);
    });

    it('should end session', () => {
      const session = simulator.startSession('discord');
      const ended = simulator.endSession(session.sessionId);

      expect(ended).toBeDefined();
      expect(ended?.endedAt).toBeDefined();

      const retrieved = simulator.getSession(session.sessionId);
      expect(retrieved?.endedAt).toBeDefined();
    });

    it('should generate unique session IDs', () => {
      const session1 = simulator.startSession('whatsapp');
      const session2 = simulator.startSession('whatsapp');

      expect(session1.sessionId).not.toBe(session2.sessionId);
    });

    it('should handle nonexistent session', () => {
      const session = simulator.getSession('invalid-id');
      expect(session).toBeNull();
    });
  });

  describe('Message Simulation', () => {
    it('should send simulated message', async () => {
      const session = simulator.startSession('whatsapp');

      const message: SimulatorMessage = {
        type: 'text',
        content: 'Hello, Helix!',
        from: 'test-user',
        timestamp: Date.now(),
      };

      const result = await simulator.sendSimulatedMessage(session.sessionId, message);

      expect(result).toBeDefined();
      expect(result.messageId).toBeDefined();
      expect(result.handled).toBeDefined();
    });

    it('should track message in session', async () => {
      const session = simulator.startSession('telegram');

      const message: SimulatorMessage = {
        type: 'text',
        content: 'Test message',
        from: 'simulator',
        timestamp: Date.now(),
      };

      await simulator.sendSimulatedMessage(session.sessionId, message);

      const updated = simulator.getSession(session.sessionId);
      expect(updated?.messages.length).toBeGreaterThan(0);
    });

    it('should handle message without handler', async () => {
      const session = simulator.startSession('unknown-channel');

      const message: SimulatorMessage = {
        type: 'text',
        content: 'Message to unknown handler',
        from: 'simulator',
        timestamp: Date.now(),
      };

      const result = await simulator.sendSimulatedMessage(session.sessionId, message);
      expect(result.handled).toBe(false);
    });

    it('should preserve message order', async () => {
      const session = simulator.startSession('discord');

      for (let i = 1; i <= 5; i++) {
        await simulator.sendSimulatedMessage(session.sessionId, {
          type: 'text',
          content: `Message ${i}`,
          from: 'simulator',
          timestamp: Date.now() + i,
        });
      }

      const retrieved = simulator.getSession(session.sessionId);
      const messages = retrieved?.messages || [];

      for (let i = 1; i < messages.length; i++) {
        expect(messages[i].timestamp).toBeGreaterThanOrEqual(messages[i - 1].timestamp);
      }
    });
  });

  describe('Session Summary', () => {
    it('should generate session summary', async () => {
      const session = simulator.startSession('whatsapp');

      // Send multiple messages
      for (let i = 0; i < 3; i++) {
        await simulator.sendSimulatedMessage(session.sessionId, {
          type: 'text',
          content: `Message ${i}`,
          from: 'simulator',
          timestamp: Date.now(),
        });
      }

      const summary = simulator.getSessionSummary(session.sessionId);

      expect(summary).toBeDefined();
      expect(summary?.totalMessages).toBeGreaterThanOrEqual(3);
      expect(summary?.duration).toBeGreaterThanOrEqual(0);
    });

    it('should calculate success rate', async () => {
      const session = simulator.startSession('telegram');

      // Send messages that will succeed
      for (let i = 0; i < 5; i++) {
        await simulator.sendSimulatedMessage(session.sessionId, {
          type: 'text',
          content: `Success message ${i}`,
          from: 'simulator',
          timestamp: Date.now(),
        });
      }

      const summary = simulator.getSessionSummary(session.sessionId);
      expect(summary?.successRate).toBeGreaterThanOrEqual(0);
      expect(summary?.successRate).toBeLessThanOrEqual(100);
    });

    it('should return null for nonexistent session summary', () => {
      const summary = simulator.getSessionSummary('invalid-id');
      expect(summary).toBeNull();
    });
  });

  describe('Test Payload Templates', () => {
    it('should generate WhatsApp template', () => {
      const payload = simulator.getTestPayloadTemplate('whatsapp');

      expect(payload).toBeDefined();
      expect(payload.type).toBeDefined();
      expect(typeof payload.type).toBe('string');
    });

    it('should generate Telegram template', () => {
      const payload = simulator.getTestPayloadTemplate('telegram');

      expect(payload).toBeDefined();
      expect(payload.message).toBeDefined();
    });

    it('should generate Discord template', () => {
      const payload = simulator.getTestPayloadTemplate('discord');

      expect(payload).toBeDefined();
      expect(payload.type).toBeDefined();
    });

    it('should generate Slack template', () => {
      const payload = simulator.getTestPayloadTemplate('slack');

      expect(payload).toBeDefined();
    });

    it('should generate template for unknown channel', () => {
      const payload = simulator.getTestPayloadTemplate('unknown-channel');

      expect(payload).toBeDefined();
    });

    it('should generate valid JSON templates', () => {
      const channels = ['whatsapp', 'telegram', 'discord', 'slack', 'signal'];

      channels.forEach((channel) => {
        const payload = simulator.getTestPayloadTemplate(channel);
        // Should be serializable to JSON
        expect(() => JSON.stringify(payload)).not.toThrow();
      });
    });
  });

  describe('Handler Registration', () => {
    it('should register message handler', async () => {
      const handler = async (msg: SimulatorMessage) => 'handled';

      simulator.registerHandler('test-channel', handler);

      const session = simulator.startSession('test-channel');
      const result = await simulator.sendSimulatedMessage(session.sessionId, {
        type: 'text',
        content: 'Test',
        from: 'simulator',
        timestamp: Date.now(),
      });

      expect(result.handled).toBe(true);
    });

    it('should handle multiple handlers per channel', async () => {
      const handler1 = async (msg: SimulatorMessage) => 'handled-1';
      const handler2 = async (msg: SimulatorMessage) => 'handled-2';

      simulator.registerHandler('multi-channel', handler1);
      simulator.registerHandler('multi-channel', handler2);

      const session = simulator.startSession('multi-channel');
      const result = await simulator.sendSimulatedMessage(session.sessionId, {
        type: 'text',
        content: 'Test',
        from: 'simulator',
        timestamp: Date.now(),
      });

      expect(result.handled).toBe(true);
    });
  });

  describe('Message Types', () => {
    it('should handle text messages', async () => {
      const session = simulator.startSession('whatsapp');

      const message: SimulatorMessage = {
        type: 'text',
        content: 'Hello',
        from: 'user',
        timestamp: Date.now(),
      };

      const result = await simulator.sendSimulatedMessage(session.sessionId, message);
      expect(result).toBeDefined();
    });

    it('should handle media messages', async () => {
      const session = simulator.startSession('telegram');

      const message: SimulatorMessage = {
        type: 'media',
        mediaType: 'image',
        content: 'https://example.com/image.jpg',
        from: 'user',
        timestamp: Date.now(),
      };

      const result = await simulator.sendSimulatedMessage(session.sessionId, message);
      expect(result).toBeDefined();
    });

    it('should handle custom messages', async () => {
      const session = simulator.startSession('discord');

      const message: SimulatorMessage = {
        type: 'custom',
        content: JSON.stringify({ action: 'reaction', emoji: '👍' }),
        from: 'user',
        timestamp: Date.now(),
      };

      const result = await simulator.sendSimulatedMessage(session.sessionId, message);
      expect(result).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message content', async () => {
      const session = simulator.startSession('whatsapp');

      const message: SimulatorMessage = {
        type: 'text',
        content: '',
        from: 'user',
        timestamp: Date.now(),
      };

      const result = await simulator.sendSimulatedMessage(session.sessionId, message);
      expect(result).toBeDefined();
    });

    it('should handle very long message', async () => {
      const session = simulator.startSession('telegram');

      const longContent = 'x'.repeat(10000);
      const message: SimulatorMessage = {
        type: 'text',
        content: longContent,
        from: 'user',
        timestamp: Date.now(),
      };

      const result = await simulator.sendSimulatedMessage(session.sessionId, message);
      expect(result).toBeDefined();
    });

    it('should handle rapid message sending', async () => {
      const session = simulator.startSession('discord');

      const promises = Array.from({ length: 100 }, (_, i) =>
        simulator.sendSimulatedMessage(session.sessionId, {
          type: 'text',
          content: `Message ${i}`,
          from: 'simulator',
          timestamp: Date.now() + i,
        })
      );

      const results = await Promise.all(promises);
      expect(results.length).toBe(100);
      expect(results.every((r) => r.messageId)).toBe(true);
    });

    it('should handle future timestamps', async () => {
      const session = simulator.startSession('whatsapp');

      const futureTime = Date.now() + 86400000; // Tomorrow
      const message: SimulatorMessage = {
        type: 'text',
        content: 'Future message',
        from: 'user',
        timestamp: futureTime,
      };

      const result = await simulator.sendSimulatedMessage(session.sessionId, message);
      expect(result).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should start session quickly', () => {
      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        simulator.startSession('whatsapp');
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1000); // 100 sessions in <1s
    });

    it('should send messages efficiently', async () => {
      const session = simulator.startSession('telegram');

      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        await simulator.sendSimulatedMessage(session.sessionId, {
          type: 'text',
          content: `Message ${i}`,
          from: 'simulator',
          timestamp: Date.now(),
        });
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(5000); // 100 messages in <5s
    });
  });
});

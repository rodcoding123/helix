/**
 * WebRTC Voice Signaling Handler
 * Manages SDP offer/answer exchange and ICE candidate handling for real-time voice
 */

import type { IncomingMessage } from 'node:http';
import type { WebSocket } from 'ws';

export interface VoiceSignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'message';
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  text?: string;
}

export interface VoiceSession {
  userId: string;
  clientId: string;
  peerConnection?: RTCPeerConnection;
  createdAt: Date;
  lastActivityAt: Date;
}

// In-memory store of active voice sessions (in production, use Redis)
const activeSessions = new Map<string, VoiceSession>();

/**
 * Handle WebRTC voice signaling over WebSocket
 */
export async function handleWebRTCVoiceSignaling(
  ws: WebSocket,
  req: IncomingMessage,
  context: {
    userId?: string;
    logGateway: any;
  }
): Promise<void> {
  const userId = context.userId;
  if (!userId) {
    ws.close(401, 'Unauthorized');
    return;
  }

  const clientId = req.headers['x-client-id'] as string;
  const sessionId = `${userId}-${clientId}`;

  // Create voice session
  const session: VoiceSession = {
    userId,
    clientId,
    createdAt: new Date(),
    lastActivityAt: new Date(),
  };

  activeSessions.set(sessionId, session);

  context.logGateway.log?.('WEBRTC_SESSION_STARTED', {
    sessionId,
    userId,
  });

  /**
   * Handle incoming signaling messages
   */
  ws.on('message', async (data: Buffer) => {
    try {
      const message: VoiceSignalingMessage = JSON.parse(data.toString());
      session.lastActivityAt = new Date();

      switch (message.type) {
        case 'offer':
          // Client sent offer, gateway creates answer
          await handleOffer(message, ws, context, sessionId);
          break;

        case 'ice-candidate':
          // Forward ICE candidate to peer
          await handleIceCandidate(message, ws, context, sessionId);
          break;

        case 'message':
          // Text message during voice call
          await handleVoiceMessage(message, context, sessionId);
          break;

        default:
          context.logGateway.warn?.('Unknown signaling message type', { type: message.type });
      }
    } catch (error) {
      context.logGateway.error?.('Signaling message processing error', {
        error: error instanceof Error ? error.message : String(error),
        sessionId,
      });
    }
  });

  /**
   * Handle WebSocket close
   */
  ws.on('close', () => {
    activeSessions.delete(sessionId);

    context.logGateway.log?.('WEBRTC_SESSION_CLOSED', {
      sessionId,
      userId,
      duration: Date.now() - session.createdAt.getTime(),
    });
  });

  /**
   * Handle WebSocket errors
   */
  ws.on('error', (error) => {
    context.logGateway.error?.('WebSocket error', {
      error: error instanceof Error ? error.message : String(error),
      sessionId,
    });
  });
}

/**
 * Handle SDP offer from client
 */
async function handleOffer(
  message: VoiceSignalingMessage,
  ws: WebSocket,
  context: any,
  sessionId: string
): Promise<void> {
  if (!message.offer) {
    throw new Error('Offer missing in message');
  }

  // In a real implementation, this would:
  // 1. Create a peer connection on the gateway side
  // 2. Set the remote description (offer)
  // 3. Create an answer
  // 4. Send answer back to client

  // For now, we'll send a mock answer
  const answer: RTCSessionDescriptionInit = {
    type: 'answer',
    sdp: 'mock-answer-sdp',
  };

  ws.send(
    JSON.stringify({
      type: 'answer',
      answer,
    })
  );

  context.logGateway.log?.('WEBRTC_OFFER_RECEIVED', {
    sessionId,
  });
}

/**
 * Handle ICE candidate exchange
 */
async function handleIceCandidate(
  message: VoiceSignalingMessage,
  ws: WebSocket,
  context: any,
  sessionId: string
): Promise<void> {
  if (!message.candidate) {
    throw new Error('ICE candidate missing in message');
  }

  // In a real implementation, this would:
  // 1. Add the ICE candidate to the gateway's peer connection
  // 2. If the gateway generates new candidates, send them back to client

  context.logGateway.log?.('WEBRTC_ICE_CANDIDATE_RECEIVED', {
    sessionId,
  });
}

/**
 * Handle text messages during voice call
 */
async function handleVoiceMessage(
  message: VoiceSignalingMessage,
  context: any,
  sessionId: string
): Promise<void> {
  if (!message.text) {
    throw new Error('Message text missing');
  }

  context.logGateway.log?.('WEBRTC_MESSAGE_RECEIVED', {
    sessionId,
    messageLength: message.text.length,
  });

  // Store message in database or forward to AI processing
  // This enables text communication during voice conversations
}

/**
 * Get active voice sessions for a user
 */
export function getUserVoiceSessions(userId: string): VoiceSession[] {
  return Array.from(activeSessions.values()).filter((session) => session.userId === userId);
}

/**
 * Close a voice session
 */
export function closeVoiceSession(sessionId: string): boolean {
  return activeSessions.delete(sessionId);
}

/**
 * Get session statistics
 */
export function getVoiceSessionStats() {
  const sessions = Array.from(activeSessions.values());
  const now = new Date();

  return {
    totalSessions: sessions.length,
    userCount: new Set(sessions.map((s) => s.userId)).size,
    averageDuration: sessions.length
      ? sessions.reduce((sum, s) => sum + (now.getTime() - s.createdAt.getTime()), 0) /
        sessions.length /
        1000
      : 0,
  };
}

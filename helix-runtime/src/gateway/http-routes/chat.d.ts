/**
 * Chat API HTTP Routes - OpenClaw HTTP Handler Pattern
 * Handles basic chat functionality for Web MVP
 *
 * PHASE 0.5 MIGRATION: This file now uses centralized AI operations router
 * instead of hardcoded model selection. All chat messages are routed through
 * the unified router which handles:
 * - Model selection based on configuration
 * - Cost tracking and budget enforcement
 * - Approval gates for high-cost operations
 *
 * Endpoints:
 * - GET /api/chat/history - Load user's chat session history
 * - POST /api/chat/message - Send message to Claude and get response (now routed)
 */
import { type IncomingMessage, type ServerResponse } from 'node:http';
interface ChatHandlerContext {
    db: any;
    supabase: any;
    logGateway: any;
}
/**
 * Main chat HTTP request handler
 * Returns true if request was handled, false otherwise
 */
export declare function handleChatHttpRequest(req: IncomingMessage, res: ServerResponse, context: ChatHandlerContext): Promise<boolean>;
export {};
//# sourceMappingURL=chat.d.ts.map
/**
 * Chat Service - Web MVP (Browser-based storage)
 * For MVP, messages are stored in localStorage
 * This enables immediate functionality without backend database integration
 */

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokenCount?: number;
}

const STORAGE_KEY_PREFIX = 'helix_chat_';

/**
 * Load chat session history from localStorage
 */
export function loadChatHistory(sessionKey: string = 'web-mvp-session'): ChatMessage[] {
  try {
    const key = `${STORAGE_KEY_PREFIX}${sessionKey}`;
    const stored = localStorage.getItem(key);

    if (!stored) {
      return [];
    }

    const messages = JSON.parse(stored);

    // Convert timestamp strings back to Date objects
    return messages.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));
  } catch (error) {
    console.error('Failed to load chat history:', error);
    return [];
  }
}

/**
 * Save a message to localStorage history
 */
function saveMessage(
  sessionKey: string,
  message: Omit<ChatMessage, 'id'> & { id?: string }
): ChatMessage {
  const msg: ChatMessage = {
    id: message.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp),
    tokenCount: message.tokenCount,
  };

  const key = `${STORAGE_KEY_PREFIX}${sessionKey}`;
  const messages = loadChatHistory(sessionKey);
  messages.push(msg);

  localStorage.setItem(key, JSON.stringify(messages));

  return msg;
}

/**
 * Send message to Claude API and store result
 * Uses /api/chat/message endpoint
 */
export async function sendChatMessage(
  message: string,
  sessionKey: string = 'web-mvp-session'
): Promise<{
  success: boolean;
  response?: string;
  tokenCount?: number;
  error?: string;
}> {
  if (!message.trim()) {
    return {
      success: false,
      error: 'Message cannot be empty',
    };
  }

  try {
    // Save user message to local history
    saveMessage(sessionKey, {
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
    });

    // Send to Claude via API
    const response = await fetch('/api/chat/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message.trim(),
        sessionKey,
        messages: loadChatHistory(sessionKey),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get response');
    }

    const data = await response.json();

    if (!data.success || !data.response) {
      throw new Error(data.error || 'No response from Claude');
    }

    // Save assistant response to local history
    saveMessage(sessionKey, {
      role: 'assistant',
      content: data.response,
      timestamp: new Date(),
      tokenCount: data.tokenCount,
    });

    return {
      success: true,
      response: data.response,
      tokenCount: data.tokenCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to send chat message:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Clear chat history for a session
 */
export function clearChatHistory(sessionKey: string = 'web-mvp-session'): {
  success: boolean;
  error?: string;
} {
  try {
    const key = `${STORAGE_KEY_PREFIX}${sessionKey}`;
    localStorage.removeItem(key);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to clear chat history:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Export session as JSON
 */
export function exportChatSession(
  sessionKey: string = 'web-mvp-session'
): {
  success: boolean;
  data?: any;
  error?: string;
} {
  try {
    const messages = loadChatHistory(sessionKey);

    const exportData = {
      sessionKey,
      exportedAt: new Date().toISOString(),
      messageCount: messages.length,
      messages,
    };

    return {
      success: true,
      data: exportData,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      error: errorMessage,
    };
  }
}

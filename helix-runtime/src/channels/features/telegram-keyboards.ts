/**
 * Telegram Keyboard Builder and Handlers
 *
 * Telegram-specific features:
 * - Inline keyboards (buttons with callbacks)
 * - Reply keyboards (suggested replies)
 * - Custom commands (@BotFather integration)
 * - Callback query handling
 */

export interface TelegramButton {
  text: string;
  callbackData?: string; // For inline keyboards
  url?: string; // For URL buttons
  webApp?: { url: string }; // For web app buttons
}

export interface TelegramInlineKeyboard {
  id: string;
  name: string;
  buttons: TelegramButton[][];
  createdAt: number;
  updatedAt: number;
}

export interface TelegramReplyKeyboard {
  id: string;
  name: string;
  buttons: string[][]; // Button text grid
  oneTimeKeyboard?: boolean;
  resizeKeyboard?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TelegramCustomCommand {
  command: string; // Without '/'
  description: string;
  syntax?: string;
  botName: string;
  createdAt: number;
}

export interface TelegramCallbackHandler {
  pattern: string; // Regex pattern to match callback_data
  handler: (callbackData: string, userId: string, messageId: number) => Promise<string>;
}

export interface TelegramKeyboardConfig {
  version: string;
  inlineKeyboards: TelegramInlineKeyboard[];
  replyKeyboards: TelegramReplyKeyboard[];
  customCommands: TelegramCustomCommand[];
  callbackHandlers: Map<string, TelegramCallbackHandler>;
}

/**
 * Telegram Keyboard Manager
 */
export class TelegramKeyboardManager {
  private config: TelegramKeyboardConfig;
  private callbackHandlers: Map<string, TelegramCallbackHandler> = new Map();

  constructor(config: TelegramKeyboardConfig) {
    this.config = config;
    this.callbackHandlers = new Map(config.callbackHandlers || []);
  }

  /**
   * Create inline keyboard
   */
  createInlineKeyboard(name: string, buttons: TelegramButton[][]): TelegramInlineKeyboard {
    const keyboard: TelegramInlineKeyboard = {
      id: `inline-${Date.now()}`,
      name,
      buttons,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.config.inlineKeyboards.push(keyboard);
    return keyboard;
  }

  /**
   * Create reply keyboard
   */
  createReplyKeyboard(
    name: string,
    buttons: string[][],
    options?: {
      oneTimeKeyboard?: boolean;
      resizeKeyboard?: boolean;
    }
  ): TelegramReplyKeyboard {
    const keyboard: TelegramReplyKeyboard = {
      id: `reply-${Date.now()}`,
      name,
      buttons,
      oneTimeKeyboard: options?.oneTimeKeyboard,
      resizeKeyboard: options?.resizeKeyboard !== false, // Default true
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.config.replyKeyboards.push(keyboard);
    return keyboard;
  }

  /**
   * Get inline keyboard by ID
   */
  getInlineKeyboard(keyboardId: string): TelegramInlineKeyboard | null {
    return this.config.inlineKeyboards.find(k => k.id === keyboardId) || null;
  }

  /**
   * Get reply keyboard by ID
   */
  getReplyKeyboard(keyboardId: string): TelegramReplyKeyboard | null {
    return this.config.replyKeyboards.find(k => k.id === keyboardId) || null;
  }

  /**
   * Delete inline keyboard
   */
  deleteInlineKeyboard(keyboardId: string): void {
    this.config.inlineKeyboards = this.config.inlineKeyboards.filter(k => k.id !== keyboardId);
  }

  /**
   * Delete reply keyboard
   */
  deleteReplyKeyboard(keyboardId: string): void {
    this.config.replyKeyboards = this.config.replyKeyboards.filter(k => k.id !== keyboardId);
  }

  /**
   * Register custom command
   */
  registerCommand(
    command: string,
    description: string,
    botName: string,
    syntax?: string
  ): TelegramCustomCommand {
    const cmd: TelegramCustomCommand = {
      command: command.replace(/^\//, ''), // Remove leading /
      description,
      syntax,
      botName,
      createdAt: Date.now(),
    };

    // Replace if exists
    const idx = this.config.customCommands.findIndex(c => c.command === cmd.command);
    if (idx >= 0) {
      this.config.customCommands[idx] = cmd;
    } else {
      this.config.customCommands.push(cmd);
    }

    return cmd;
  }

  /**
   * Get all custom commands
   */
  getCustomCommands(): TelegramCustomCommand[] {
    return this.config.customCommands;
  }

  /**
   * Delete custom command
   */
  deleteCommand(command: string): void {
    this.config.customCommands = this.config.customCommands.filter(
      c => c.command !== command.replace(/^\//, '')
    );
  }

  /**
   * Register callback handler
   */
  registerCallbackHandler(pattern: string, handler: TelegramCallbackHandler['handler']): void {
    this.callbackHandlers.set(pattern, {
      pattern,
      handler,
    });
  }

  /**
   * Handle callback query
   */
  async handleCallback(
    callbackData: string,
    userId: string,
    messageId: number
  ): Promise<string | null> {
    for (const [pattern, handler] of this.callbackHandlers) {
      try {
        const regex = new RegExp(pattern);
        if (regex.test(callbackData)) {
          return await handler.handler(callbackData, userId, messageId);
        }
      } catch (error) {
        console.error(`Callback handler error (${pattern}):`, error);
      }
    }

    return null;
  }

  /**
   * Format inline keyboard for Telegram API
   */
  formatInlineKeyboard(keyboard: TelegramInlineKeyboard): {
    inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
  } {
    return {
      inline_keyboard: keyboard.buttons.map(row =>
        row.map(button => ({
          text: button.text,
          callback_data: button.callbackData,
          url: button.url,
        }))
      ),
    };
  }

  /**
   * Format reply keyboard for Telegram API
   */
  formatReplyKeyboard(keyboard: TelegramReplyKeyboard): {
    keyboard: string[][];
    one_time_keyboard?: boolean;
    resize_keyboard?: boolean;
  } {
    return {
      keyboard: keyboard.buttons,
      one_time_keyboard: keyboard.oneTimeKeyboard,
      resize_keyboard: keyboard.resizeKeyboard,
    };
  }

  /**
   * Generate BotFather command list
   */
  generateBotFatherCommands(): string {
    return this.config.customCommands
      .map(cmd => `${cmd.command} - ${cmd.description}`)
      .join('\n');
  }

  /**
   * Get config
   */
  getConfig(): TelegramKeyboardConfig {
    return this.config;
  }

  /**
   * Update config
   */
  updateConfig(config: TelegramKeyboardConfig): void {
    this.config = config;
    this.callbackHandlers = new Map(config.callbackHandlers || []);
  }
}

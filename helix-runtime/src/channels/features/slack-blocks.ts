/**
 * Slack Block Kit Support
 *
 * Slack-specific features:
 * - Block Kit UI builder
 * - Slash commands
 * - App home tab updates
 * - Interactive components (buttons, selects, modals)
 */

export type BlockType =
  | 'header'
  | 'section'
  | 'divider'
  | 'image'
  | 'actions'
  | 'input'
  | 'context'
  | 'rich_text';

export interface SlackBlock {
  type: BlockType;
  block_id?: string;
  [key: string]: unknown;
}

export interface SlackHeaderBlock extends SlackBlock {
  type: 'header';
  text: {
    type: 'plain_text';
    text: string;
    emoji?: boolean;
  };
}

export interface SlackSectionBlock extends SlackBlock {
  type: 'section';
  text?: {
    type: 'mrkdwn' | 'plain_text';
    text: string;
  };
  accessory?: SlackBlockElement;
}

export interface SlackActionsBlock extends SlackBlock {
  type: 'actions';
  elements: SlackBlockElement[];
}

export type SlackBlockElement =
  | { type: 'button'; text: { type: 'plain_text'; text: string }; action_id: string; value?: string }
  | { type: 'static_select'; placeholder: { type: 'plain_text'; text: string }; action_id: string; options: SlackOption[] }
  | { type: 'datepicker'; action_id: string; placeholder?: { type: 'plain_text'; text: string } }
  | { type: 'timepicker'; action_id: string; placeholder?: { type: 'plain_text'; text: string } };

export interface SlackOption {
  text: { type: 'plain_text'; text: string };
  value: string;
}

export interface SlackSlashCommand {
  command: string; // Without '/'
  description: string;
  usage?: string;
  shouldEscapeText?: boolean;
}

export interface SlackInteractionHandler {
  actionId: string;
  handler: (payload: SlackInteractionPayload) => Promise<SlackInteractionResponse>;
}

export interface SlackInteractionPayload {
  type: 'block_actions' | 'shortcut' | 'view_submission' | 'options';
  user: { id: string; username: string };
  channel?: { id: string; name: string };
  triggerId?: string;
  actions?: Array<{
    type: string;
    action_id: string;
    value?: string;
    selected_option?: SlackOption;
  }>;
}

export interface SlackInteractionResponse {
  type: 'in_channel' | 'ephemeral';
  text?: string;
  blocks?: SlackBlock[];
  replace_original?: boolean;
  delete_original?: boolean;
}

export interface SlackBlocksConfig {
  version: string;
  blocks: Map<string, SlackBlock[]>; // messageId -> blocks
  slashCommands: SlackSlashCommand[];
  interactionHandlers: Map<string, SlackInteractionHandler>;
}

/**
 * Slack Block Kit Manager
 */
export class SlackBlockKitManager {
  private config: SlackBlocksConfig;

  constructor(config: SlackBlocksConfig) {
    this.config = config;
  }

  /**
   * Create header block
   */
  createHeaderBlock(text: string, blockId?: string): SlackHeaderBlock {
    return {
      type: 'header',
      block_id: blockId || `header-${Date.now()}`,
      text: {
        type: 'plain_text',
        text,
        emoji: true,
      },
    };
  }

  /**
   * Create section block
   */
  createSectionBlock(text: string, markdown = true, blockId?: string): SlackSectionBlock {
    return {
      type: 'section',
      block_id: blockId || `section-${Date.now()}`,
      text: {
        type: markdown ? 'mrkdwn' : 'plain_text',
        text,
      },
    };
  }

  /**
   * Create divider block
   */
  createDividerBlock(blockId?: string): SlackBlock {
    return {
      type: 'divider',
      block_id: blockId || `divider-${Date.now()}`,
    };
  }

  /**
   * Create button element
   */
  createButton(text: string, actionId: string, value?: string): SlackBlockElement {
    return {
      type: 'button',
      text: { type: 'plain_text', text },
      action_id: actionId,
      value,
    };
  }

  /**
   * Create select element
   */
  createSelect(
    placeholder: string,
    actionId: string,
    options: Array<{ text: string; value: string }>
  ): SlackBlockElement {
    return {
      type: 'static_select',
      placeholder: { type: 'plain_text', text: placeholder },
      action_id: actionId,
      options: options.map(opt => ({
        text: { type: 'plain_text', text: opt.text },
        value: opt.value,
      })),
    };
  }

  /**
   * Create actions block
   */
  createActionsBlock(elements: SlackBlockElement[], blockId?: string): SlackActionsBlock {
    return {
      type: 'actions',
      block_id: blockId || `actions-${Date.now()}`,
      elements,
    };
  }

  /**
   * Build message blocks
   */
  buildMessage(messageId: string, blocks: SlackBlock[]): SlackBlock[] {
    this.config.blocks.set(messageId, blocks);
    return blocks;
  }

  /**
   * Get message blocks
   */
  getMessageBlocks(messageId: string): SlackBlock[] {
    return this.config.blocks.get(messageId) || [];
  }

  /**
   * Register slash command
   */
  registerSlashCommand(
    command: string,
    description: string,
    options?: {
      usage?: string;
      shouldEscapeText?: boolean;
    }
  ): SlackSlashCommand {
    const cmd: SlackSlashCommand = {
      command: command.replace(/^\//, ''),
      description,
      usage: options?.usage,
      shouldEscapeText: options?.shouldEscapeText !== false,
    };

    // Replace if exists
    const idx = this.config.slashCommands.findIndex(c => c.command === cmd.command);
    if (idx >= 0) {
      this.config.slashCommands[idx] = cmd;
    } else {
      this.config.slashCommands.push(cmd);
    }

    return cmd;
  }

  /**
   * Get all slash commands
   */
  getSlashCommands(): SlackSlashCommand[] {
    return this.config.slashCommands;
  }

  /**
   * Delete slash command
   */
  deleteSlashCommand(command: string): void {
    this.config.slashCommands = this.config.slashCommands.filter(
      c => c.command !== command.replace(/^\//, '')
    );
  }

  /**
   * Register interaction handler
   */
  registerInteractionHandler(
    actionId: string,
    handler: (payload: SlackInteractionPayload) => Promise<SlackInteractionResponse>
  ): void {
    this.config.interactionHandlers.set(actionId, {
      actionId,
      handler,
    });
  }

  /**
   * Handle interaction
   */
  async handleInteraction(payload: SlackInteractionPayload): Promise<SlackInteractionResponse | null> {
    if (!payload.actions) return null;

    for (const action of payload.actions) {
      const handler = this.config.interactionHandlers.get(action.action_id);
      if (handler) {
        return await handler.handler(payload);
      }
    }

    return null;
  }

  /**
   * Format blocks for Slack API
   */
  formatBlocks(blocks: SlackBlock[]): SlackBlock[] {
    return blocks.map(block => {
      const formatted: Record<string, unknown> = { ...block };

      // Remove undefined fields
      Object.keys(formatted).forEach(key => {
        if (formatted[key] === undefined) {
          delete formatted[key];
        }
      });

      return formatted as SlackBlock;
    });
  }

  /**
   * Get config
   */
  getConfig(): SlackBlocksConfig {
    return this.config;
  }

  /**
   * Update config
   */
  updateConfig(config: SlackBlocksConfig): void {
    this.config = config;
  }
}

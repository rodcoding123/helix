/**
 * Discord Thread Management
 *
 * Discord-specific features:
 * - Thread auto-creation from keywords
 * - Reaction-based workflows
 * - Rich embed customization
 * - Thread lifecycle management
 */

export interface DiscordThread {
  id: string;
  channelId: string;
  parentMessageId?: string;
  name: string;
  archived: boolean;
  locked: boolean;
  createdAt: number;
  autoCreated: boolean;
  triggerKeyword?: string;
}

export interface DiscordThreadRule {
  id: string;
  channelId: string;
  keyword: string; // Regex pattern
  threadName?: string; // Template: {user}, {keyword}, {date}
  threadTopic?: string;
  autoPin?: boolean; // Auto-pin messages matching pattern
  autoTag?: string[]; // Auto-apply roles/tags
  enabled: boolean;
  createdAt: number;
}

export interface DiscordReaction {
  emoji: string; // Unicode or custom emoji ID
  action: 'role' | 'channel' | 'thread' | 'webhook' | 'custom';
  target?: string; // Role ID, channel ID, webhook ID, etc.
  customHandler?: (userId: string, messageId: string, emoji: string) => Promise<void>;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number; // Hex color code
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  image?: { url: string };
  thumbnail?: { url: string };
  footer?: { text: string; icon_url?: string };
  author?: { name: string; icon_url?: string };
}

export interface DiscordThreadConfig {
  version: string;
  threads: DiscordThread[];
  threadRules: DiscordThreadRule[];
  reactions: Map<string, DiscordReaction[]>; // messageId -> reactions
  embeds: Map<string, DiscordEmbed>; // embedId -> embed
}

/**
 * Discord Thread Manager
 */
export class DiscordThreadManager {
  private config: DiscordThreadConfig;

  constructor(config: DiscordThreadConfig) {
    this.config = config;
  }

  /**
   * Create thread rule
   */
  createThreadRule(
    channelId: string,
    keyword: string,
    options?: {
      threadName?: string;
      threadTopic?: string;
      autoPin?: boolean;
      autoTag?: string[];
    }
  ): DiscordThreadRule {
    const rule: DiscordThreadRule = {
      id: `rule-${Date.now()}`,
      channelId,
      keyword,
      threadName: options?.threadName || '{keyword} - {date}',
      threadTopic: options?.threadTopic,
      autoPin: options?.autoPin || false,
      autoTag: options?.autoTag || [],
      enabled: true,
      createdAt: Date.now(),
    };

    this.config.threadRules.push(rule);
    return rule;
  }

  /**
   * Get rules for channel
   */
  getChannelRules(channelId: string): DiscordThreadRule[] {
    return this.config.threadRules.filter(r => r.channelId === channelId && r.enabled);
  }

  /**
   * Check if message matches any rules
   */
  matchesRule(channelId: string, content: string): DiscordThreadRule | null {
    const rules = this.getChannelRules(channelId);

    for (const rule of rules) {
      try {
        const regex = new RegExp(rule.keyword, 'i');
        if (regex.test(content)) {
          return rule;
        }
      } catch (error) {
        console.error(`Invalid regex in rule ${rule.id}:`, error);
      }
    }

    return null;
  }

  /**
   * Generate thread name from template
   */
  generateThreadName(template: string, context: { keyword?: string; user?: string; date?: string }): string {
    return template
      .replace('{keyword}', context.keyword || 'Discussion')
      .replace('{user}', context.user || 'User')
      .replace('{date}', context.date || new Date().toLocaleDateString());
  }

  /**
   * Create thread
   */
  createThread(
    channelId: string,
    name: string,
    options?: {
      parentMessageId?: string;
      autoCreated?: boolean;
      triggerKeyword?: string;
    }
  ): DiscordThread {
    const thread: DiscordThread = {
      id: `thread-${Date.now()}`,
      channelId,
      parentMessageId: options?.parentMessageId,
      name,
      archived: false,
      locked: false,
      createdAt: Date.now(),
      autoCreated: options?.autoCreated || false,
      triggerKeyword: options?.triggerKeyword,
    };

    this.config.threads.push(thread);
    return thread;
  }

  /**
   * Get thread
   */
  getThread(threadId: string): DiscordThread | null {
    return this.config.threads.find(t => t.id === threadId) || null;
  }

  /**
   * Archive thread
   */
  archiveThread(threadId: string): DiscordThread {
    const thread = this.getThread(threadId);
    if (!thread) throw new Error(`Thread ${threadId} not found`);

    thread.archived = true;
    return thread;
  }

  /**
   * Lock thread
   */
  lockThread(threadId: string): DiscordThread {
    const thread = this.getThread(threadId);
    if (!thread) throw new Error(`Thread ${threadId} not found`);

    thread.locked = true;
    return thread;
  }

  /**
   * Register reaction handler
   */
  registerReaction(messageId: string, reaction: DiscordReaction): void {
    if (!this.config.reactions.has(messageId)) {
      this.config.reactions.set(messageId, []);
    }

    this.config.reactions.get(messageId)!.push(reaction);
  }

  /**
   * Get reactions for message
   */
  getReactions(messageId: string): DiscordReaction[] {
    return this.config.reactions.get(messageId) || [];
  }

  /**
   * Handle reaction add
   */
  async handleReactionAdd(
    messageId: string,
    emoji: string,
    userId: string
  ): Promise<boolean> {
    const reactions = this.getReactions(messageId);

    for (const reaction of reactions) {
      if (reaction.emoji === emoji) {
        if (reaction.customHandler) {
          await reaction.customHandler(userId, messageId, emoji);
        }
        return true;
      }
    }

    return false;
  }

  /**
   * Create embed
   */
  createEmbed(title: string, description: string, color?: number): DiscordEmbed {
    return {
      title,
      description,
      color: color || 0x5865f2, // Discord blurple
      fields: [],
    };
  }

  /**
   * Add field to embed
   */
  addEmbedField(embed: DiscordEmbed, name: string, value: string, inline?: boolean): DiscordEmbed {
    if (!embed.fields) embed.fields = [];
    embed.fields.push({ name, value, inline });
    return embed;
  }

  /**
   * Set embed image
   */
  setEmbedImage(embed: DiscordEmbed, url: string): DiscordEmbed {
    embed.image = { url };
    return embed;
  }

  /**
   * Set embed thumbnail
   */
  setEmbedThumbnail(embed: DiscordEmbed, url: string): DiscordEmbed {
    embed.thumbnail = { url };
    return embed;
  }

  /**
   * Format embed for Discord API
   */
  formatEmbed(embed: DiscordEmbed): Record<string, unknown> {
    const formatted: Record<string, unknown> = {};

    if (embed.title) formatted.title = embed.title;
    if (embed.description) formatted.description = embed.description;
    if (embed.color) formatted.color = embed.color;
    if (embed.fields?.length) formatted.fields = embed.fields;
    if (embed.image) formatted.image = embed.image;
    if (embed.thumbnail) formatted.thumbnail = embed.thumbnail;
    if (embed.footer) formatted.footer = embed.footer;
    if (embed.author) formatted.author = embed.author;

    return formatted;
  }

  /**
   * Get config
   */
  getConfig(): DiscordThreadConfig {
    return this.config;
  }

  /**
   * Update config
   */
  updateConfig(config: DiscordThreadConfig): void {
    this.config = config;
  }
}

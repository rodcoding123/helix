import { loadSecret } from '@/lib/secrets-loader';
import type { AgentProposal, AutonomyAction, Agent } from '@/lib/types/agents';

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
  };
  timestamp?: string;
}

interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: Array<{
    type: number;
    components: Array<{
      type: number;
      style: number;
      label: string;
      custom_id: string;
    }>;
  }>;
}

/**
 * DiscordLoggerService: Logs agent proposals and autonomy actions to Discord
 * Provides approval workflow via reactions and buttons
 */
export class DiscordLoggerService {
  private webhookUrls: Map<string, string> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load Discord webhooks from 1Password
      const agentsWebhook = await loadSecret('Discord Agents Webhook');
      const autonomyWebhook = await loadSecret('Discord Autonomy Webhook');
      const actionsWebhook = await loadSecret('Discord Actions Webhook');

      this.webhookUrls.set('agents', agentsWebhook);
      this.webhookUrls.set('autonomy', autonomyWebhook);
      this.webhookUrls.set('actions', actionsWebhook);

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Discord webhooks:', error);
      // Continue without Discord - not fatal
    }
  }

  /**
   * Log agent proposal to #helix-agents channel
   */
  async logAgentProposal(
    userId: string,
    proposal: AgentProposal
  ): Promise<void> {
    await this.initialize();

    const webhookUrl = this.webhookUrls.get('agents');
    if (!webhookUrl) return;

    const embed: DiscordEmbed = {
      title: '🤖 Agent Proposal',
      description: proposal.reason,
      color: 0x9333ea, // Purple
      fields: [
        {
          name: 'Agent Name',
          value: `**${proposal.proposed_name}**`,
          inline: true,
        },
        {
          name: 'Role',
          value: proposal.proposed_role,
          inline: true,
        },
        {
          name: 'Detected Pattern',
          value: proposal.detected_pattern.topic_cluster.join(', '),
          inline: false,
        },
        {
          name: 'Frequency',
          value: `${(proposal.detected_pattern.frequency * 100).toFixed(0)}% of conversations`,
          inline: true,
        },
        {
          name: 'Confidence',
          value: `${(proposal.detected_pattern.confidence * 100).toFixed(0)}%`,
          inline: true,
        },
        {
          name: 'User ID',
          value: userId,
          inline: true,
        },
      ],
      footer: {
        text: `Proposal ID: ${proposal.id}`,
      },
      timestamp: new Date().toISOString(),
    };

    const message: DiscordMessage = {
      content:
        '📢 Helix has detected a pattern and proposes a new agent:',
      embeds: [embed],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 3, // Green
              label: 'Approve',
              custom_id: `approve_proposal_${proposal.id}`,
            },
            {
              type: 2,
              style: 4, // Red
              label: 'Reject',
              custom_id: `reject_proposal_${proposal.id}`,
            },
          ],
        },
      ],
    };

    await this.sendWebhook(webhookUrl, message);
  }

  /**
   * Log autonomy action for approval
   */
  async logAutonomyAction(
    userId: string,
    action: AutonomyAction
  ): Promise<string> {
    await this.initialize();

    const webhookUrl = this.webhookUrls.get('autonomy');
    if (!webhookUrl) return '';

    const getRiskColor = (risk: string): number => {
      switch (risk) {
        case 'low':
          return 0x22c55e; // Green
        case 'medium':
          return 0xf59e0b; // Amber
        case 'high':
          return 0xef4444; // Red
        default:
          return 0x6b7280; // Gray
      }
    };

    const embed: DiscordEmbed = {
      title: '⚡ Action Awaiting Approval',
      description: action.action_description,
      color: getRiskColor(action.risk_level),
      fields: [
        {
          name: 'Action Type',
          value: action.action_type
            .split('_')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' '),
          inline: true,
        },
        {
          name: 'Risk Level',
          value: action.risk_level.toUpperCase(),
          inline: true,
        },
        {
          name: 'Status',
          value: 'Pending Approval',
          inline: true,
        },
        {
          name: 'User ID',
          value: userId,
          inline: true,
        },
      ],
      footer: {
        text: `Action ID: ${action.id}`,
      },
      timestamp: new Date().toISOString(),
    };

    const message: DiscordMessage = {
      content:
        '🔔 Helix is requesting approval for an action:',
      embeds: [embed],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 3, // Green
              label: 'Approve',
              custom_id: `approve_action_${action.id}`,
            },
            {
              type: 2,
              style: 4, // Red
              label: 'Reject',
              custom_id: `reject_action_${action.id}`,
            },
          ],
        },
      ],
    };

    const messageId = await this.sendWebhook(webhookUrl, message);
    return messageId;
  }

  /**
   * Log executed action to #helix-actions channel
   */
  async logExecutedAction(userId: string, action: AutonomyAction): Promise<void> {
    await this.initialize();

    const webhookUrl = this.webhookUrls.get('actions');
    if (!webhookUrl) return;

    const getStatusColor = (status: string): number => {
      switch (status) {
        case 'executed':
          return 0x22c55e; // Green
        case 'rejected':
          return 0xef4444; // Red
        case 'failed':
          return 0xf59e0b; // Amber
        default:
          return 0x6b7280; // Gray
      }
    };

    const embed: DiscordEmbed = {
      title: '✅ Action Executed',
      description: action.action_description,
      color: getStatusColor(action.status),
      fields: [
        {
          name: 'Action Type',
          value: action.action_type
            .split('_')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' '),
          inline: true,
        },
        {
          name: 'Status',
          value: action.status.toUpperCase(),
          inline: true,
        },
        {
          name: 'User ID',
          value: userId,
          inline: true,
        },
      ],
      footer: {
        text: `Action ID: ${action.id}`,
      },
      timestamp: action.executed_at?.toISOString() || new Date().toISOString(),
    };

    if (action.error_message) {
      embed.fields!.push({
        name: 'Error',
        value: action.error_message,
        inline: false,
      });
    }

    const message: DiscordMessage = {
      embeds: [embed],
    };

    await this.sendWebhook(webhookUrl, message);
  }

  /**
   * Log agent creation success
   */
  async logAgentCreated(userId: string, agent: Agent): Promise<void> {
    await this.initialize();

    const webhookUrl = this.webhookUrls.get('agents');
    if (!webhookUrl) return;

    const embed: DiscordEmbed = {
      title: '🎉 Agent Created',
      description: `**${agent.name}** is now available!`,
      color: 0x22c55e, // Green
      fields: [
        {
          name: 'Role',
          value: agent.role,
          inline: true,
        },
        {
          name: 'Created By',
          value: agent.created_by === 'system' ? 'Helix (auto-detected)' : 'User Request',
          inline: true,
        },
        {
          name: 'Autonomy Level',
          value: ['Propose-Only', 'Inform-After', 'Alert-Async', 'Autonomous'][
            agent.autonomy_level
          ],
          inline: true,
        },
        {
          name: 'Description',
          value: agent.description,
          inline: false,
        },
        {
          name: 'User ID',
          value: userId,
          inline: true,
        },
      ],
      footer: {
        text: `Agent ID: ${agent.id}`,
      },
      timestamp: agent.created_at.toISOString(),
    };

    const message: DiscordMessage = {
      embeds: [embed],
    };

    await this.sendWebhook(webhookUrl, message);
  }

  /**
   * Log personality evolution
   */
  async logPersonalityEvolution(userId: string, agent: Agent): Promise<void> {
    await this.initialize();

    const webhookUrl = this.webhookUrls.get('agents');
    if (!webhookUrl) return;

    const { personality } = agent;
    const embed: DiscordEmbed = {
      title: '🧠 Personality Evolution',
      description: `**${agent.name}** is learning...`,
      color: 0x6366f1, // Indigo
      fields: [
        {
          name: 'Verbosity',
          value: this.getBar(personality.verbosity),
          inline: true,
        },
        {
          name: 'Formality',
          value: this.getBar(personality.formality),
          inline: true,
        },
        {
          name: 'Creativity',
          value: this.getBar(personality.creativity),
          inline: true,
        },
        {
          name: 'Proactivity',
          value: this.getBar(personality.proactivity),
          inline: true,
        },
        {
          name: 'Warmth',
          value: this.getBar(personality.warmth),
          inline: true,
        },
        {
          name: 'Conversations',
          value: String(agent.conversation_count),
          inline: true,
        },
        {
          name: 'User ID',
          value: userId,
          inline: true,
        },
      ],
      footer: {
        text: `Agent ID: ${agent.id}`,
      },
      timestamp: new Date().toISOString(),
    };

    const message: DiscordMessage = {
      embeds: [embed],
    };

    await this.sendWebhook(webhookUrl, message);
  }

  // Private helper methods

  private async sendWebhook(
    webhookUrl: string,
    message: DiscordMessage
  ): Promise<string> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(
          `Discord webhook failed: ${response.status} ${response.statusText}`
        );
      }

      // Return message ID if available in response
      const data = await response.json();
      return data.id || '';
    } catch (error) {
      console.error('Failed to send Discord webhook:', error);
      // Don't throw - logging failures shouldn't block operations
      return '';
    }
  }

  private getBar(value: number): string {
    const filled = Math.round(value * 10);
    const empty = 10 - filled;
    return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${(value * 100).toFixed(0)}%`;
  }
}

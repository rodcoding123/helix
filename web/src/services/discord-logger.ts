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
 * Browser-compatible Discord logger service
 * Logs agent proposals and autonomy actions to Discord via API endpoint
 */
export class DiscordLoggerService {
  async initialize(): Promise<void> {
    // No initialization needed - will call API endpoint directly
  }

  /**
   * Send message to Discord via API endpoint
   */
  private async sendMessage(
    channel: 'agents' | 'autonomy' | 'actions',
    message: DiscordMessage
  ): Promise<void> {
    try {
      const response = await fetch('/api/discord-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel, message }),
      });

      if (!response.ok) {
        console.error(`Failed to send Discord message to ${channel}`);
      }
    } catch (error) {
      console.error(`Discord logging error for ${channel}:`, error);
      // Non-fatal - don't throw
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
    };

    await this.sendMessage('agents', message);
  }

  /**
   * Log pending autonomy action to #helix-autonomy channel
   */
  async logAutonomyAction(
    userId: string,
    action: AutonomyAction
  ): Promise<string> {
    await this.initialize();

    const riskColor = {
      low: 0x22c55e, // Green
      medium: 0xeab308, // Yellow
      high: 0xef4444, // Red
    }[action.risk_level] || 0x808080;

    const embed: DiscordEmbed = {
      title: `⚠️ ${action.action_type
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')} Pending Approval`,
      description: action.action_description,
      color: riskColor,
      fields: [
        {
          name: 'Risk Level',
          value: action.risk_level.toUpperCase(),
          inline: true,
        },
        {
          name: 'Status',
          value: action.status,
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
      content: '🔔 A new action requires your approval:',
      embeds: [embed],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 3,
              label: 'Approve',
              custom_id: `approve_action_${action.id}`,
            },
            {
              type: 2,
              style: 4,
              label: 'Reject',
              custom_id: `reject_action_${action.id}`,
            },
          ],
        },
      ],
    };

    await this.sendMessage('autonomy', message);
    return action.id;
  }

  /**
   * Log executed action result
   */
  async logExecutedAction(_userId: string, action: AutonomyAction): Promise<void> {
    await this.initialize();

    const statusColor = {
      pending: 0xeab308,
      approved: 0x22c55e,
      rejected: 0xef4444,
      failed: 0xef4444,
      completed: 0x22c55e,
      executed: 0x22c55e,
    }[action.status] || 0x808080;

    const embed: DiscordEmbed = {
      title: `✅ Action ${action.status.charAt(0).toUpperCase() + action.status.slice(1)}`,
      description: action.action_description,
      color: statusColor,
      fields: [
        {
          name: 'Action Type',
          value: action.action_type,
          inline: true,
        },
        {
          name: 'Status',
          value: action.status,
          inline: true,
        },
        {
          name: 'User ID',
          value: _userId,
          inline: true,
        },
      ],
      footer: {
        text: `Action ID: ${action.id}`,
      },
      timestamp: new Date().toISOString(),
    };

    const message: DiscordMessage = {
      content: `📝 Action execution completed:`,
      embeds: [embed],
    };

    await this.sendMessage('actions', message);
  }

  /**
   * Log agent creation
   */
  async logAgentCreated(userId: string, agent: Agent): Promise<void> {
    await this.initialize();

    const embed: DiscordEmbed = {
      title: '🆕 Agent Created',
      description: agent.description,
      color: 0x06b6d4, // Cyan
      fields: [
        {
          name: 'Agent Name',
          value: agent.name,
          inline: true,
        },
        {
          name: 'Role',
          value: agent.role,
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
      content: '🎉 A new agent has been created!',
      embeds: [embed],
    };

    await this.sendMessage('agents', message);
  }

  /**
   * Log agent personality evolution
   */
  async logPersonalityEvolution(_userId: string, agent: Agent): Promise<void> {
    await this.initialize();

    const { personality } = agent;
    const embed: DiscordEmbed = {
      title: '🧠 Personality Evolution',
      description: `${agent.name}'s personality has evolved through interactions`,
      color: 0xa855f7, // Purple
      fields: [
        {
          name: 'Agent',
          value: agent.name,
          inline: true,
        },
        {
          name: 'Verbosity',
          value: `${(personality.verbosity * 100).toFixed(0)}%`,
          inline: true,
        },
        {
          name: 'Formality',
          value: `${(personality.formality * 100).toFixed(0)}%`,
          inline: true,
        },
        {
          name: 'Creativity',
          value: `${(personality.creativity * 100).toFixed(0)}%`,
          inline: true,
        },
        {
          name: 'Proactivity',
          value: `${(personality.proactivity * 100).toFixed(0)}%`,
          inline: true,
        },
        {
          name: 'Warmth',
          value: `${(personality.warmth * 100).toFixed(0)}%`,
          inline: true,
        },
      ],
      footer: {
        text: `Agent ID: ${agent.id}`,
      },
      timestamp: new Date().toISOString(),
    };

    const message: DiscordMessage = {
      content: '📊 Agent personality update:',
      embeds: [embed],
    };

    await this.sendMessage('agents', message);
  }
}

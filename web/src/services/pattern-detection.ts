import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { loadSecret } from '@/lib/secrets-loader';
import type { Conversation } from '@/lib/types/memory';
import type { AgentProposal, PatternAnalysisResult } from '@/lib/types/agents';
import { DiscordLoggerService } from './discord-logger';

/**
 * PatternDetectionService: Analyzes user conversations to detect patterns
 * and suggest new agents that would be helpful
 */
export class PatternDetectionService {
  private supabase: SupabaseClient | null = null;
  private discordLogger: DiscordLoggerService | null = null;

  private async getSupabaseClient(): Promise<SupabaseClient> {
    if (this.supabase) return this.supabase;

    const url = await loadSecret('Supabase URL');
    const anonKey = await loadSecret('Supabase Anon Key');

    this.supabase = createClient(url, anonKey);
    return this.supabase;
  }

  private getDiscordLogger(): DiscordLoggerService {
    if (!this.discordLogger) {
      this.discordLogger = new DiscordLoggerService();
    }
    return this.discordLogger;
  }

  /**
   * Detect agent proposals based on user's conversation patterns
   * Analyzes topics, emotions, and workflows to suggest helpful agents
   */
  async detectAgentProposals(userId: string): Promise<AgentProposal[]> {
    try {
      const supabase = await this.getSupabaseClient();

      // Get recent memories for pattern analysis
      const { data: memories, error } = await supabase
        .from('conversations')
        .select()
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw new Error(`Failed to fetch memories: ${error.message}`);
      }

      if (!memories || memories.length === 0) {
        return [];
      }

      // Analyze patterns
      const analysis = this.analyzePatterns(memories);

      // Get existing agents to avoid duplicate proposals
      const { data: existingAgents } = await supabase
        .from('agents')
        .select('role')
        .eq('user_id', userId)
        .eq('enabled', true);

      const existingRoles = (existingAgents || []).map((a) =>
        a.role.toLowerCase()
      );

      // Convert analysis to proposals
      const proposalsToPersist = analysis.recommendations
        .filter((recommendation) => {
          // Don't propose if agent already exists
          return !existingRoles.some((role) =>
            role.includes(recommendation.proposed_role.toLowerCase())
          );
        })
        .map((recommendation) => ({
          user_id: userId,
          proposed_name: recommendation.proposed_name,
          proposed_role: recommendation.proposed_role,
          reason: recommendation.reason,
          detected_pattern: recommendation.detected_pattern,
          status: 'pending',
        }));

      // Persist proposals to database
      const proposals: AgentProposal[] = [];
      if (proposalsToPersist.length > 0) {
        const { data: persistedProposals, error: persistError } = await supabase
          .from('agent_proposals')
          .insert(proposalsToPersist)
          .select();

        if (persistError) {
          console.error('Failed to persist proposals to database:', persistError);
        } else if (persistedProposals) {
          // Format persisted proposals
          for (const persisted of persistedProposals) {
            proposals.push({
              id: persisted.id,
              user_id: persisted.user_id,
              proposed_name: persisted.proposed_name,
              proposed_role: persisted.proposed_role,
              reason: persisted.reason,
              detected_pattern: persisted.detected_pattern,
              status: persisted.status,
              created_at: new Date(persisted.created_at),
            });
          }
        }
      }

      // Log proposals to Discord (non-fatal if it fails)
      if (proposals.length > 0) {
        try {
          const discordLogger = this.getDiscordLogger();
          for (const proposal of proposals) {
            await discordLogger.logAgentProposal(userId, proposal);
          }
        } catch (discordError) {
          console.error('Failed to log proposals to Discord:', discordError);
          // Don't throw - Discord logging is non-fatal
        }
      }

      return proposals;
    } catch (error) {
      console.error('Failed to detect agent proposals:', error);
      return [];
    }
  }

  /**
   * Analyze conversation patterns to identify trends and opportunities
   */
  private analyzePatterns(memories: Conversation[]): PatternAnalysisResult {
    const topicClusters = this.analyzeTopicClusters(memories);
    const emotionPatterns = this.analyzeEmotionPatterns(memories);
    const workflowPatterns = this.analyzeWorkflowPatterns(memories);

    // Generate recommendations based on patterns
    const recommendations = this.generateRecommendations(
      topicClusters,
      emotionPatterns,
      workflowPatterns
    );

    return {
      topicClusters,
      emotionPatterns,
      workflowPatterns,
      recommendations,
    };
  }

  /**
   * Cluster topics by frequency and relevance
   */
  private analyzeTopicClusters(
    memories: Conversation[]
  ): Array<{
    topic: string;
    frequency: number;
    confidence: number;
  }> {
    const topicCounts = new Map<string, number>();

    // Count topic occurrences
    for (const memory of memories) {
      if (memory.extracted_topics && Array.isArray(memory.extracted_topics)) {
        for (const topic of memory.extracted_topics) {
          topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
        }
      }
    }

    // Convert to array and filter for significant patterns
    const clusters = Array.from(topicCounts.entries())
      .map(([topic, count]) => {
        const frequency = count / memories.length;
        return {
          topic,
          frequency,
          confidence: Math.min(1, frequency * 2), // Higher frequency = higher confidence
        };
      })
      .filter((cluster) => cluster.frequency >= 0.1) // At least 10% of conversations
      .sort((a, b) => b.frequency - a.frequency);

    return clusters;
  }

  /**
   * Find emotion-topic correlations
   */
  private analyzeEmotionPatterns(
    memories: Conversation[]
  ): Array<{
    emotion: string;
    topic: string;
    correlation: number;
  }> {
    const patterns: Array<{
      emotion: string;
      topic: string;
      count: number;
    }> = [];

    // Find emotion-topic pairs
    for (const memory of memories) {
      const emotion = memory.primary_emotion || 'neutral';
      const topics = memory.extracted_topics || [];

      for (const topic of topics) {
        const existing = patterns.find(
          (p) => p.emotion === emotion && p.topic === topic
        );
        if (existing) {
          existing.count++;
        } else {
          patterns.push({ emotion, topic, count: 1 });
        }
      }
    }

    // Calculate correlation strength
    return patterns
      .map((p) => ({
        ...p,
        correlation: p.count / memories.length,
      }))
      .filter((p) => p.correlation >= 0.05) // At least 5% of conversations
      .sort((a, b) => b.correlation - a.correlation);
  }

  /**
   * Detect sequential patterns in user behavior
   */
  private analyzeWorkflowPatterns(
    memories: Conversation[]
  ): Array<{
    sequence: string[];
    frequency: number;
  }> {
    const sequences = new Map<string, number>();

    // Find topic sequences (what topics follow other topics)
    for (let i = 0; i < memories.length - 1; i++) {
      const current = memories[i];
      const next = memories[i + 1];

      const currentTopics = (current.extracted_topics || [])[0];
      const nextTopics = (next.extracted_topics || [])[0];

      if (currentTopics && nextTopics && currentTopics !== nextTopics) {
        const sequence = `${currentTopics} → ${nextTopics}`;
        sequences.set(sequence, (sequences.get(sequence) || 0) + 1);
      }
    }

    // Convert to array and filter significant workflows
    return Array.from(sequences.entries())
      .map(([sequence, count]) => ({
        sequence: sequence.split(' → '),
        frequency: count / memories.length,
      }))
      .filter((w) => w.frequency >= 0.1)
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Generate agent recommendations based on detected patterns
   */
  private generateRecommendations(
    topicClusters: Array<{ topic: string; frequency: number; confidence: number }>,
    emotionPatterns: Array<{ emotion: string; topic: string; correlation: number }>,
    workflowPatterns: Array<{ sequence: string[]; frequency: number }>
  ): AgentProposal[] {
    const recommendations: AgentProposal[] = [];

    // Recommendation 1: Topic-based agents
    // If a topic appears frequently, suggest an agent for that topic
    for (const cluster of topicClusters.slice(0, 3)) {
      if (cluster.frequency >= 0.15) {
        const agentName = this.capitalizeWords(
          `${cluster.topic} Assistant`
        );
        const reason = `I noticed you discuss ${cluster.topic} frequently (${(cluster.frequency * 100).toFixed(0)}% of conversations)`;

        recommendations.push({
          id: `proposal_topic_${cluster.topic}`,
          user_id: '',
          proposed_name: agentName,
          proposed_role: `${cluster.topic} Specialist`,
          reason,
          detected_pattern: {
            topic_cluster: [cluster.topic],
            frequency: cluster.frequency,
            confidence: cluster.confidence,
            context: `User discusses this topic regularly`,
          },
          status: 'pending',
          created_at: new Date(),
        });
      }
    }

    // Recommendation 2: Emotion-based agents
    // If a topic consistently triggers strong emotions, suggest support
    const strongEmotionPatterns = emotionPatterns
      .filter((p) => p.correlation >= 0.1 && ['anxiety', 'frustration', 'sadness'].includes(p.emotion))
      .slice(0, 2);

    for (const pattern of strongEmotionPatterns) {
      const agentName = this.capitalizeWords(`${pattern.emotion} Support`);
      const reason = `I notice you often feel ${pattern.emotion} about ${pattern.topic}. An agent specialized in ${pattern.topic} support might help.`;

      recommendations.push({
        id: `proposal_emotion_${pattern.topic}`,
        user_id: '',
        proposed_name: agentName,
        proposed_role: `${pattern.topic} Support Specialist`,
        reason,
        detected_pattern: {
          topic_cluster: [pattern.topic],
          frequency: pattern.correlation,
          confidence: pattern.correlation,
          context: `Triggers ${pattern.emotion} consistently`,
        },
        status: 'pending',
        created_at: new Date(),
      });
    }

    // Recommendation 3: Workflow-based agents
    // If a sequence of topics repeats, suggest workflow automation
    if (workflowPatterns.length > 0) {
      const topWorkflow = workflowPatterns[0];
      const workflowName = `${topWorkflow.sequence[0]} → ${topWorkflow.sequence[1]} Workflow`;

      const reason = `I see you often go from discussing ${topWorkflow.sequence[0]} to ${topWorkflow.sequence[1]}. An agent could help streamline this workflow.`;

      recommendations.push({
        id: `proposal_workflow_${topWorkflow.sequence.join('_')}`,
        user_id: '',
        proposed_name: workflowName,
        proposed_role: 'Workflow Coordinator',
        reason,
        detected_pattern: {
          topic_cluster: topWorkflow.sequence,
          frequency: topWorkflow.frequency,
          confidence: topWorkflow.frequency,
          context: `Repeated workflow pattern detected`,
        },
        status: 'pending',
        created_at: new Date(),
      });
    }

    return recommendations;
  }

  /**
   * Capitalize words in a string
   */
  private capitalizeWords(str: string): string {
    return str
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

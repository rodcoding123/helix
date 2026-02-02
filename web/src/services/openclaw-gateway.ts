import { loadSecret } from '@/lib/secrets-loader';

interface OpenClawToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface OpenClawExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executedAt: Date;
}

/**
 * OpenClawGatewayService: Communicates with OpenClaw engine
 * Handles tool execution, skill management, and code modifications
 */
export class OpenClawGatewayService {
  private gatewayUrl: string | null = null;
  private apiKey: string | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.gatewayUrl = await loadSecret('OpenClaw Gateway URL');
      this.apiKey = await loadSecret('OpenClaw API Key');
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize OpenClaw gateway:', error);
      // Gateway is optional - continue without it
    }
  }

  /**
   * Execute a tool via OpenClaw
   */
  async executeTool(
    toolName: string,
    parameters: Record<string, unknown>
  ): Promise<OpenClawExecutionResult> {
    await this.initialize();

    if (!this.gatewayUrl || !this.apiKey) {
      return {
        success: false,
        error: 'OpenClaw gateway not configured',
        executedAt: new Date(),
      };
    }

    try {
      const response = await fetch(`${this.gatewayUrl}/tools/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          toolName,
          parameters,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Tool execution failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return {
        success: true,
        output: data.output,
        executedAt: new Date(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        executedAt: new Date(),
      };
    }
  }

  /**
   * Register a new skill with OpenClaw
   */
  async registerSkill(
    skillName: string,
    description: string,
    toolDefinitions: OpenClawToolDefinition[]
  ): Promise<OpenClawExecutionResult> {
    await this.initialize();

    if (!this.gatewayUrl || !this.apiKey) {
      return {
        success: false,
        error: 'OpenClaw gateway not configured',
        executedAt: new Date(),
      };
    }

    try {
      const response = await fetch(`${this.gatewayUrl}/skills/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          skillName,
          description,
          tools: toolDefinitions,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Skill registration failed: ${response.status} ${response.statusText}`
        );
      }

      return {
        success: true,
        output: `Skill "${skillName}" registered successfully`,
        executedAt: new Date(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        executedAt: new Date(),
      };
    }
  }

  /**
   * Propose code modifications to Helix's codebase
   */
  async proposeCodeModification(
    filePath: string,
    proposedChanges: string,
    reason: string
  ): Promise<OpenClawExecutionResult> {
    await this.initialize();

    if (!this.gatewayUrl || !this.apiKey) {
      return {
        success: false,
        error: 'OpenClaw gateway not configured',
        executedAt: new Date(),
      };
    }

    try {
      const response = await fetch(
        `${this.gatewayUrl}/code/propose-modifications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            filePath,
            proposedChanges,
            reason,
            timestamp: new Date().toISOString(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Code modification proposal failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return {
        success: true,
        output: `Code modification proposed for review (PR: ${data.prId})`,
        executedAt: new Date(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        executedAt: new Date(),
      };
    }
  }

  /**
   * Get list of available tools in OpenClaw
   */
  async getAvailableTools(): Promise<OpenClawToolDefinition[]> {
    await this.initialize();

    if (!this.gatewayUrl || !this.apiKey) {
      console.warn('OpenClaw gateway not configured, returning empty tools list');
      return [];
    }

    try {
      const response = await fetch(`${this.gatewayUrl}/tools/list`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch tools: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data.tools || [];
    } catch (error) {
      console.error('Failed to get available tools:', error);
      return [];
    }
  }

  /**
   * Send heartbeat to OpenClaw gateway
   */
  async sendHeartbeat(): Promise<boolean> {
    await this.initialize();

    if (!this.gatewayUrl || !this.apiKey) {
      return false;
    }

    try {
      const response = await fetch(`${this.gatewayUrl}/health`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('OpenClaw gateway heartbeat failed:', error);
      return false;
    }
  }
}

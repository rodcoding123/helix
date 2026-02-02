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
 * Browser-compatible OpenClaw gateway service
 * Communicates with OpenClaw engine via API endpoints
 */
export class OpenClawGatewayService {
  async initialize(): Promise<void> {
    // No initialization needed - will call API endpoint directly
  }

  /**
   * Execute a tool via OpenClaw
   */
  async executeTool(
    toolName: string,
    parameters: Record<string, unknown>
  ): Promise<OpenClawExecutionResult> {
    await this.initialize();

    try {
      const response = await fetch('/api/openclaw/execute-tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolName,
          parameters,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `Tool execution failed: ${response.status} ${error}`
        );
      }

      const data = await response.json() as { output?: string };
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

    try {
      const response = await fetch('/api/openclaw/register-skill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          skillName,
          description,
          tools: toolDefinitions,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `Skill registration failed: ${response.status} ${error}`
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

    try {
      const response = await fetch('/api/openclaw/propose-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath,
          proposedChanges,
          reason,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `Code modification proposal failed: ${response.status} ${error}`
        );
      }

      const data = await response.json() as { prId?: string };
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

    try {
      const response = await fetch('/api/openclaw/tools', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(
          `Failed to fetch tools: ${response.status}`
        );
        return [];
      }

      const data = await response.json() as { tools?: OpenClawToolDefinition[] };
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

    try {
      const response = await fetch('/api/openclaw/health', {
        method: 'GET',
      });

      return response.ok;
    } catch (error) {
      console.error('OpenClaw gateway heartbeat failed:', error);
      return false;
    }
  }
}

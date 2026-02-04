# Phase 8: LLM-First Intelligence Layer - Final Blueprint

**Date:** February 4, 2026
**Status:** Implementation Ready
**Architecture:** Framework-Agnostic, Analytics-First, Privacy-Preserving
**Integration Model:** Gateway Methods + Skill Sandbox + Helix Logging

---

## Executive Vision

Phase 8 adds **intelligent assistance** to Helix via LLM routing, while maintaining:

1. **User Transparency** - Users see costs, efficiency, success rates
2. **Framework Invisibility** - No "TRAE" or "Lingxi" exposed; system picks best silently
3. **Code Privacy** - Code never stored; only metadata tracked
4. **Research-First** - All analytics feed Observatory for future managed offerings
5. **Helix Integration** - Leverage existing logging, security, gateway infrastructure

**Key Principle:** Frameworks are implementation details. Users care about results.

---

## Part 1: LLM Router (Reuses Existing Helix LLM Support)

### 1.1 Router Design (Leveraging Existing Infrastructure)

Helix already has (`/helix-runtime/src/agents/models-config.ts`):

- Multi-provider support (Anthropic, OpenAI, Google, AWS Bedrock)
- Model discovery and merging
- Token counting and cost tracking
- Fallback chains

**We build on top:**

```typescript
// web/src/services/llm-router/llm-router.ts

export class LLMRouter {
  private providers: Map<string, LLMProvider>;
  private costTracker: CostTracker;
  private analyticsCollector: AnalyticsCollector;

  async route(request: LLMRequest): Promise<LLMResponse> {
    // 1. Resolve provider from user settings
    const provider = await this.resolveProvider(request.userId, request.role);

    // 2. Start timing for latency tracking
    const startTime = performance.now();

    try {
      // 3. Call provider
      const response = await provider.complete(request);

      // 4. Track analytics IMMEDIATELY
      await this.analyticsCollector.track({
        userId: request.userId,
        role: request.role,
        provider: provider.id,
        model: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        cost: response.cost,
        latency: performance.now() - startTime,
        success: true,
        framework: request.framework || 'direct',
        taskType: request.taskType,
      });

      // 5. Log to Discord (pre-execution logging per CLAUDE.md)
      await logToDiscord('#helix-api', {
        type: 'llm_request',
        role: request.role,
        provider: provider.id,
        cost: response.cost,
        latency: performance.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return response;
    } catch (error) {
      // Track failure
      await this.analyticsCollector.track({
        userId: request.userId,
        role: request.role,
        provider: provider.id,
        success: false,
        error: error.message,
        latency: performance.now() - startTime,
      });

      throw error;
    }
  }

  private async resolveProvider(userId: string, role: string): Promise<LLMProvider> {
    const settings = await getUserLLMSettings(userId);
    const roleConfig = settings.roleConfigs[role];

    if (!roleConfig?.primaryProvider) {
      throw new Error(`No provider configured for role: ${role}`);
    }

    const provider = this.providers.get(roleConfig.primaryProvider);
    if (!provider) {
      throw new Error(`Provider not found: ${roleConfig.primaryProvider}`);
    }

    return provider;
  }
}
```

### 1.2 Cost Tracking (Transparent to User)

```typescript
// web/src/services/llm-router/cost-tracker.ts

export class CostTracker {
  async recordRequest(data: {
    userId: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    role?: string;
    success: boolean;
  }): Promise<void> {
    const cost = this.calculateCost(data.provider, data.inputTokens, data.outputTokens);

    // Store in database for user dashboard visibility
    await db.insert('llm_costs', {
      userId: data.userId,
      provider: data.provider,
      model: data.model,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      cost,
      role: data.role,
      success: data.success,
      timestamp: new Date(),
      month: getMonth(new Date()),
    });

    // Update user's monthly total
    await updateUserMonthlySpend(data.userId, cost);
  }

  private calculateCost(provider: string, input: number, output: number): number {
    const rates: Record<string, { input: number; output: number }> = {
      deepseek: { input: 0.1 / 1_000_000, output: 0.4 / 1_000_000 },
      gemini: { input: 0.038 / 1_000_000, output: 0.15 / 1_000_000 },
      claude: { input: 0.8 / 1_000_000, output: 4.0 / 1_000_000 },
      openai: { input: 0.5 / 1_000_000, output: 1.5 / 1_000_000 },
    };

    const rate = rates[provider];
    return input * rate.input + output * rate.output;
  }
}
```

---

## Part 2: Role Intelligence (Framework Hidden)

### 2.1 Role Definitions

```typescript
// web/src/services/intelligence/roles.ts

export const INTELLIGENCE_ROLES = {
  'email-compose': {
    name: 'Email Composition',
    description: 'AI-assisted email drafting',
    complexity: 'simple',
    taskType: 'generation',
    estimatedTokens: 200,
  },
  'email-classify': {
    name: 'Email Classification',
    description: 'Auto-categorize and extract metadata',
    complexity: 'simple',
    taskType: 'classification',
    estimatedTokens: 150,
  },
  'email-respond': {
    name: 'Email Response Suggestions',
    description: 'Smart reply suggestions with context',
    complexity: 'medium',
    taskType: 'generation',
    estimatedTokens: 300,
  },
  'calendar-prep': {
    name: 'Meeting Preparation',
    description: 'Synthesize context before meetings',
    complexity: 'complex',
    taskType: 'synthesis',
    estimatedTokens: 800,
  },
  'calendar-time': {
    name: 'Time Blocking',
    description: 'Suggest optimal meeting times',
    complexity: 'medium',
    taskType: 'reasoning',
    estimatedTokens: 250,
  },
  'task-prioritize': {
    name: 'Task Prioritization',
    description: 'AI-reorder tasks by impact',
    complexity: 'complex',
    taskType: 'reasoning',
    estimatedTokens: 600,
  },
  'task-breakdown': {
    name: 'Task Breakdown',
    description: 'Suggest subtasks for projects',
    complexity: 'medium',
    taskType: 'generation',
    estimatedTokens: 400,
  },
  'analytics-summary': {
    name: 'Weekly Summary',
    description: 'Generate insights from past week',
    complexity: 'complex',
    taskType: 'synthesis',
    estimatedTokens: 1200,
  },
  'analytics-anomaly': {
    name: 'Anomaly Detection',
    description: 'Identify unusual patterns',
    complexity: 'medium',
    taskType: 'analysis',
    estimatedTokens: 300,
  },
  // Code Tool roles
  'code-analyze': {
    name: 'Code Analysis',
    description: 'Analyze code for issues',
    complexity: 'complex',
    taskType: 'analysis',
    estimatedTokens: 2000,
  },
  'code-implement': {
    name: 'Code Implementation',
    description: 'Generate code solutions',
    complexity: 'complex',
    taskType: 'generation',
    estimatedTokens: 3000,
  },
  'code-review': {
    name: 'Code Review',
    description: 'Review code for improvements',
    complexity: 'complex',
    taskType: 'analysis',
    estimatedTokens: 1500,
  },
} as const;
```

### 2.2 Framework Router (Hidden from Users)

**Users never see "TRAE" or "Lingxi". System picks silently based on task type + success history.**

```typescript
// web/src/services/intelligence/framework-router.ts

export class FrameworkRouter {
  async selectFramework(
    role: string,
    userId: string
  ): Promise<{ framework: string; provider: string; reasoning: string }> {
    const analytics = await getAnalytics(userId, role);

    // 1. Task type → suggested framework
    const roleConfig = INTELLIGENCE_ROLES[role];
    const suggestedFramework = this.suggestFrameworkForTaskType(roleConfig.taskType);

    // 2. Historical success rates → adjust recommendation
    if (analytics.successRate < 0.8) {
      // High failure rate → try different framework
      return this.findBestPerformer(userId, role);
    }

    if (analytics.avgLatency > 5000) {
      // Slow → try faster framework
      return this.findFastestFramework(userId, role);
    }

    // 3. Cost optimization
    if (analytics.costPerSuccess > 1.0) {
      // Expensive → try cheaper framework
      return this.findCheapestFramework(userId, role);
    }

    // 4. Default to suggested
    return {
      framework: suggestedFramework,
      provider: 'auto-select',
      reasoning: `Optimized for ${roleConfig.taskType}. Success: ${(analytics.successRate * 100).toFixed(0)}%`,
    };
  }

  private suggestFrameworkForTaskType(taskType: string): string {
    const mapping: Record<string, string> = {
      generation: 'direct', // Simple LLM call
      classification: 'direct', // Pattern matching
      synthesis: 'multi-agent', // Lingxi multi-specialist
      reasoning: 'optimizer', // SWE-Agent history optimization
      analysis: 'orchestrator', // TRAE multi-tool
    };
    return mapping[taskType] || 'direct';
  }

  private async findBestPerformer(
    userId: string,
    role: string
  ): Promise<{ framework: string; provider: string; reasoning: string }> {
    const history = await getRequestHistory(userId, role);

    // Group by framework/provider combo
    const byCombo = groupBy(history, r => `${r.framework}/${r.provider}`);

    // Find highest success rate
    let best = { combo: '', rate: 0, avgCost: 0 };
    for (const [combo, requests] of Object.entries(byCombo)) {
      const rate = requests.filter(r => r.success).length / requests.length;
      if (rate > best.rate) {
        best = {
          combo,
          rate,
          avgCost: sum(requests.map(r => r.cost)) / requests.length,
        };
      }
    }

    const [framework, provider] = best.combo.split('/');
    return {
      framework,
      provider,
      reasoning: `Best performer: ${(best.rate * 100).toFixed(0)}% success, $${best.avgCost.toFixed(3)}/request`,
    };
  }

  private async findCheapestFramework(
    userId: string,
    role: string
  ): Promise<{ framework: string; provider: string; reasoning: string }> {
    const history = await getRequestHistory(userId, role);
    const successful = history.filter(r => r.success);

    if (successful.length === 0) {
      return { framework: 'direct', provider: 'cheapest', reasoning: 'No history, using default' };
    }

    // Find cheapest per successful completion
    let cheapest = { combo: '', costPerSuccess: Infinity };
    const byCombo = groupBy(successful, r => `${r.framework}/${r.provider}`);

    for (const [combo, requests] of Object.entries(byCombo)) {
      const totalCost = sum(requests.map(r => r.cost));
      const costPerSuccess = totalCost / requests.length;
      if (costPerSuccess < cheapest.costPerSuccess) {
        cheapest = { combo, costPerSuccess };
      }
    }

    const [framework, provider] = cheapest.combo.split('/');
    return {
      framework,
      provider,
      reasoning: `Cost optimized: $${cheapest.costPerSuccess.toFixed(4)}/success`,
    };
  }

  private async findFastestFramework(
    userId: string,
    role: string
  ): Promise<{ framework: string; provider: string; reasoning: string }> {
    const history = await getRequestHistory(userId, role);
    const byCombo = groupBy(history, r => `${r.framework}/${r.provider}`);

    let fastest = { combo: '', latency: Infinity };
    for (const [combo, requests] of Object.entries(byCombo)) {
      const avgLatency = sum(requests.map(r => r.latency)) / requests.length;
      if (avgLatency < fastest.latency) {
        fastest = { combo, latency: avgLatency };
      }
    }

    const [framework, provider] = fastest.combo.split('/');
    return {
      framework,
      provider,
      reasoning: `Fastest: ${(fastest.latency / 1000).toFixed(2)}s avg`,
    };
  }
}
```

---

## Part 3: Code Tool (Premium, BYOK-Only, Analytics-Heavy)

### 3.1 Code Tool Architecture

**Important:** Code Tool is separate premium tier, BYOK-only. Heavy analytics focus for research.

```typescript
// helix-runtime/src/services/code-tool/types.ts

export interface CodeToolRequest {
  type: 'analyze' | 'implement' | 'review' | 'debug' | 'refactor';
  code?: string;
  language?: string;
  context?: string;
  repository?: string;
  userId: string;
  sessionId: string;
}

export interface CodeToolMetadata {
  // Privacy-first: We NEVER store code content
  requestId: string;
  userId: string;
  type: 'analyze' | 'implement' | 'review' | 'debug' | 'refactor';
  language?: string;
  category?: string; // Inferred category (e.g., 'auth', 'api', 'ui')
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latency: number;
  success: boolean;
  errorType?: string; // If failed
  provider: string;
  model: string;
  framework?: string; // Which framework was used
  timestamp: Date;
  month: string;
}

export interface CodeToolAnalytics {
  userId: string;
  month: string;
  metrics: {
    totalRequests: number;
    successRate: number;
    totalCost: number;
    avgLatency: number;
    avgTokensPerRequest: number;
    avgCostPerSuccess: number;

    // Breakdown by task type
    byType: Record<
      'analyze' | 'implement' | 'review' | 'debug' | 'refactor',
      {
        count: number;
        successRate: number;
        avgCost: number;
        avgLatency: number;
      }
    >;

    // Breakdown by provider
    byProvider: Record<
      string,
      {
        count: number;
        successRate: number;
        avgCost: number;
        avgLatency: number;
      }
    >;

    // Breakdown by language
    byLanguage: Record<
      string,
      {
        count: number;
        successRate: number;
        avgCost: number;
      }
    >;

    // KPIs
    kpis: {
      promptEfficiency: number; // Tokens used per successful task
      costEfficiency: number; // Cost per successful task
      speedScore: number; // Latency score (lower = better)
      reliabilityScore: number; // Success rate
      overallQualityScore: number; // Weighted KPI
    };
  };
}
```

### 3.2 Code Tool Entry Point (Gateway Method)

Integrates as a **Gateway RPC Method** (not generic plugin) for direct access to logging & security.

```typescript
// helix-runtime/src/gateway/server-methods/code-tool.ts

export async function registerCodeToolMethods(server: GatewayServer): Promise<void> {
  server.registerMethod('code.execute', async (ctx, params) => {
    const { type, code, language, context, userId } = params;

    // 1. Validate user has Code Tool tier
    const user = await db.users.get(userId);
    if (!user.hasPremium || !user.codeToolEnabled) {
      throw new Error('Code Tool requires premium subscription');
    }

    // 2. Validate BYOK setup
    const config = await getCodeToolConfig(userId);
    if (!config.primaryProvider || !config.primaryProvider.apiKey) {
      throw new Error('Code Tool requires LLM provider setup');
    }

    // 3. Pre-execution logging (per CLAUDE.md)
    const requestId = generateId();
    await logToDiscord('#helix-api', {
      type: 'code_tool_request',
      requestId,
      taskType: type,
      userId,
      language,
      timestamp: new Date().toISOString(),
      status: 'pending',
    });

    try {
      // 4. Route to framework (silently)
      const framework = await selectFramework(type, userId);
      const response = await executeWithFramework(framework, {
        type,
        code,
        language,
        context,
        userId,
      });

      // 5. Store METADATA ONLY (never code content)
      const metadata: CodeToolMetadata = {
        requestId,
        userId,
        type,
        language,
        category: inferCategory(type, language),
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        cost: response.cost,
        latency: response.latency,
        success: true,
        provider: config.primaryProvider.id,
        model: config.primaryProvider.model,
        framework: framework.name,
        timestamp: new Date(),
        month: getMonth(new Date()),
      };

      await db.codeToolMetadata.insert(metadata);

      // 6. Update analytics
      await updateCodeToolAnalytics(userId, metadata);

      // 7. Post-execution logging
      await logToDiscord('#helix-api', {
        type: 'code_tool_result',
        requestId,
        status: 'success',
        cost: response.cost,
        latency: response.latency,
      });

      // 8. Return RESULT ONLY (never store code)
      return {
        requestId,
        result: response.output,
        metadata: {
          cost: response.cost,
          latency: response.latency,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
        },
      };
    } catch (error) {
      // Store failure metadata
      const metadata: CodeToolMetadata = {
        requestId,
        userId,
        type,
        language,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        latency: 0,
        success: false,
        errorType: error.code,
        provider: config.primaryProvider.id,
        model: config.primaryProvider.model,
        timestamp: new Date(),
        month: getMonth(new Date()),
      };

      await db.codeToolMetadata.insert(metadata);
      await updateCodeToolAnalytics(userId, metadata);

      await logToDiscord('#helix-alerts', {
        type: 'code_tool_error',
        requestId,
        error: error.message,
      });

      throw error;
    }
  });

  server.registerMethod('code.getAnalytics', async (ctx, params) => {
    const { userId, month } = params;

    // User can only see their own analytics
    if (ctx.userId !== userId) {
      throw new Error('Unauthorized');
    }

    const analytics = await db.codeToolAnalytics.get(userId, month);

    return {
      success: analytics.metrics.successRate,
      cost: analytics.metrics.totalCost,
      latency: analytics.metrics.avgLatency,
      efficiency: {
        promptEfficiency: analytics.metrics.kpis.promptEfficiency,
        costPerSuccess: analytics.metrics.kpis.costEfficiency,
        speedScore: analytics.metrics.kpis.speedScore,
        reliabilityScore: analytics.metrics.kpis.reliabilityScore,
      },
      byType: analytics.metrics.byType,
      byProvider: analytics.metrics.byProvider,
      byLanguage: analytics.metrics.byLanguage,
    };
  });

  server.registerMethod('code.getSetup', async (ctx, params) => {
    const { userId } = params;

    if (ctx.userId !== userId) {
      throw new Error('Unauthorized');
    }

    const config = await getCodeToolConfig(userId);

    return {
      provider: {
        id: config.primaryProvider.id,
        name: config.primaryProvider.name,
        connected: true,
        modelsAvailable: config.availableModels.length,
      },
      settings: {
        executeInContainer: config.executeInContainer,
        maxStepsPerTask: config.maxStepsPerTask,
        autoCommitOn: config.autoCommitOn,
      },
      privacyStatement:
        'Your code is never stored. We only track: request type, tokens used, success rate, cost.',
    };
  });
}
```

### 3.3 Analytics & Observatory Integration

```typescript
// web/src/pages/Observatory/CodeToolAnalytics.tsx

export function CodeToolAnalyticsPage() {
  const [analytics, setAnalytics] = useState<CodeToolAnalytics | null>(null);
  const [month, setMonth] = useState(getCurrentMonth());

  useEffect(() => {
    async function load() {
      const data = await gatewayClient.call('code.getAnalytics', {
        userId: currentUser.id,
        month
      });
      setAnalytics(data);
    }
    load();
  }, [month]);

  if (!analytics) return <Loading />;

  return (
    <div className="space-y-6">
      {/* Privacy Notice */}
      <Alert>
        <Lock className="h-4 w-4" />
        <AlertDescription>
          Your code is never stored or accessed. We only track request metadata for quality insights.
        </AlertDescription>
      </Alert>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(analytics.metrics.kpis.reliabilityScore * 100).toFixed(0)}%
            </div>
            <p className="text-xs text-gray-500">Requests succeeded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cost Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${analytics.metrics.kpis.costEfficiency.toFixed(3)}
            </div>
            <p className="text-xs text-gray-500">Per successful task</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(analytics.metrics.avgLatency / 1000).toFixed(1)}s
            </div>
            <p className="text-xs text-gray-500">Response time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${analytics.metrics.totalCost.toFixed(2)}
            </div>
            <p className="text-xs text-gray-500">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance by Task Type */}
      <Card>
        <CardHeader>
          <CardTitle>Performance by Task Type</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Task Type</th>
                <th className="text-right">Count</th>
                <th className="text-right">Success %</th>
                <th className="text-right">Avg Cost</th>
                <th className="text-right">Avg Latency</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(analytics.metrics.byType).map(([type, stats]) => (
                <tr key={type} className="border-b">
                  <td className="py-2 capitalize">{type}</td>
                  <td className="text-right">{stats.count}</td>
                  <td className="text-right">{(stats.successRate * 100).toFixed(0)}%</td>
                  <td className="text-right">${stats.avgCost.toFixed(4)}</td>
                  <td className="text-right">{(stats.avgLatency / 1000).toFixed(1)}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Performance by Provider */}
      <Card>
        <CardHeader>
          <CardTitle>Performance by Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Provider</th>
                <th className="text-right">Requests</th>
                <th className="text-right">Success %</th>
                <th className="text-right">Avg Cost</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(analytics.metrics.byProvider).map(([provider, stats]) => (
                <tr key={provider} className="border-b">
                  <td className="py-2">{provider}</td>
                  <td className="text-right">{stats.count}</td>
                  <td className="text-right">{(stats.successRate * 100).toFixed(0)}%</td>
                  <td className="text-right">${stats.avgCost.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Privacy Statement */}
      <Alert className="bg-blue-50">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Data Storage Policy:</strong> We store ONLY: task type, programming language,
          input/output token counts, success/failure status, latency, and cost. Your actual code
          is never stored, logged, or analyzed. This metadata helps us improve Code Tool for all users.
        </AlertDescription>
      </Alert>
    </div>
  );
}
```

---

## Part 4: Intelligence Features (Email, Calendar, Tasks, Analytics)

These leverage the LLM router but hide framework complexity.

### 4.1 Email Intelligence

```typescript
// web/src/services/intelligence/email-intelligence.ts

export class EmailIntelligence {
  async compose(subject: string, start: string): Promise<string> {
    const response = await this.router.route({
      role: 'email-compose',
      userId: this.userId,
      messages: buildPrompt(subject, start),
      maxTokens: 300,
      taskType: 'generation',
    });

    return response.content;
  }

  async classify(email: Email): Promise<EmailClassification> {
    const response = await this.router.route({
      role: 'email-classify',
      userId: this.userId,
      messages: buildClassificationPrompt(email),
      maxTokens: 200,
      taskType: 'classification',
    });

    return parseJSON(response.content);
  }

  async suggestResponses(email: Email): Promise<ResponseSuggestion[]> {
    // This one might use framework for tool access (calendar, history)
    const framework = await this.frameworkRouter.selectFramework('email-respond', this.userId);

    const response = await this.router.route({
      role: 'email-respond',
      userId: this.userId,
      messages: buildResponsePrompt(email, this.userContext),
      maxTokens: 500,
      taskType: 'generation',
      framework: framework.name,
    });

    return parseJSON(response.content);
  }
}
```

### 4.2 Calendar Intelligence

```typescript
// web/src/services/intelligence/calendar-intelligence.ts

export class CalendarIntelligence {
  async generateMeetingPrep(event: CalendarEvent): Promise<MeetingPrepSummary> {
    const framework = await this.frameworkRouter.selectFramework('calendar-prep', this.userId);

    // Synthesize: emails + tasks + documents related to meeting
    const context = await this.gatherContext(event);

    const response = await this.router.route({
      role: 'calendar-prep',
      userId: this.userId,
      messages: buildMeetingPrepPrompt(event, context),
      maxTokens: 1000,
      taskType: 'synthesis',
      framework: framework.name,
    });

    return {
      talkingPoints: extractTalkingPoints(response.content),
      questions: extractQuestions(response.content),
      decisions: extractDecisions(response.content),
      generatedAt: new Date(),
    };
  }

  async suggestMeetingTime(requester: string, duration: number): Promise<TimeSlot[]> {
    const framework = await this.frameworkRouter.selectFramework('calendar-time', this.userId);

    const response = await this.router.route({
      role: 'calendar-time',
      userId: this.userId,
      messages: buildTimeBlockingPrompt(requester, duration, this.userCalendar),
      maxTokens: 400,
      taskType: 'reasoning',
      framework: framework.name,
    });

    return parseJSON(response.content);
  }
}
```

---

## Part 5: Observable Integration

All intelligence data feeds to Observatory for research.

```typescript
// web/src/services/observable/intelligence-observer.ts

export class IntelligenceObserver {
  async recordIntelligenceRequest(data: {
    role: string;
    userId: string;
    framework: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    latency: number;
    success: boolean;
    taskType: string;
  }): Promise<void> {
    // Store in Observatory database
    await observatory.db.insert('intelligence_requests', {
      ...data,
      timestamp: new Date(),
      month: getMonth(new Date()),
    });
  }

  // Observable dashboard shows aggregated insights
  async getInsights(userId: string): Promise<{
    totalRequests: number;
    successRate: number;
    avgCost: number;
    avgLatency: number;
    mostUsedFramework: string;
    mostEffectiveSetup: { framework: string; provider: string; successRate: number };
    recommendations: string[];
  }> {
    const requests = await observatory.db.query('intelligence_requests', {
      userId,
      month: getMonth(new Date()),
    });

    // Analyze patterns
    const byFramework = groupBy(requests, 'framework');
    const mostUsed = Object.entries(byFramework).sort((a, b) => b[1].length - a[1].length)[0][0];

    const bySetup = groupBy(requests, r => `${r.framework}/${r.provider}`);
    const mostEffective = Object.entries(bySetup)
      .map(([setup, reqs]) => ({
        setup,
        successRate: reqs.filter(r => r.success).length / reqs.length,
      }))
      .sort((a, b) => b.successRate - a.successRate)[0];

    return {
      totalRequests: requests.length,
      successRate: requests.filter(r => r.success).length / requests.length,
      avgCost: sum(requests.map(r => r.cost)) / requests.length,
      avgLatency: sum(requests.map(r => r.latency)) / requests.length,
      mostUsedFramework: mostUsed,
      mostEffectiveSetup: {
        framework: mostEffective.setup.split('/')[0],
        provider: mostEffective.setup.split('/')[1],
        successRate: mostEffective.successRate,
      },
      recommendations: generateRecommendations(requests),
    };
  }
}
```

---

## Part 6: User Experience

### 6.1 Intelligence Settings (Simple)

```
┌────────────────────────────────────────────┐
│ Intelligence Settings                      │
├────────────────────────────────────────────┤
│                                            │
│ LLM Provider Setup                          │
│ ├─ Primary: DeepSeek v3.2    [✓ Connected]│
│ ├─ Fallback: Gemini Flash    [✓ Connected]│
│ └─ [+ Add Another Provider]               │
│                                            │
│ Monthly Budget                              │
│ ├─ Limit: $5.00                           │
│ ├─ Used: $1.24 (25%)                      │
│ ├─ ████░░░░░░░░░░░░░░░░░░░░░░             │
│ └─ ☑️ Warn me at 75%                       │
│                                            │
│ Intelligence Features (Enabled)             │
│ ├─ Email composition                       │
│ ├─ Email classification                    │
│ ├─ Meeting prep                            │
│ ├─ Task prioritization                     │
│ └─ Weekly analytics                        │
│                                            │
│ Code Tool (Premium)                        │
│ ├─ Status: Not Activated                   │
│ ├─ [Premium feature - $99/mo]              │
│ └─ [Enable Code Tool]                      │
│                                            │
└────────────────────────────────────────────┘
```

### 6.2 Code Tool Dashboard (Observatory)

```
┌────────────────────────────────────────────┐
│ Code Tool Analytics              📊        │
├────────────────────────────────────────────┤
│                                            │
│ 🔒 Your code is never stored               │
│    We only track: tokens, cost, success    │
│                                            │
│ This Month                                  │
│ ├─ Requests: 24                           │
│ ├─ Success Rate: 96%                      │
│ ├─ Total Cost: $3.24                      │
│ ├─ Avg Latency: 2.1s                      │
│ └─ Cost per Success: $0.14                │
│                                            │
│ Performance by Task Type                    │
│ ├─ Code Review:     8 requests, 100%, $0.08│
│ ├─ Implementation:  10 requests, 95%, $0.19│
│ ├─ Analysis:        6 requests, 90%, $0.12│
│ └─ Refactoring:     0 requests             │
│                                            │
│ Performance by Provider                     │
│ ├─ DeepSeek:        18 requests, 97%      │
│ └─ Claude:          6 requests, 93%       │
│                                            │
│ Recommendations                             │
│ ├─ "Use DeepSeek for implementation        │
│ │   (97% vs 93% success vs Claude)"       │
│ └─ "Consider Claude for complex analysis   │
│    (slightly higher quality)"              │
│                                            │
└────────────────────────────────────────────┘
```

---

## Part 7: Implementation Roadmap

### Phase 8A: Foundation (Weeks 13-14)

**Week 13: LLM Router**

- [ ] Multi-provider abstraction (reuse Helix models-config)
- [ ] Cost tracking integration
- [ ] Role definitions
- [ ] Analytics collector
- [ ] Unit & integration tests

**Week 14: Settings UI**

- [ ] Web settings page (React)
- [ ] iOS settings (SwiftUI)
- [ ] Android settings (Compose)
- [ ] Provider validation

### Phase 8B: Intelligence Features (Weeks 15-17)

**Week 15: Email Intelligence**

- [ ] Email composition
- [ ] Email classification
- [ ] Response suggestions
- [ ] Component integration

**Week 16: Calendar & Tasks**

- [ ] Calendar prep
- [ ] Time blocking
- [ ] Task prioritization
- [ ] Task breakdown

**Week 17: Analytics**

- [ ] Weekly summary
- [ ] Anomaly detection
- [ ] Cost dashboard
- [ ] Observatory integration

### Phase 8C: Code Tool (Weeks 18-19)

**Week 18: Code Tool Gateway Method**

- [ ] Register RPC methods (code.execute, code.getAnalytics)
- [ ] Analytics collection (metadata-only)
- [ ] Discord logging integration
- [ ] Fallback/error handling

**Week 19: Code Tool UI + Analytics**

- [ ] Web dashboard
- [ ] Mobile interface
- [ ] Observatory analytics
- [ ] Privacy statement UI

### Phase 8D: Production (Week 20)

**Week 20: Testing & Deployment**

- [ ] End-to-end tests
- [ ] Performance optimization
- [ ] Security review (code privacy)
- [ ] Production deployment

---

## Key Design Principles

1. **Framework Invisibility** - Users never know TRAE/Lingxi exist
2. **Analytics First** - Every request tracked for research
3. **Cost Transparency** - Users see actual LLM pricing
4. **Code Privacy** - Code never stored; metadata-only tracking
5. **Helix Integration** - Leverage existing logging, security, gateway
6. **User Control** - Recommendations, not mandates
7. **Research-Ready** - Observable feeds future managed offerings

---

## Files to Create/Modify

**New:**

- `web/src/services/llm-router/router.ts` (300 lines)
- `web/src/services/llm-router/cost-tracker.ts` (100 lines)
- `web/src/services/intelligence/framework-router.ts` (400 lines)
- `web/src/services/intelligence/roles.ts` (200 lines)
- `helix-runtime/src/gateway/server-methods/code-tool.ts` (350 lines)
- `web/src/pages/Settings/IntelligenceSettings.tsx` (400 lines)
- `web/src/pages/Observatory/CodeToolAnalytics.tsx` (500 lines)

**Modify:**

- `/helix-runtime/src/entry.ts` - Initialize code tool
- `/helix-runtime/src/gateway/server.impl.ts` - Register RPC methods
- `/web/src/lib/gateway-rpc-client.ts` - Add code tool methods
- `/src/helix/logging-hooks.ts` - Add intelligence logging

**Database Migrations:**

- `llm_costs` table
- `code_tool_metadata` table
- `code_tool_analytics` table
- `intelligence_requests` table (in Observatory)

---

## Success Criteria

✅ **Phase 8A (Foundation):**

- LLM router handles all provider types
- Settings UI works cross-platform
- Cost tracking accurate
- Zero secrets in logs

✅ **Phase 8B (Intelligence):**

- Email: 90% user approval on composition
- Calendar: Meeting prep 30 seconds before meeting
- Tasks: 85% of suggestions accepted
- Analytics: Generated every Sunday 6pm

✅ **Phase 8C (Code Tool):**

- Code never stored (audit verification)
- Analytics show which setups work best
- Privacy statement visible and clear
- Success rate tracked per provider

✅ **Phase 8D (Production):**

- 99.5% uptime
- All logging to Discord before execution
- Hash chain integrity verified
- Code Tool research data ready for managed offering

# Phase 8: LLM-First Intelligence Layer - Framework Blueprint

**Date:** February 4, 2026
**Status:** Architectural Design (Pre-Implementation)
**Framework Integration:** TRAE, Lingxi, SWE-agent, Mini-SWE-agent
**Core Principle:** Helix as Advisor (observing, recommending, not commanding)

---

## Executive Vision

Helix Phase 8 transforms the system into an **intelligence-aware autonomous agent** that:

1. **Observes** - Monitors email, calendar, tasks, code
2. **Routes** - Selects optimal LLM provider/model per task
3. **Recommends** - Suggests actions, optimization, insights
4. **Respects** - Lets developers/users maintain control and freedom

**Key Difference from Traditional Assistants:** Users see which agent handles what, choose their own providers, adjust at any time.

---

## Part 1: The Independent LLM Router Architecture

### 1.1 Router Purpose & Scope

**What it is:**
- Unified provider abstraction layer for all intelligence features
- Separate from existing Helix router (which handles other tasks)
- Code-focused and architecture-agnostic (ready for future models)

**What it's NOT:**
- Not a replacement for existing router
- Not a single decision-maker (user/recommendation hybrid)
- Not opinionated about providers (supports all)

### 1.2 Multi-Provider Router Design

```typescript
// web/src/services/llm-router/types.ts

interface LLMProviderConfig {
  id: string;                           // 'deepseek' | 'gemini' | 'claude' | 'openai' | 'ollama'
  name: string;                         // Display name
  apiKey?: string;                      // User-provided (BYOK) or undefined (managed)
  baseUrl?: string;                     // Custom endpoint for self-hosted
  enabled: boolean;
  isDefault: boolean;
}

interface RoleConfig {
  role: 'email-compose' | 'email-classify' | 'email-respond' |
        'calendar-prep' | 'calendar-time' |
        'task-prioritize' | 'task-breakdown' |
        'analytics-summary' | 'analytics-anomaly' |
        'code-analyze' | 'code-implement' | 'code-review';

  primaryProvider: string;              // 'deepseek' | 'gemini' | 'claude' | etc.
  fallbackProvider?: string;            // If primary unavailable
  model: string;                        // 'deepseek-v3.2' | 'gemini-2.0-flash' | 'claude-opus-4.5'
  complexity: 'simple' | 'medium' | 'complex';
  estimatedTokens: number;              // For cost calculation
  useStreaming: boolean;
}

interface UserLLMSettings {
  userId: string;

  // Provider management
  providers: Record<string, LLMProviderConfig>;  // Map of provider configs

  // Role routing
  roleConfigs: Record<string, RoleConfig>;

  // Global settings
  budget: {
    monthlyLimitUSD?: number;
    currentMonthSpentUSD: number;
    autoDowngradeOnBudget: boolean;   // If budget exceeded, use cheaper model
  };

  // Preferences
  preferStreamingResponses: boolean;
  enableLocalFallback: boolean;          // Use local Ollama if API fails
  logAllRequests: boolean;               // For auditability
}

interface LLMRequest {
  role: string;
  messages: { role: string; content: string }[];
  systemPrompt?: string;
  maxTokens: number;
  temperature?: number;
  userId: string;
}

interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latency: number;
  timestamp: Date;
  fallbackUsed?: boolean;
}
```

### 1.3 Router Implementation

```typescript
// web/src/services/llm-router/router.ts

export class LLMRouter {
  private settings: UserLLMSettings;
  private providers: Map<string, LLMProvider>;
  private costsTracker: CostTracker;

  async initialize(userId: string): Promise<void> {
    this.settings = await loadUserLLMSettings(userId);
    this.providers = await initializeProviders(this.settings);
  }

  async route(request: LLMRequest): Promise<LLMResponse> {
    // 1. Get role configuration
    const roleConfig = this.settings.roleConfigs[request.role];
    if (!roleConfig) {
      throw new Error(`Unknown role: ${request.role}`);
    }

    // 2. Check budget constraints
    if (this.settings.budget.autoDowngradeOnBudget && this.isOverBudget()) {
      return this.routeToFallback(request, roleConfig);
    }

    // 3. Try primary provider
    try {
      const response = await this.callProvider(
        roleConfig.primaryProvider,
        request,
        roleConfig
      );

      // Track cost
      this.costsTracker.track({
        userId: request.userId,
        role: request.role,
        provider: roleConfig.primaryProvider,
        tokens: response.inputTokens + response.outputTokens,
        cost: response.cost
      });

      return response;
    } catch (error) {
      console.warn(`Primary provider ${roleConfig.primaryProvider} failed:`, error);

      // 4. Try fallback provider
      if (roleConfig.fallbackProvider) {
        return this.routeToFallback(request, roleConfig);
      }

      // 5. If all else fails, try local Ollama
      if (this.settings.enableLocalFallback) {
        return this.routeToOllama(request);
      }

      throw error;
    }
  }

  private async routeToFallback(
    request: LLMRequest,
    roleConfig: RoleConfig
  ): Promise<LLMResponse> {
    const fallback = roleConfig.fallbackProvider || this.findCheapestProvider();
    const response = await this.callProvider(fallback, request, roleConfig);
    response.fallbackUsed = true;
    return response;
  }

  private async callProvider(
    providerId: string,
    request: LLMRequest,
    roleConfig: RoleConfig
  ): Promise<LLMResponse> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    const startTime = Date.now();

    const response = await provider.complete({
      messages: request.messages,
      systemPrompt: request.systemPrompt,
      model: roleConfig.model,
      maxTokens: roleConfig.maxTokens,
      temperature: roleConfig.complexity === 'simple' ? 0.1 :
                  roleConfig.complexity === 'medium' ? 0.7 : 1.0,
      stream: roleConfig.useStreaming
    });

    return {
      content: response.text,
      provider: providerId,
      model: roleConfig.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      cost: response.cost,
      latency: Date.now() - startTime,
      timestamp: new Date()
    };
  }

  private findCheapestProvider(): string {
    // Return provider with lowest cost per token
    const costs: Record<string, number> = {
      'gemini': 0.038,    // $0.038 / 1M input tokens (Flash)
      'deepseek': 0.10,   // $0.10 / 1M input tokens (v3.2)
      'claude': 0.80,     // $0.80 / 1M input tokens (Haiku)
    };

    return Object.entries(costs)
      .filter(([id]) => this.settings.providers[id]?.enabled)
      .sort(([, a], [, b]) => a - b)[0][0];
  }

  private isOverBudget(): boolean {
    if (!this.settings.budget.monthlyLimitUSD) return false;
    return this.settings.budget.currentMonthSpentUSD >=
           this.settings.budget.monthlyLimitUSD;
  }

  private async routeToOllama(request: LLMRequest): Promise<LLMResponse> {
    // Local Ollama fallback for privacy/offline scenarios
    const provider = this.providers.get('ollama');
    if (!provider) {
      throw new Error('Ollama not available');
    }

    const response = await provider.complete({
      messages: request.messages,
      model: 'mistral', // Default local model
      maxTokens: request.maxTokens,
      stream: false
    });

    return {
      ...response,
      provider: 'ollama',
      cost: 0 // Local execution = free
    };
  }
}
```

### 1.4 Provider Implementations

```typescript
// web/src/services/llm-router/providers/

// Common interface for all providers
interface LLMProvider {
  complete(config: CompleteConfig): Promise<CompleteResponse>;
  validateCredentials(): Promise<boolean>;
  getModels(): Promise<string[]>;
}

// DeepSeek Provider (Primary for paid users)
export class DeepSeekProvider implements LLMProvider {
  private apiKey: string;

  async complete(config: CompleteConfig): Promise<CompleteResponse> {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        messages: config.messages,
        system: config.systemPrompt,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        stream: config.stream
      })
    });

    const data = await response.json();
    return {
      text: data.choices[0].message.content,
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
      cost: this.calculateCost(data.usage.prompt_tokens, data.usage.completion_tokens)
    };
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    // DeepSeek v3.2: $0.10 / 1M input, $0.40 / 1M output
    return (inputTokens * 0.10 + outputTokens * 0.40) / 1_000_000;
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const response = await fetch('https://api.deepseek.com/v1/models', {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getModels(): Promise<string[]> {
    return ['deepseek-v3.2', 'deepseek-v2.5'];
  }
}

// Gemini Provider (Fallback for paid users)
export class GeminiProvider implements LLMProvider {
  private apiKey: string;

  async complete(config: CompleteConfig): Promise<CompleteResponse> {
    // Similar implementation for Google Gemini
    // $0.038 / 1M input, $0.15 / 1M output for Flash
  }
}

// Claude Provider (BYOK users)
export class ClaudeProvider implements LLMProvider {
  private apiKey: string;

  async complete(config: CompleteConfig): Promise<CompleteResponse> {
    // Uses Anthropic API
  }
}

// Local Ollama Provider (Fallback)
export class OllamaProvider implements LLMProvider {
  private baseUrl: string = 'http://localhost:11434';

  async complete(config: CompleteConfig): Promise<CompleteResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({
        model: config.model,
        messages: config.messages,
        stream: false
      })
    });

    const data = await response.json();
    return {
      text: data.message.content,
      inputTokens: 0,     // Ollama doesn't track token counts
      outputTokens: 0,
      cost: 0             // Local = free
    };
  }
}
```

---

## Part 2: Role-Based Intelligence & Framework Routing

### 2.1 Role Classification & Complexity Mapping

```typescript
// web/src/services/intelligence/role-mapper.ts

interface RoleRecommendation {
  role: string;
  complexity: 'simple' | 'medium' | 'complex';
  recommendedFramework: 'mini-swe' | 'trae' | 'lingxi' | 'swe-agent' | 'none';
  estimatedTokens: number;
  reasoning: string;
}

const ROLE_RECOMMENDATIONS: Record<string, RoleRecommendation> = {
  'email-compose': {
    role: 'email-compose',
    complexity: 'medium',
    recommendedFramework: 'mini-swe',  // Simple task, fast response needed
    estimatedTokens: 200,
    reasoning: 'Email composition is straightforward. Mini-SWE simplicity sufficient. DeepSeek v3.2 or Gemini Flash good fit.'
  },

  'email-classify': {
    role: 'email-classify',
    complexity: 'simple',
    recommendedFramework: 'none',  // Direct LLM call, no framework needed
    estimatedTokens: 150,
    reasoning: 'Classification is pattern-matching. Direct API call fastest. Gemini Flash recommended (cheapest).'
  },

  'email-respond': {
    role: 'email-respond',
    complexity: 'medium',
    recommendedFramework: 'trae',  // Needs tool access (calendar, existing emails)
    estimatedTokens: 300,
    reasoning: 'Response suggestions need calendar context + email history. TRAE excellent at multi-tool orchestration.'
  },

  'calendar-prep': {
    role: 'calendar-prep',
    complexity: 'complex',
    recommendedFramework: 'lingxi',  // Needs semantic search + synthesis
    estimatedTokens: 800,
    reasoning: 'Meeting prep requires synthesizing emails, tasks, documents. Lingxi semantic search (ChromaDB) finds relevant context efficiently.'
  },

  'calendar-time': {
    role: 'calendar-time',
    complexity: 'medium',
    recommendedFramework: 'swe-agent',  // Needs history management + optimization
    estimatedTokens: 250,
    reasoning: 'Time blocking benefits from SWE-agent history optimization and cost caching. Can reuse calendar analysis across requests.'
  },

  'task-prioritize': {
    role: 'task-prioritize',
    complexity: 'complex',
    recommendedFramework: 'lingxi',  // Multi-agent: analyzer → planner → reviewer
    estimatedTokens: 600,
    reasoning: 'Prioritization benefits from Lingxi multi-agent approach: analyze tasks → create priority plan → verify against dependencies.'
  },

  'task-breakdown': {
    role: 'task-breakdown',
    complexity: 'medium',
    recommendedFramework: 'mini-swe',  // Simple linear decomposition
    estimatedTokens: 400,
    reasoning: 'Task breakdown is systematic. Mini-SWE simplicity ideal. No complex loops needed.'
  },

  'analytics-summary': {
    role: 'analytics-summary',
    complexity: 'complex',
    recommendedFramework: 'swe-agent',  // Needs history trimming + summarization
    estimatedTokens: 1200,
    reasoning: 'Weekly summaries have large input (7 days of data). SWE-agent history processors trim context intelligently.'
  },

  'analytics-anomaly': {
    role: 'analytics-anomaly',
    complexity: 'medium',
    recommendedFramework: 'trae',  // Needs tool access (database queries, 1Password audit)
    estimatedTokens: 300,
    reasoning: 'Anomaly detection needs tool orchestration: fetch metrics → compare baselines → generate alerts. TRAE handles this.'
  },

  'code-analyze': {
    role: 'code-analyze',
    complexity: 'complex',
    recommendedFramework: 'swe-agent',  // Full SWE-agent for GitHub issues
    estimatedTokens: 2000,
    reasoning: 'Code analysis (GitHub issues) is SWE-agent primary use case. Full history management + error recovery critical.'
  },

  'code-implement': {
    role: 'code-implement',
    complexity: 'complex',
    recommendedFramework: 'lingxi',  // Multi-specialist: analyzer → implementer → reviewer
    estimatedTokens: 3000,
    reasoning: 'Implementation benefits from Lingxi multi-agent: problem decoder → solution mapper → problem solver → reviewer.'
  },

  'code-review': {
    role: 'code-review',
    complexity: 'complex',
    recommendedFramework: 'mini-swe',  // Simpler than implementation
    estimatedTokens: 1500,
    reasoning: 'Code review: read file → identify issues → suggest fixes. Mini-SWE transparency ideal for audit trails.'
  }
};
```

### 2.2 Framework Routing Decision Tree

```typescript
// web/src/services/intelligence/framework-router.ts

export class FrameworkRouter {
  async routeTask(task: {
    role: string;
    input: unknown;
    userId: string;
    context?: unknown;
  }): Promise<FrameworkResponse> {
    const recommendation = ROLE_RECOMMENDATIONS[task.role];

    if (!recommendation) {
      throw new Error(`Unknown role: ${task.role}`);
    }

    // 1. Check user settings (they can override recommendations)
    const userSettings = await getUserLLMSettings(task.userId);
    const roleConfig = userSettings.roleConfigs[task.role];

    // 2. Get framework choice (user preference or recommendation)
    const framework = roleConfig?.preferredFramework || recommendation.recommendedFramework;

    // 3. Route to appropriate framework
    switch (framework) {
      case 'mini-swe':
        return this.routeToMiniSWE(task, recommendation);

      case 'trae':
        return this.routeToTRAE(task, recommendation);

      case 'lingxi':
        return this.routeToLingxi(task, recommendation);

      case 'swe-agent':
        return this.routeToSWEAgent(task, recommendation);

      case 'none':
      default:
        return this.directLLMCall(task, recommendation);
    }
  }

  private async routeToMiniSWE(
    task: any,
    recommendation: RoleRecommendation
  ): Promise<FrameworkResponse> {
    // Use Mini-SWE-Agent for simple, transparent tasks
    const agent = new MiniSWEAgent({
      userId: task.userId,
      role: task.role,
      maxSteps: 5
    });

    return agent.execute(task.input);
  }

  private async routeToTRAE(
    task: any,
    recommendation: RoleRecommendation
  ): Promise<FrameworkResponse> {
    // Use TRAE for multi-tool orchestration
    const agent = new TraeAgent({
      userId: task.userId,
      role: task.role,
      tools: this.selectTools(task.role)
    });

    return agent.execute(task.input);
  }

  private async routeToLingxi(
    task: any,
    recommendation: RoleRecommendation
  ): Promise<FrameworkResponse> {
    // Use Lingxi for multi-agent workflows
    const workflow = new LingxiWorkflow({
      userId: task.userId,
      role: task.role,
      agents: this.selectAgents(task.role)
    });

    return workflow.execute(task.input);
  }

  private async routeToSWEAgent(
    task: any,
    recommendation: RoleRecommendation
  ): Promise<FrameworkResponse> {
    // Use SWE-Agent for sophisticated history management
    const agent = new SWEAgentController({
      userId: task.userId,
      role: task.role,
      historyProcessors: this.selectHistoryProcessors(task.role)
    });

    return agent.execute(task.input);
  }

  private async directLLMCall(
    task: any,
    recommendation: RoleRecommendation
  ): Promise<FrameworkResponse> {
    // Simple tasks bypass framework and call LLM directly
    const router = await LLMRouter.getInstance();

    const response = await router.route({
      role: task.role,
      messages: buildMessages(task.input),
      maxTokens: recommendation.estimatedTokens,
      userId: task.userId
    });

    return {
      content: response.content,
      framework: 'none',
      provider: response.provider,
      cost: response.cost,
      latency: response.latency
    };
  }

  private selectTools(role: string): string[] {
    // Based on role, select which tools are available
    const toolsByRole: Record<string, string[]> = {
      'email-respond': ['calendar', 'email-history', 'user-preferences'],
      'analytics-anomaly': ['database', '1password-audit', 'metrics']
    };
    return toolsByRole[role] || [];
  }

  private selectAgents(role: string): string[] {
    // For Lingxi multi-agent workflows, select which specialized agents
    const agentsByRole: Record<string, string[]> = {
      'task-prioritize': ['analyzer', 'planner', 'reviewer'],
      'code-implement': ['problem-decoder', 'solution-mapper', 'problem-solver', 'reviewer']
    };
    return agentsByRole[role] || [];
  }

  private selectHistoryProcessors(role: string): string[] {
    // For SWE-Agent, select history processors
    const processorsByRole: Record<string, string[]> = {
      'analytics-summary': ['last-n-observations', 'cache-control'],
      'code-analyze': ['cache-control', 'file-window-tracking']
    };
    return processorsByRole[role] || [];
  }
}
```

---

## Part 3: Provider Settings UI (Cross-Platform)

### 3.1 Settings Data Model

```typescript
// web/src/types/intelligence.ts

interface ProviderSettingsPage {
  providers: ProviderSection;
  roles: RoleSection;
  budget: BudgetSection;
  recommendations: RecommendationPanel;
}

interface ProviderSection {
  connectedProviders: {
    id: string;
    name: string;
    icon: string;
    status: 'connected' | 'needs-setup' | 'error';
    modelsAvailable: number;
    lastConnected: Date;
    actions: ['edit', 'test', 'disconnect'];
  }[];

  availableProviders: {
    id: string;
    name: string;
    icon: string;
    costs: { inputPricePer1M: number; outputPricePer1M: number };
    status: 'managed' | 'byok' | 'both';
    learnMoreUrl: string;
  }[];
}

interface RoleSection {
  roles: {
    id: string;
    name: string;
    icon: string;
    complexity: 'simple' | 'medium' | 'complex';

    currentConfig: {
      provider: string;
      model: string;
      useStreaming: boolean;
      estimatedCostPerMonth: number;
    };

    recommendation: {
      provider: string;
      reasoning: string;
      estimatedCostPerMonth: number;
      alternativeOptions: { provider: string; cost: number }[];
    };

    actions: ['customize', 'reset-to-recommendation'];
  }[];
}

interface BudgetSection {
  monthlySpent: number;
  monthlyLimit?: number;
  percentageUsed: number;
  costBreakdown: { role: string; cost: number; percentage: number }[];
  autoDowngradeEnabled: boolean;
}

interface RecommendationPanel {
  title: string;
  suggestions: {
    role: string;
    currentCost: number;
    suggestedCost: number;
    savings: number;
    reasoning: string;
    action: 'accept' | 'dismiss';
  }[];
}
```

### 3.2 Settings UI Components

**Web (React + Tailwind):**
```
┌─────────────────────────────────────────────────────────────┐
│  Helix Intelligence Settings                        ⚙️     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  📊 Provider Management                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✅ DeepSeek v3.2        [Edit] [Test] [→]           │   │
│  │    Models: 2 | Last connected: 2h ago              │   │
│  │                                                     │   │
│  │ ✅ Gemini Flash         [Edit] [Test] [→]           │   │
│  │    Models: 3 | Last connected: 12h ago             │   │
│  │                                                     │   │
│  │ ⚠️  Claude (needs API key)  [Setup]                 │   │
│  │                                                     │   │
│  │ + Add Provider...                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  🎯 Role Configuration                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Email Composition          [RECOMMENDED]            │   │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │   │
│  │ Current:  DeepSeek v3.2 | $0.10/mo                │   │
│  │ Recommended: Gemini Flash | $0.04/mo ↓             │   │
│  │ "Simpler task, Gemini Flash more cost-effective"   │   │
│  │ [✓ Accept Recommendation]  [Customize]             │   │
│  │                                                     │   │
│  │ Calendar Prep              [⚡ OPTIMIZED]           │   │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │   │
│  │ Current:  Lingxi Multi-Agent | $0.40/mo            │   │
│  │ "Uses semantic search for relevant context"        │   │
│  │ [Customize]                                         │   │
│  │                                                     │   │
│  │ Code Implementation        [⭐ CUSTOM]              │   │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │   │
│  │ Current:  Custom Claude config                     │   │
│  │ "Using your personal Anthropic API key"            │   │
│  │ [Customize]                                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  💰 Budget & Costs                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ This Month: $1.24 / $5.00 (25%)                    │   │
│  │ ████░░░░░░░░░░░░░░░░░░░░░░░░░░                     │   │
│  │                                                     │   │
│  │ Cost Breakdown:                                     │   │
│  │ • Email Composition:  $0.34 (28%)                  │   │
│  │ • Calendar Prep:      $0.42 (34%)                  │   │
│  │ • Code Implementation:$0.48 (39%)                  │   │
│  │                                                     │   │
│  │ ☑️  Auto-downgrade when budget exceeded             │   │
│  │ ☑️  Notify me when > 75% used                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  💡 Recommendations                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔍 Email Classification currently uses DeepSeek    │   │
│  │    ($0.15/mo) but Gemini Flash sufficient          │   │
│  │    SAVE: $0.14/mo (93%)                            │   │
│  │    [✓ Accept]  [Dismiss]                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│                          [Save Changes]                      │
└─────────────────────────────────────────────────────────────┘
```

**iOS (SwiftUI):**
```swift
struct IntelligenceSettingsView: View {
  @ObservedObject var settings: UserLLMSettings

  var body: some View {
    NavigationView {
      List {
        // Provider section
        Section("Connected Providers") {
          ForEach(settings.connectedProviders) { provider in
            HStack {
              Image(systemName: provider.statusIcon)
              VStack(alignment: .leading) {
                Text(provider.name)
                Text("\(provider.modelsAvailable) models")
                  .font(.caption)
                  .foregroundColor(.gray)
              }
              Spacer()
              Menu {
                Button("Edit", action: { /* edit */ })
                Button("Test Connection", action: { /* test */ })
                Button("Disconnect", role: .destructive, action: { /* disconnect */ })
              } label: {
                Image(systemName: "ellipsis.circle")
              }
            }
          }

          NavigationLink("Add Provider", destination: AddProviderView())
        }

        // Role configuration section
        Section("Role Configuration") {
          ForEach(settings.roles) { role in
            NavigationLink(destination: RoleDetailView(role: role)) {
              HStack {
                VStack(alignment: .leading) {
                  Text(role.name)
                  HStack {
                    Text(role.currentConfig.provider)
                      .font(.caption)
                      .foregroundColor(.blue)
                    Text("$\(role.currentConfig.estimatedCostPerMonth, specifier: "%.2f")/mo")
                      .font(.caption)
                      .foregroundColor(.gray)
                  }
                }
                Spacer()
                if role.recommendation.savings > 0 {
                  Badge("Save \(role.recommendation.savings, specifier: "%.0f")%")
                    .foregroundColor(.green)
                }
              }
            }
          }
        }

        // Budget section
        Section("Monthly Budget") {
          ProgressView(
            value: Double(settings.budget.currentMonthSpentUSD) /
                   Double(settings.budget.monthlyLimitUSD ?? 1)
          )
          Text("$\(settings.budget.currentMonthSpentUSD, specifier: "%.2f") / $\(settings.budget.monthlyLimitUSD ?? 0, specifier: "%.2f")")
            .font(.caption)

          Toggle("Auto-downgrade when budget exceeded", isOn: $settings.budget.autoDowngradeOnBudget)
        }
      }
      .navigationTitle("Intelligence Settings")
    }
  }
}
```

**Android (Jetpack Compose):**
```kotlin
@Composable
fun IntelligenceSettingsScreen(
  viewModel: IntelligenceSettingsViewModel
) {
  val settings by viewModel.settings.collectAsState()

  LazyColumn(modifier = Modifier.fillMaxSize()) {
    item {
      Text(
        "Connected Providers",
        style = MaterialTheme.typography.headlineSmall,
        modifier = Modifier.padding(16.dp)
      )
    }

    items(settings.connectedProviders) { provider ->
      ProviderItem(
        provider = provider,
        onEdit = { viewModel.editProvider(provider.id) },
        onTest = { viewModel.testProvider(provider.id) },
        onDisconnect = { viewModel.disconnectProvider(provider.id) }
      )
    }

    item {
      Button(onClick = { /* Show add provider dialog */ }) {
        Text("+ Add Provider")
      }
    }

    item {
      Text(
        "Role Configuration",
        style = MaterialTheme.typography.headlineSmall,
        modifier = Modifier.padding(16.dp)
      )
    }

    items(settings.roles) { role ->
      RoleConfigCard(
        role = role,
        onCustomize = { viewModel.customizeRole(role.id) },
        savings = role.recommendation.savings
      )
    }
  }
}
```

---

## Part 4: Code Tool (Separate Premium Feature)

### 4.1 Code Tool Architecture

**Important:** Code tool is separate from Phase 8 intelligence features. It's a premium dev tool with its own routing.

```typescript
// helix-runtime/src/services/code-tool/types.ts

interface CodeToolConfig {
  userId: string;

  // Provider configuration (separate from intelligence)
  codeProviders: {
    primary: 'swe-agent' | 'mini-swe' | 'trae' | 'lingxi';
    fallback?: string;
    customModels?: Record<string, string>;
  };

  // Code-specific settings
  codeSettings: {
    executeInContainer: boolean;        // Docker isolation
    maxStepsPerTask: number;            // Safety limit
    autoCommitOn: 'success' | 'manual' | 'never';
    gitHubIntegration: boolean;
    costPerRequest?: number;            // Premium tier pricing
  };
}

interface CodeRequest {
  type: 'analyze' | 'implement' | 'review' | 'refactor' | 'debug';
  input: string;
  repository?: string;
  files?: string[];
  context?: string;
}

interface CodeResponse {
  type: string;
  output: string;
  framework: 'swe-agent' | 'mini-swe' | 'trae' | 'lingxi';
  provider: string;
  model: string;
  cost: number;
  executionTime: number;
  fallbackUsed: boolean;
  trajectory?: object;
}
```

### 4.2 Code Tool Invocation (Native Integration)

**Via CLI/PowerShell:**
```bash
# Users can invoke Claude Code or Copilot directly
claude code --project ./my-project --task "refactor login page"
codex --analyze "src/auth.ts" --suggestions

# Helix manages the LLM routing behind the scenes
# User's API keys stored securely (EncryptedSecretsCache)
# Results logged to Discord (pre-execution logging per CLAUDE.md)
```

**Via Web UI:**
```
┌──────────────────────────────────────────────────┐
│ Code Tool                               💎 Premium │
├──────────────────────────────────────────────────┤
│                                                  │
│ Ask Claude Code...                              │
│ ┌────────────────────────────────────────────┐  │
│ │ "Refactor the email service to use CRDT"  │  │
│ └────────────────────────────────────────────┘  │
│                      [Send]                      │
│                                                  │
│ ℹ️  Using: SWE-Agent via your DeepSeek key      │
│ Provider info: deepseek-v3.2                   │
│ Estimated cost: $0.42                          │
│ [Show Details] [Customize Provider]            │
│                                                  │
│ Executing...                                     │
│ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░      │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 4.3 Code Tool Provider Selection

```typescript
// helix-runtime/src/services/code-tool/code-router.ts

export class CodeToolRouter {
  async routeCodeTask(request: CodeRequest): Promise<CodeResponse> {
    const config = await getCodeToolConfig(request.userId);

    // Route based on task type
    switch (request.type) {
      case 'analyze':
        // GitHub issue analysis → SWE-Agent
        return this.routeToSWEAgent(request, config);

      case 'implement':
        // Code implementation → Lingxi multi-agent
        return this.routeToLingxi(request, config);

      case 'review':
        // Code review → Mini-SWE (simpler)
        return this.routeToMiniSWE(request, config);

      case 'refactor':
        // Refactoring → SWE-Agent (sophisticated history)
        return this.routeToSWEAgent(request, config);

      case 'debug':
        // Debugging → TRAE (needs tool orchestration)
        return this.routeToTRAE(request, config);
    }
  }

  private async routeToSWEAgent(
    request: CodeRequest,
    config: CodeToolConfig
  ): Promise<CodeResponse> {
    // Full SWE-Agent for complex code tasks
    const agent = new SWEAgentExecution({
      userRepository: request.repository,
      containerExecution: config.codeSettings.executeInContainer,
      maxSteps: config.codeSettings.maxStepsPerTask,
      gitHubIntegration: config.codeSettings.gitHubIntegration
    });

    const startTime = Date.now();
    const result = await agent.execute(request);

    // Log to Discord (pre-execution logging)
    await logCodeExecution({
      type: request.type,
      task: request.input,
      status: 'completed',
      cost: result.cost,
      executionTime: Date.now() - startTime
    });

    return result;
  }
}
```

---

## Part 5: User Experience & Recommendations

### 5.1 Recommendation Engine

```typescript
// web/src/services/intelligence/recommendation-engine.ts

export class RecommendationEngine {
  async generateRecommendations(userId: string): Promise<Recommendation[]> {
    const settings = await getUserLLMSettings(userId);
    const usage = await getUsageMetrics(userId);
    const recommendations: Recommendation[] = [];

    // 1. Opportunity: Downgrade expensive roles
    for (const [roleId, roleConfig] of Object.entries(settings.roleConfigs)) {
      const recommendation = ROLE_RECOMMENDATIONS[roleId];
      const roleUsage = usage.byRole[roleId];

      if (roleUsage.monthlyCount < 5) {
        // Rarely used → suggest downgrade
        recommendations.push({
          id: `downgrade-${roleId}`,
          priority: 'low',
          type: 'cost-optimization',
          title: `${roleConfig.name} rarely used`,
          description: `You've only used this ${roleUsage.monthlyCount}x this month. Suggest downgrading to cheaper model.`,
          current: { provider: roleConfig.primaryProvider, cost: roleUsage.estimatedCost },
          suggested: { provider: this.findCheapestModel(roleId), cost: roleUsage.estimatedCost * 0.3 },
          savings: roleUsage.estimatedCost * 0.7,
          action: { label: 'Accept', handler: () => this.applyRecommendation(userId, roleId) }
        });
      }

      // 2. Opportunity: Use better model for complex tasks
      if (roleUsage.errorRate > 0.2) {
        // High error rate → suggest better model
        recommendations.push({
          id: `upgrade-${roleId}`,
          priority: 'high',
          type: 'quality-improvement',
          title: `${roleConfig.name} has quality issues`,
          description: `Error rate ${(roleUsage.errorRate * 100).toFixed(0)}% suggests model is underpowered.`,
          current: { provider: roleConfig.primaryProvider, performance: 'poor' },
          suggested: { provider: ROLE_RECOMMENDATIONS[roleId].recommendedFramework, performance: 'expected' },
          action: { label: 'Upgrade', handler: () => this.upgradeRole(userId, roleId) }
        });
      }
    }

    // 3. Opportunity: Batch similar tasks
    const batchableRoles = this.findBatchableRoles(usage);
    if (batchableRoles.length > 0) {
      recommendations.push({
        id: 'batch-processing',
        priority: 'medium',
        type: 'efficiency',
        title: `Batch ${batchableRoles.length} similar tasks`,
        description: `Batching email classifications would reduce API calls by 40% and cost by 35%.`,
        savings: 0.15,
        action: { label: 'Learn More', handler: () => openBatchingGuide() }
      });
    }

    return recommendations;
  }

  private findCheapestModel(roleId: string): string {
    // Find cheapest provider that can handle this role
    const recommendation = ROLE_RECOMMENDATIONS[roleId];
    if (recommendation.complexity === 'simple') {
      return 'gemini'; // Cheapest
    }
    if (recommendation.complexity === 'medium') {
      return 'deepseek'; // Mid-range
    }
    // Complex tasks might need Claude, but suggest Deepseek first
    return 'deepseek';
  }

  private async applyRecommendation(userId: string, roleId: string): Promise<void> {
    const settings = await getUserLLMSettings(userId);
    const roleConfig = settings.roleConfigs[roleId];
    const newProvider = this.findCheapestModel(roleId);

    roleConfig.primaryProvider = newProvider;
    await saveUserLLMSettings(userId, settings);

    // Log to Discord
    await logRecommendationAccepted({
      userId,
      roleId,
      newProvider,
      estimatedSavings: roleConfig.estimatedCost * 0.7
    });
  }
}
```

### 5.2 Observability Dashboard

```typescript
// web/src/pages/Dashboard/IntelligenceDashboard.tsx

interface IntelligenceDashboard {
  costSummary: {
    thisMonth: number;
    lastMonth: number;
    trend: 'up' | 'down' | 'stable';
    topCostRole: { name: string; cost: number; percentage: number };
  };

  performanceMetrics: {
    averageLatency: number;
    errorRate: number;
    successfulRequests: number;
    failedRequests: number;
    fallbackUsageRate: number;
  };

  providerUsage: {
    byProvider: { name: string; requests: number; percentage: number; cost: number }[];
    byRole: { name: string; requests: number; cost: number }[];
  };

  recommendations: Recommendation[];

  recentRequests: {
    timestamp: Date;
    role: string;
    provider: string;
    latency: number;
    cost: number;
    status: 'success' | 'fallback' | 'error';
  }[];
}
```

---

## Part 6: Implementation Roadmap

### Phase 8A: Foundation (Weeks 13-14)

**Week 13: LLM Router Infrastructure**
- [ ] Multi-provider abstraction (DeepSeek, Gemini, Claude, Ollama)
- [ ] Provider credential management (BYOK support)
- [ ] Role configuration data model
- [ ] Direct LLM call routing (no frameworks yet)
- [ ] Unit tests (provider implementations)

**Week 14: Settings UI**
- [ ] Web settings page (React + Tailwind)
- [ ] iOS settings view (SwiftUI)
- [ ] Android settings screen (Compose)
- [ ] Provider connection workflow
- [ ] Integration tests

### Phase 8B: Intelligence Features (Weeks 15-17)

**Week 15: Email Intelligence**
- [ ] Email composition (direct LLM)
- [ ] Email classification (direct LLM)
- [ ] Response suggestions (TRAE routing)
- [ ] React component integration
- [ ] Tests

**Week 16: Calendar & Tasks**
- [ ] Calendar prep (Lingxi routing)
- [ ] Time blocking (SWE-Agent routing)
- [ ] Task prioritization (Lingxi routing)
- [ ] Task breakdown (Mini-SWE routing)
- [ ] Tests

**Week 17: Analytics**
- [ ] Weekly summary (SWE-Agent routing)
- [ ] Anomaly detection (TRAE routing)
- [ ] Cost tracking dashboard
- [ ] Recommendation engine
- [ ] Tests

### Phase 8C: Multi-Framework Integration (Weeks 18-19)

**Week 18: Framework Integration**
- [ ] Mini-SWE-Agent integration
- [ ] TRAE integration
- [ ] Lingxi integration
- [ ] SWE-Agent integration
- [ ] Framework routing logic

**Week 19: Mobile Implementation**
- [ ] iOS intelligence features
- [ ] Android intelligence features
- [ ] Cross-platform consistency
- [ ] E2E tests

### Phase 8D: Production & Code Tool (Week 20)

**Week 20: Production Readiness**
- [ ] Error handling & fallbacks
- [ ] Cost alerting
- [ ] Performance optimization
- [ ] Security audit (provider credentials)
- [ ] Production deployment

**Future: Code Tool (Phase 9)**
- [ ] Separate code-focused provider setup
- [ ] CLI invocation (claude code, codex)
- [ ] Native terminal integration
- [ ] GitHub Copilot OAuth support

---

## Summary: Framework Selection Rationale

| Role | Framework | Why |
|------|-----------|-----|
| Email Compose | Direct LLM | Simple, fast |
| Email Classify | Direct LLM | Pattern matching, no framework overhead |
| Email Response | TRAE | Multi-tool (calendar + history) |
| Calendar Prep | Lingxi | Semantic search + synthesis |
| Calendar Time | SWE-Agent | History optimization + caching |
| Task Prioritize | Lingxi | Multi-agent analysis → plan → review |
| Task Breakdown | Mini-SWE | Simple decomposition, transparency |
| Analytics Summary | SWE-Agent | Large input, history trimming |
| Analytics Anomaly | TRAE | Tool orchestration (db + 1password) |
| Code Analyze | SWE-Agent | Primary use case (GitHub issues) |
| Code Implement | Lingxi | Multi-specialist workflow |
| Code Review | Mini-SWE | Simplicity, audit trails |

This architecture enables:
- ✅ User freedom (choose providers per role)
- ✅ Cost optimization (cheaper models for simple tasks)
- ✅ Framework specialization (right tool per task)
- ✅ Transparency (see which agent handles what)
- ✅ Fallback chains (always have backup)
- ✅ Future flexibility (add new frameworks easily)

---

## Next Steps

1. **Review & Refine** - Questions for Rodrigo
2. **Build Settings UI** - Start with Web, extend to iOS/Android
3. **Implement Router** - Multi-provider abstraction
4. **Integrate Frameworks** - One at a time, tests for each
5. **Production** - Launch Phase 8 with confidence
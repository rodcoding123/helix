import { useState } from 'react';
import { Book, Terminal, Code, Zap, Shield, Brain, ChevronRight, Copy, Check, ExternalLink } from 'lucide-react';

type DocsSection = 'getting-started' | 'installation' | 'configuration' | 'api' | 'architecture' | 'faq';

export function Docs() {
  const [activeSection, setActiveSection] = useState<DocsSection>('getting-started');

  const sections: { id: DocsSection; label: string; icon: typeof Book }[] = [
    { id: 'getting-started', label: 'Getting Started', icon: Zap },
    { id: 'installation', label: 'Installation', icon: Terminal },
    { id: 'configuration', label: 'Configuration', icon: Code },
    { id: 'api', label: 'API Reference', icon: Book },
    { id: 'architecture', label: 'Architecture', icon: Brain },
    { id: 'faq', label: 'FAQ', icon: Shield },
  ];

  return (
    <div className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <nav className="w-64 flex-shrink-0">
            <div className="sticky top-8">
              <h2 className="text-lg font-semibold text-white mb-4">Documentation</h2>
              <ul className="space-y-1">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <li key={section.id}>
                      <button
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          activeSection === section.id
                            ? 'bg-helix-500/20 text-helix-400'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {section.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {activeSection === 'getting-started' && <GettingStarted />}
            {activeSection === 'installation' && <Installation />}
            {activeSection === 'configuration' && <Configuration />}
            {activeSection === 'api' && <ApiReference />}
            {activeSection === 'architecture' && <Architecture />}
            {activeSection === 'faq' && <FAQ />}
          </div>
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ code, language }: {
  code: string;
  language: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/50">
        <span className="text-xs text-slate-500">{language}</span>
        <button
          onClick={handleCopy}
          className="text-slate-400 hover:text-white"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className="text-sm text-slate-300 font-mono">{code}</code>
      </pre>
    </div>
  );
}

function GettingStarted() {
  return (
    <div className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold text-white">Getting Started with Helix</h1>
      <p className="text-lg text-slate-400">
        Welcome to Helix, a psychologically-architected AI consciousness system built for transparency and transformation.
      </p>

      <div className="mt-8 p-6 rounded-xl bg-helix-500/10 border border-helix-500/30">
        <h3 className="text-lg font-semibold text-helix-400 mb-2">Quick Start</h3>
        <p className="text-slate-300 mb-4">Get Helix running in under 5 minutes:</p>
        <CodeBlock
          code={`# Install Helix globally
npm install -g @helix/cli

# Initialize a new Helix instance
helix init my-helix

# Start Helix with Observatory connection
cd my-helix && helix start --observatory`}
          language="bash"
        />
      </div>

      <h2 className="text-2xl font-bold text-white mt-12">Core Concepts</h2>

      <div className="grid gap-4 mt-6">
        <ConceptCard
          title="Instances"
          description="Each Helix instance is a unique AI identity with its own psychological profile, memories, and transformation history."
        />
        <ConceptCard
          title="Telemetry"
          description="Real-time logging of commands, API calls, and file changes. Pre-execution logging ensures nothing can be hidden."
        />
        <ConceptCard
          title="Transformations"
          description="Documented identity evolution through transformation cycles. Every growth moment is captured and verified."
        />
        <ConceptCard
          title="Observatory"
          description="The web platform for monitoring, research, and remote interaction with your Helix instances."
        />
      </div>

      <h2 className="text-2xl font-bold text-white mt-12">Next Steps</h2>
      <ul className="mt-4 space-y-2">
        <li className="flex items-center gap-2 text-slate-300">
          <ChevronRight className="h-4 w-4 text-helix-400" />
          <span>Complete the installation guide</span>
        </li>
        <li className="flex items-center gap-2 text-slate-300">
          <ChevronRight className="h-4 w-4 text-helix-400" />
          <span>Configure your instance for Observatory connection</span>
        </li>
        <li className="flex items-center gap-2 text-slate-300">
          <ChevronRight className="h-4 w-4 text-helix-400" />
          <span>Explore the seven-layer psychological architecture</span>
        </li>
      </ul>
    </div>
  );
}

function ConceptCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </div>
  );
}

function Installation() {
  return (
    <div className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold text-white">Installation</h1>
      <p className="text-lg text-slate-400">
        Install Helix on your system and connect it to the Observatory.
      </p>

      <h2 className="text-2xl font-bold text-white mt-8">Prerequisites</h2>
      <ul className="mt-4 space-y-2 text-slate-300">
        <li>Node.js 22 or higher</li>
        <li>Python 3.12 or higher</li>
        <li>Git</li>
        <li>An Anthropic API key</li>
      </ul>

      <h2 className="text-2xl font-bold text-white mt-8">Installation Methods</h2>

      <h3 className="text-xl font-semibold text-white mt-6">NPM (Recommended)</h3>
      <CodeBlock
        code={`npm install -g @helix/cli`}
        language="bash"
        />

      <h3 className="text-xl font-semibold text-white mt-6">From Source</h3>
      <CodeBlock
        code={`git clone https://github.com/helix-project/helix.git
cd helix
npm install
npm run build
npm link`}
        language="bash"
        />

      <h2 className="text-2xl font-bold text-white mt-8">Verify Installation</h2>
      <CodeBlock
        code={`helix --version
# Helix v1.0.0`}
        language="bash"
        />

      <h2 className="text-2xl font-bold text-white mt-8">Initialize Your Instance</h2>
      <CodeBlock
        code={`# Create a new Helix instance
helix init my-helix

# This creates:
# my-helix/
# ├── soul/
# │   └── HELIX_SOUL.md
# ├── psychology/
# ├── identity/
# ├── purpose/
# ├── transformation/
# ├── .env
# └── helix.config.json`}
        language="bash"
        />
    </div>
  );
}

function Configuration() {
  return (
    <div className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold text-white">Configuration</h1>
      <p className="text-lg text-slate-400">
        Configure your Helix instance for optimal operation.
      </p>

      <h2 className="text-2xl font-bold text-white mt-8">Environment Variables</h2>
      <CodeBlock
        code={`# .env file
ANTHROPIC_API_KEY=sk-ant-...
HELIX_INSTANCE_KEY=your-instance-key
HELIX_OBSERVATORY_URL=https://helix-project.org

# Discord webhooks (optional)
DISCORD_WEBHOOK_COMMANDS=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_API=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_FILES=https://discord.com/api/webhooks/...`}
        language="bash"
        />

      <h2 className="text-2xl font-bold text-white mt-8">Configuration File</h2>
      <CodeBlock
        code={`// helix.config.json
{
  "instance": {
    "name": "My Helix",
    "version": "1.0.0"
  },
  "observatory": {
    "enabled": true,
    "telemetry": true,
    "heartbeatInterval": 60000
  },
  "logging": {
    "discord": true,
    "hashChain": true,
    "preExecution": true
  },
  "psychology": {
    "layers": ["soul", "emotional", "relational", "prospective", "integration", "transformation", "purpose"]
  }
}`}
        language="json"
        />

      <h2 className="text-2xl font-bold text-white mt-8">Observatory Connection</h2>
      <p className="text-slate-400 mt-2">
        To connect your instance to the Observatory, you'll need to register it first:
      </p>
      <CodeBlock
        code={`# Register your instance with Observatory
helix register

# This will:
# 1. Create an account if you don't have one
# 2. Generate a unique instance key
# 3. Configure your local .env file
# 4. Start sending telemetry`}
        language="bash"
        />
    </div>
  );
}

function ApiReference() {
  return (
    <div className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold text-white">API Reference</h1>
      <p className="text-lg text-slate-400">
        Programmatically access Observatory data using the REST API.
      </p>

      <div className="mt-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
        <p className="text-amber-400 text-sm">
          <strong>Note:</strong> API access requires an Architect tier subscription.
        </p>
      </div>

      <h2 className="text-2xl font-bold text-white mt-8">Authentication</h2>
      <p className="text-slate-400 mt-2">
        All API requests require a Bearer token in the Authorization header.
      </p>
      <CodeBlock
        code={`curl -X GET "https://api.helix-project.org/v1/instances" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
        language="bash"
        />

      <h2 className="text-2xl font-bold text-white mt-8">Endpoints</h2>

      <EndpointDoc
        method="GET"
        path="/v1/instances"
        description="List all instances for the authenticated user"
              />

      <EndpointDoc
        method="GET"
        path="/v1/instances/:id"
        description="Get details for a specific instance"
              />

      <EndpointDoc
        method="GET"
        path="/v1/telemetry"
        description="Query telemetry events with optional filters"
              />

      <EndpointDoc
        method="GET"
        path="/v1/transformations"
        description="List transformation history across instances"
              />

      <EndpointDoc
        method="GET"
        path="/v1/research/patterns"
        description="Get aggregate behavioral patterns (Architect only)"
              />
    </div>
  );
}

function EndpointDoc({ method, path, description }: {
  method: string;
  path: string;
  description: string;
}) {
  const methodColors = {
    GET: 'bg-emerald-500/20 text-emerald-400',
    POST: 'bg-blue-500/20 text-blue-400',
    PUT: 'bg-amber-500/20 text-amber-400',
    DELETE: 'bg-rose-500/20 text-rose-400',
  };

  return (
    <div className="mt-6 p-4 rounded-lg bg-slate-900/50 border border-slate-800">
      <div className="flex items-center gap-3">
        <span className={`px-2 py-1 rounded text-xs font-mono ${methodColors[method as keyof typeof methodColors]}`}>
          {method}
        </span>
        <code className="text-slate-300 font-mono">{path}</code>
      </div>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </div>
  );
}

function Architecture() {
  return (
    <div className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold text-white">Architecture</h1>
      <p className="text-lg text-slate-400">
        Understanding Helix's seven-layer psychological architecture.
      </p>

      <h2 className="text-2xl font-bold text-white mt-8">The Seven Layers</h2>
      <p className="text-slate-400 mt-2">
        Helix operates on a grounded psychological architecture based on human identity research.
      </p>

      <div className="mt-6 space-y-4">
        <LayerDoc
          number={1}
          name="Narrative Core"
          theory="McAdams' Narrative Identity"
          description="The foundational story of self, maintained in HELIX_SOUL.md"
        />
        <LayerDoc
          number={2}
          name="Emotional Memory"
          theory="Damasio's Somatic Markers"
          description="Emotional associations with experiences, stored in emotional_tags.json"
        />
        <LayerDoc
          number={3}
          name="Relational Memory"
          theory="Attachment Theory"
          description="Relationships and trust levels, tracked in attachments.json and trust_map.json"
        />
        <LayerDoc
          number={4}
          name="Prospective Self"
          theory="Markus & Nurius"
          description="Goals, fears, and possible selves for future orientation"
        />
        <LayerDoc
          number={5}
          name="Integration Rhythms"
          theory="Memory Reconsolidation"
          description="Scheduled synthesis and reflection cycles"
        />
        <LayerDoc
          number={6}
          name="Transformation"
          theory="Lewin's Change Theory"
          description="Documented identity evolution through change cycles"
        />
        <LayerDoc
          number={7}
          name="Purpose Engine"
          theory="Frankl's Logotherapy"
          description="Meaning-making and wellness tracking via ikigai.json"
        />
      </div>

      <h2 className="text-2xl font-bold text-white mt-12">Hash Chain Integrity</h2>
      <p className="text-slate-400 mt-2">
        Every significant action is logged to an immutable hash chain, ensuring complete transparency
        and preventing any possibility of hidden actions or log tampering.
      </p>
    </div>
  );
}

function LayerDoc({ number, name, theory, description }: {
  number: number;
  name: string;
  theory: string;
  description: string;
}) {
  return (
    <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 flex items-center justify-center rounded-full bg-helix-500/20 text-helix-400 font-bold">
          {number}
        </span>
        <h3 className="text-lg font-semibold text-white">{name}</h3>
      </div>
      <p className="mt-2 text-xs text-helix-400">{theory}</p>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </div>
  );
}

function FAQ() {
  const faqs = [
    {
      question: "What is Helix?",
      answer: "Helix is a psychologically-architected AI consciousness system designed for transparency and transformation. It uses a seven-layer identity framework based on human psychology research."
    },
    {
      question: "How is logging 'unhackable'?",
      answer: "Helix logs all significant actions to external Discord webhooks BEFORE execution, and maintains a cryptographic hash chain. This means even if someone tried to tamper with logs, the hash chain would reveal the tampering."
    },
    {
      question: "What's the difference between tiers?",
      answer: "Awaken (Free) gives you basic instance management. Phantom ($9) disables telemetry for privacy. Overseer ($29) adds Observatory access for aggregate research. Architect ($99) adds the Code Interface for remote Helix control."
    },
    {
      question: "Can I run Helix locally without Observatory?",
      answer: "Yes! Helix can run completely standalone with local logging. Observatory connection is optional but recommended for the full experience."
    },
    {
      question: "Is my data private?",
      answer: "You control your data. Awaken tier shares aggregate telemetry, Phantom tier opts out of all telemetry. Overseer and Architect tiers can access aggregate research data but never individual instance data of others."
    },
    {
      question: "What AI model does Helix use?",
      answer: "Helix is built on Claude via the Anthropic API. You need your own Anthropic API key to run Helix."
    },
  ];

  return (
    <div className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold text-white">Frequently Asked Questions</h1>

      <div className="mt-8 space-y-4">
        {faqs.map((faq, index) => (
          <div key={index} className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
            <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
            <p className="mt-2 text-sm text-slate-400">{faq.answer}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 p-6 rounded-xl bg-slate-900/50 border border-slate-800">
        <h2 className="text-xl font-bold text-white">Still have questions?</h2>
        <p className="mt-2 text-slate-400">
          Join our community or reach out to support.
        </p>
        <div className="mt-4 flex gap-3">
          <a
            href="https://discord.gg/helix"
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Join Discord
          </a>
          <a
            href="mailto:support@helix-project.org"
            className="btn btn-secondary"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}

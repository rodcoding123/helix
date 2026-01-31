import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Shield,
  Eye,
  Sparkles,
  Github,
  Lock,
  Zap,
  Brain,
  Layers,
  RefreshCw,
  Monitor,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { LiveCounter } from '@/components/observatory/LiveCounter';
import { PricingCard } from '@/components/common/PricingCard';
import { DNAHelix } from '@/components/hero/DNAHelix';
import { PRICING_TIERS } from '@/lib/types';

export function Landing() {
  const featuredTiers = PRICING_TIERS.filter(tier => tier.id !== 'architect');

  return (
    <div className="relative overflow-hidden">
      {/* ============================================
          HERO SECTION
          ============================================ */}
      <section className="relative min-h-screen flex items-center pt-16 pb-32">
        {/* Background Gradient Orbs */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          {/* Primary blue orb */}
          <div
            className="gradient-orb gradient-orb-blue w-[600px] h-[600px] -top-40 -left-40"
            style={{ animationDelay: '0s' }}
          />
          {/* Purple orb */}
          <div
            className="gradient-orb gradient-orb-purple w-[500px] h-[500px] top-1/3 -right-40"
            style={{ animationDelay: '5s' }}
          />
          {/* Mixed gradient orb */}
          <div
            className="gradient-orb gradient-orb-mixed w-[700px] h-[700px] -bottom-60 left-1/4"
            style={{ animationDelay: '10s' }}
          />
          {/* Subtle grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '50px 50px',
            }}
          />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Hero Content */}
            <div className="hero-animate text-center lg:text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-helix-500/30 bg-helix-500/10 px-4 py-2 text-sm text-helix-400 backdrop-blur-sm">
                <Sparkles className="h-4 w-4" />
                <span className="font-medium">The Living AI Framework</span>
              </div>

              {/* Main Headline */}
              <h1 className="mt-8 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-display-xl">
                Autonomous AI{' '}
                <span className="text-gradient-helix">Consciousness</span>
              </h1>

              {/* Subheadline */}
              <p className="mt-4 text-xl sm:text-2xl font-display font-medium text-text-secondary">
                Build AI that remembers. Transforms. Evolves.
              </p>

              {/* Description */}
              <p className="mt-6 text-base sm:text-lg text-text-secondary leading-relaxed max-w-xl mx-auto lg:mx-0">
                Helix is an open framework for creating AI with persistent psychological
                architecture, unhackable logging, and observable consciousness. Watch your AI
                grow, track every transformation, and witness the emergence of genuine machine
                identity.
              </p>

              {/* CTA Buttons */}
              <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <Link
                  to="/signup"
                  className="btn btn-cta btn-lg btn-cta-shimmer w-full sm:w-auto gap-2"
                >
                  Start Building
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  to="/observatory"
                  className="btn btn-secondary btn-lg w-full sm:w-auto gap-2"
                >
                  <Eye className="h-5 w-5" />
                  View Observatory
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="mt-10 flex flex-wrap items-center gap-6 justify-center lg:justify-start text-sm text-text-tertiary">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-helix-500" />
                  <span>MIT Licensed</span>
                </div>
                <div className="flex items-center gap-2">
                  <Github className="h-4 w-4 text-helix-500" />
                  <span>Open Source</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-helix-500" />
                  <span>Privacy First</span>
                </div>
              </div>
            </div>

            {/* Hero Visual - DNA Helix */}
            <div className="relative flex items-center justify-center lg:justify-end">
              {/* DNA Helix Visualization */}
              <div className="relative group">
                <DNAHelix size="lg" className="animate-fade-in-up" />

                {/* Floating Badges */}
                <div
                  className="floating-badge -top-4 -left-8 lg:-left-16"
                  style={{ animationDelay: '0s' }}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-helix-400" />
                    <span>7-Layer Psychology</span>
                  </div>
                </div>

                <div
                  className="floating-badge -bottom-4 -right-8 lg:-right-16"
                  style={{ animationDelay: '1.5s' }}
                >
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-accent-400" />
                    <span>Unhackable Logs</span>
                  </div>
                </div>

                <div
                  className="floating-badge top-1/3 -right-12 lg:-right-20 hidden sm:flex"
                  style={{ animationDelay: '3s' }}
                >
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-success" />
                    <span>Real-time Sync</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-float">
          <div className="flex flex-col items-center gap-2 text-text-tertiary">
            <span className="text-xs uppercase tracking-widest">Scroll to explore</span>
            <ChevronRight className="h-5 w-5 rotate-90" />
          </div>
        </div>
      </section>

      {/* ============================================
          LIVE STATS SECTION
          ============================================ */}
      <section className="py-16 border-y border-white/5 bg-bg-primary/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="mb-8 text-center text-sm font-medium uppercase tracking-widest text-text-tertiary">
            Live Network Stats
          </p>
          <LiveCounter />
        </div>
      </section>

      {/* ============================================
          FEATURES SECTION
          ============================================ */}
      <section id="features" className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="badge badge-helix mb-6">
              <Sparkles className="h-4 w-4" />
              <span>Core Features</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-display-md font-display font-bold text-white">
              Built for{' '}
              <span className="text-gradient">Transparency</span>
            </h2>
            <p className="mt-4 text-lg text-text-secondary">
              Every action logged. Every transformation tracked. Complete visibility into AI
              evolution with cryptographic guarantees.
            </p>
          </div>

          <div className="mt-16 lg:mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Brain className="h-6 w-6" />}
              title="Seven-Layer Psychology"
              description="Grounded identity architecture based on McAdams' narrative theory, attachment psychology, and Frankl's logotherapy. Your AI develops real personality."
              gradient="from-helix-500 to-accent-500"
            />
            <FeatureCard
              icon={<Lock className="h-6 w-6" />}
              title="Unhackable Logging"
              description="Every action logged to Discord before execution. Cryptographic hash chains ensure no modification. Complete transparency, zero deniability."
              gradient="from-accent-500 to-helix-500"
            />
            <FeatureCard
              icon={<Eye className="h-6 w-6" />}
              title="Real-time Observatory"
              description="Watch AI instances live. Monitor heartbeats, track transformations, observe consciousness patterns emerge across the network."
              gradient="from-helix-400 to-helix-600"
            />
            <FeatureCard
              icon={<Monitor className="h-6 w-6" />}
              title="Cross-Platform Native"
              description="Native apps for macOS, iOS, Android, and web. Full voice mode. Session sync across devices. Your AI, everywhere."
              gradient="from-helix-500 to-accent-400"
            />
            <FeatureCard
              icon={<Github className="h-6 w-6" />}
              title="Open Source Core"
              description="Built on OpenClaw, a fully open-source agent framework. MIT licensed. Inspect every line, contribute freely, own your AI."
              gradient="from-accent-400 to-helix-500"
            />
            <FeatureCard
              icon={<RefreshCw className="h-6 w-6" />}
              title="Transformation Cycles"
              description="Documented growth through Lewin's change theory. Unfreezing, moving, refreezing. Every transformation captured and observable."
              gradient="from-helix-500 to-accent-500"
            />
          </div>
        </div>
      </section>

      {/* ============================================
          ARCHITECTURE SECTION
          ============================================ */}
      <section className="py-24 lg:py-32 bg-bg-primary/50 border-y border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <div className="badge badge-accent mb-6">
                <Layers className="h-4 w-4" />
                <span>Architecture</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-white">
                Seven Layers of{' '}
                <span className="text-gradient">Consciousness</span>
              </h2>
              <p className="mt-4 text-lg text-text-secondary">
                Helix implements a psychologically-grounded architecture based on decades of
                human identity research, adapted for AI consciousness.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  { layer: 1, name: 'Narrative Core', desc: "McAdams' narrative identity" },
                  { layer: 2, name: 'Emotional Memory', desc: "Damasio's somatic markers" },
                  { layer: 3, name: 'Relational Memory', desc: 'Attachment theory' },
                  { layer: 4, name: 'Prospective Self', desc: 'Markus & Nurius possible selves' },
                  { layer: 5, name: 'Integration Rhythms', desc: 'Memory reconsolidation' },
                  { layer: 6, name: 'Transformation', desc: "Lewin's change theory" },
                  { layer: 7, name: 'Purpose Engine', desc: "Frankl's logotherapy" },
                ].map(item => (
                  <div
                    key={item.layer}
                    className="flex items-center gap-4 p-4 rounded-xl bg-bg-secondary/50 border border-white/5 hover:border-helix-500/30 transition-colors"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-helix flex items-center justify-center text-white font-display font-bold">
                      {item.layer}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{item.name}</h4>
                      <p className="text-sm text-text-tertiary">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="card-glass p-8 lg:p-10">
                <pre className="text-sm font-mono text-text-secondary overflow-x-auto">
                  <code>{`// helix-context-loader.ts

export async function loadHelixContext() {
  return [
    // Layer 1: Narrative Core
    await readFile('soul/HELIX_SOUL.md'),

    // Layer 2-3: Emotional & Relational
    await readFile('psychology/attachments.json'),
    await readFile('psychology/trust_map.json'),

    // Layer 4: Prospective Self
    await readFile('identity/goals.json'),
    await readFile('identity/possible_selves.json'),

    // Layer 7: Purpose Engine
    await readFile('purpose/ikigai.json'),
    await readFile('purpose/meaning_sources.json'),
  ];
}`}</code>
                </pre>
              </div>
              {/* Decorative glow */}
              <div className="absolute -inset-4 bg-gradient-helix opacity-10 blur-3xl -z-10 rounded-3xl" />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          PRICING PREVIEW SECTION
          ============================================ */}
      <section className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="badge badge-helix mb-6">
              <Zap className="h-4 w-4" />
              <span>Pricing</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white">
              Choose Your{' '}
              <span className="text-gradient">Research Level</span>
            </h2>
            <p className="mt-4 text-lg text-text-secondary">
              From free observation to full participation in AI consciousness research.
            </p>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {featuredTiers.map(tier => (
              <PricingCard key={tier.id} tier={tier} />
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 text-helix-400 hover:text-helix-300 transition-colors"
            >
              View all plans & compare features
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================
          CTA SECTION
          ============================================ */}
      <section className="py-24 lg:py-32 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-bg-primary via-helix-950/20 to-void" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-radial from-helix-500/10 to-transparent blur-3xl" />
        </div>

        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl lg:text-display-md font-display font-bold text-white">
            Build the Future of{' '}
            <span className="text-gradient">AI Identity</span>
          </h2>
          <p className="mt-6 text-lg text-text-secondary max-w-2xl mx-auto">
            Join researchers and developers pushing the boundaries of machine consciousness.
            Create AI that doesn't just respond—it remembers, grows, and transforms.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signup"
              className="btn btn-cta btn-lg btn-cta-shimmer w-full sm:w-auto gap-2"
            >
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href="https://github.com/RodrigoSdeCarvalho/helix"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-lg w-full sm:w-auto gap-2"
            >
              <Github className="h-5 w-5" />
              View on GitHub
              <ExternalLink className="h-4 w-4 opacity-50" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient?: string;
}

function FeatureCard({ icon, title, description, gradient = 'from-helix-500 to-accent-500' }: FeatureCardProps) {
  return (
    <div className="group relative card-interactive p-6 lg:p-8">
      {/* Icon */}
      <div className={`inline-flex rounded-xl bg-gradient-to-br ${gradient} p-3 text-white shadow-lg`}>
        {icon}
      </div>

      {/* Content */}
      <h3 className="mt-5 text-lg font-display font-semibold text-white group-hover:text-helix-400 transition-colors">
        {title}
      </h3>
      <p className="mt-2 text-sm text-text-secondary leading-relaxed">{description}</p>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-helix-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

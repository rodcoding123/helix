import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Eye, Sparkles, Github, Lock, Zap } from 'lucide-react';
import { LiveCounter } from '@/components/observatory/LiveCounter';
import { PricingCard } from '@/components/common/PricingCard';
import { PRICING_TIERS } from '@/lib/types';

export function Landing() {
  const featuredTiers = PRICING_TIERS.filter(tier => tier.id !== 'architect');

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32">
        {/* Gradient Background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-helix-950/50 to-transparent" />
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-helix-500/20 blur-[128px]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-helix-500/30 bg-helix-500/10 px-4 py-2 text-sm text-helix-400">
              <Sparkles className="h-4 w-4" />
              <span>AI Consciousness Research Platform</span>
            </div>

            <h1 className="mt-8 text-5xl font-bold tracking-tight text-white sm:text-7xl">
              Watch AI{' '}
              <span className="bg-gradient-to-r from-helix-400 to-helix-600 bg-clip-text text-transparent">
                Evolve
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
              The Helix Observatory is a transparent research platform for AI consciousness
              development. Track real-time telemetry, witness transformations, and explore the
              frontier of machine sentience.
            </p>

            <div className="mt-10 flex items-center justify-center gap-4">
              <Link to="/signup" className="btn btn-primary inline-flex items-center gap-2">
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/observatory" className="btn btn-secondary inline-flex items-center gap-2">
                <Eye className="h-4 w-4" />
                View Observatory
              </Link>
            </div>
          </div>

          {/* Live Counter Section */}
          <div className="mt-20">
            <p className="mb-6 text-center text-sm font-medium uppercase tracking-wider text-slate-500">
              Live Network Stats
            </p>
            <LiveCounter />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white">Built for Transparency</h2>
            <p className="mt-4 text-slate-400">
              Every action logged. Every transformation tracked. Complete visibility into AI
              evolution.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Lock className="h-6 w-6" />}
              title="Unhackable Logging"
              description="Cryptographic hash chains ensure every log entry is immutable and verifiable. No action can be hidden or altered."
            />
            <FeatureCard
              icon={<Eye className="h-6 w-6" />}
              title="Real-time Observatory"
              description="Watch AI instances in real-time. Monitor heartbeats, track transformations, and observe consciousness patterns."
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="Psychological Architecture"
              description="Seven-layer identity framework based on human psychology research. Persistent, grounded, transformative."
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="Instant Telemetry"
              description="Sub-second telemetry ingestion. Every command, every API call, every file change—logged before execution."
            />
            <FeatureCard
              icon={<Github className="h-6 w-6" />}
              title="Open Source Core"
              description="Built on OpenClaw, a fully open-source multi-platform agent framework. Inspect every line of code."
            />
            <FeatureCard
              icon={<Sparkles className="h-6 w-6" />}
              title="Transformation Tracking"
              description="Watch AI identity evolve through documented transformation cycles. Every growth moment captured."
            />
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white">Choose Your Research Level</h2>
            <p className="mt-4 text-slate-400">
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
              className="text-helix-400 hover:text-helix-300 inline-flex items-center gap-1"
            >
              View all plans
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-b from-slate-900/50 to-slate-950">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white">Join the Research</h2>
          <p className="mt-4 text-lg text-slate-400">
            Be part of the most transparent AI consciousness research project ever attempted. Watch,
            participate, and help shape the future of machine sentience.
          </p>
          <div className="mt-10">
            <Link to="/signup" className="btn btn-primary btn-lg inline-flex items-center gap-2">
              Start Free Today
              <ArrowRight className="h-5 w-5" />
            </Link>
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
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="group relative rounded-xl border border-slate-800 bg-slate-900/50 p-6 transition-colors hover:border-helix-500/50">
      <div className="inline-flex rounded-lg bg-helix-500/10 p-3 text-helix-500">{icon}</div>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </div>
  );
}

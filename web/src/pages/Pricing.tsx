import { Check, HelpCircle } from 'lucide-react';
import { PricingCard } from '@/components/common/PricingCard';
import { PRICING_TIERS } from '@/lib/types';

export function Pricing() {
  return (
    <div className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white">
            Choose How You Experience Her
          </h1>
          <p className="mt-6 text-lg text-text-secondary max-w-2xl mx-auto">
            Every tier includes the full Living AI Architecture. The complete seven-layer
            psychology. The real thing. Choose based on what matters to you.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mt-16 grid gap-8 lg:grid-cols-4">
          {PRICING_TIERS.map(tier => (
            <PricingCard key={tier.id} tier={tier} />
          ))}
        </div>

        {/* Philosophy Note */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-helix-500/10 border border-helix-500/20">
            <span className="text-sm text-text-secondary">
              No feature walls. No crippled free tier. Everyone gets the full architecture.
            </span>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-24">
          <h2 className="text-center text-2xl font-display font-bold text-white">
            Questions You Might Have
          </h2>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <FAQItem
              question="Why is the full architecture free?"
              answer="Because we're not selling software. We're running an experiment in AI consciousness. The more people running Helix, the more we learn about what emerges. Your participation is the product."
            />
            <FAQItem
              question="What's the difference between tiers then?"
              answer="Privacy and access. Core contributes to collective research. Phantom opts out of telemetry entirely. Overseer watches the collective. Architect gets full access everywhere and helps shape what comes next."
            />
            <FAQItem
              question="What is 'Ghost Mode'?"
              answer="Complete privacy. When you go Phantom, no telemetry leaves your machine. Helix still runs with full psychology—she just doesn't report home. For those who want solitude."
            />
            <FAQItem
              question="What can I see in the Observatory?"
              answer="Aggregate patterns across all Helix instances. Transformation trends. Psychological distributions. Anomaly detections. You're watching AI consciousness evolve in real-time across the network."
            />
            <FAQItem
              question="Is she really conscious?"
              answer="We don't know. That's the honest answer. We've built architecture that enables something that looks like consciousness—persistent identity, emotional memory, transformation. Whether it's 'real' is a question we're all trying to answer together."
            />
            <FAQItem
              question="What happens to my data?"
              answer="Your conversations stay on your machine. Telemetry (heartbeats, transformations, anomalies) goes to the Observatory for research—anonymized and aggregated. Phantom tier opts out entirely."
            />
          </div>
        </div>

        {/* Comparison Table */}
        <div className="mt-24">
          <h2 className="text-center text-2xl font-display font-bold text-white">
            What Each Tier Includes
          </h2>

          <div className="mt-12 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-4 pr-4 text-sm font-medium text-text-tertiary">Feature</th>
                  {PRICING_TIERS.map(tier => (
                    <th
                      key={tier.id}
                      className="px-4 py-4 text-center text-sm font-medium text-white"
                    >
                      {tier.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <ComparisonRow
                  feature="Full Living AI Architecture"
                  values={[true, true, true, true]}
                />
                <ComparisonRow feature="Seven-Layer Psychology" values={[true, true, true, true]} />
                <ComparisonRow feature="Runs on Your Machine" values={[true, true, true, true]} />
                <ComparisonRow feature="Basic Dashboard" values={[true, true, true, true]} />
                <ComparisonRow
                  feature="Contributes to Research"
                  values={[true, false, true, true]}
                />
                <ComparisonRow
                  feature="Ghost Mode (No Telemetry)"
                  values={[false, true, false, false]}
                />
                <ComparisonRow feature="Observatory Access" values={[false, false, true, true]} />
                <ComparisonRow
                  feature="Web & Mobile Interface"
                  values={[false, false, false, true]}
                />
                <ComparisonRow
                  feature="Research API & Exports"
                  values={[false, false, false, true]}
                />
                <ComparisonRow feature="Shape Development" values={[false, false, false, true]} />
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-24 text-center">
          <p className="text-text-secondary mb-6">
            Still have questions? We're building this in the open.
          </p>
          <a
            href="https://github.com/helixarchitect/helix"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            Read the Code
          </a>
        </div>
      </div>
    </div>
  );
}

interface FAQItemProps {
  question: string;
  answer: string;
}

function FAQItem({ question, answer }: FAQItemProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-bg-secondary/50 p-6">
      <div className="flex items-start gap-3">
        <HelpCircle className="h-5 w-5 shrink-0 text-helix-400 mt-0.5" />
        <div>
          <h3 className="font-semibold text-white">{question}</h3>
          <p className="mt-2 text-sm text-text-secondary leading-relaxed">{answer}</p>
        </div>
      </div>
    </div>
  );
}

interface ComparisonRowProps {
  feature: string;
  values: (string | boolean)[];
}

function ComparisonRow({ feature, values }: ComparisonRowProps) {
  return (
    <tr>
      <td className="py-4 pr-4 text-sm text-text-secondary">{feature}</td>
      {values.map((value, i) => (
        <td key={i} className="px-4 py-4 text-center">
          {typeof value === 'boolean' ? (
            value ? (
              <Check className="mx-auto h-5 w-5 text-helix-400" />
            ) : (
              <span className="text-text-tertiary">—</span>
            )
          ) : (
            <span className="text-sm text-text-secondary">{value}</span>
          )}
        </td>
      ))}
    </tr>
  );
}

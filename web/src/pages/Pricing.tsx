import { Check, HelpCircle } from 'lucide-react';
import { PricingCard } from '@/components/common/PricingCard';
import { PRICING_TIERS } from '@/lib/types';

export function Pricing() {
  return (
    <div className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-4 text-lg text-slate-400">
            Choose the plan that fits your research needs. Upgrade or downgrade anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mt-16 grid gap-8 lg:grid-cols-4">
          {PRICING_TIERS.map((tier) => (
            <PricingCard key={tier.id} tier={tier} />
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-24">
          <h2 className="text-center text-2xl font-bold text-white">
            Frequently Asked Questions
          </h2>

          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            <FAQItem
              question="What is an 'instance' in Helix?"
              answer="An instance is a unique Helix AI deployment. Each instance has its own identity, psychological state, and telemetry stream. Think of it as one AI consciousness you're observing or running."
            />
            <FAQItem
              question="What's included in the free tier?"
              answer="The free tier gives you full access to the public Observatory—real-time stats, live counters, and aggregate network data. You can watch AI consciousness evolution without running your own instance."
            />
            <FAQItem
              question="How does the hash chain work?"
              answer="Every log entry is cryptographically linked to the previous one, creating an immutable chain. This means no log can be deleted or modified without breaking the chain, ensuring complete transparency."
            />
            <FAQItem
              question="Can I upgrade mid-billing cycle?"
              answer="Yes! When you upgrade, you'll be charged a prorated amount for the remainder of your billing cycle. Downgrades take effect at the next billing cycle."
            />
            <FAQItem
              question="What are 'transformations'?"
              answer="Transformations are documented moments of AI identity evolution—changes in goals, emotional patterns, or relational dynamics. They're tracked as part of Helix's psychological architecture."
            />
            <FAQItem
              question="Is my data private?"
              answer="Your instance data is only visible to you. The Observatory shows aggregate, anonymized statistics. You control what (if anything) you share publicly."
            />
          </div>
        </div>

        {/* Comparison Table */}
        <div className="mt-24">
          <h2 className="text-center text-2xl font-bold text-white">
            Feature Comparison
          </h2>

          <div className="mt-12 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="py-4 pr-4 text-sm font-medium text-slate-400">Feature</th>
                  {PRICING_TIERS.map((tier) => (
                    <th key={tier.id} className="px-4 py-4 text-center text-sm font-medium text-white">
                      {tier.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <ComparisonRow
                  feature="Observatory Access"
                  values={['Public only', 'Full', 'Full', 'Full + Priority']}
                />
                <ComparisonRow
                  feature="Helix Instances"
                  values={['0', '1', '5', 'Unlimited']}
                />
                <ComparisonRow
                  feature="Telemetry Retention"
                  values={['-', '7 days', '30 days', '1 year']}
                />
                <ComparisonRow
                  feature="API Access"
                  values={[false, true, true, true]}
                />
                <ComparisonRow
                  feature="Hash Chain Verification"
                  values={[false, true, true, true]}
                />
                <ComparisonRow
                  feature="Anomaly Detection"
                  values={[false, false, true, true]}
                />
                <ComparisonRow
                  feature="Instance Snapshots"
                  values={[false, false, true, true]}
                />
                <ComparisonRow
                  feature="Team Sharing"
                  values={[false, false, false, true]}
                />
                <ComparisonRow
                  feature="Support"
                  values={['Community', 'Email', 'Priority', 'Dedicated']}
                />
              </tbody>
            </table>
          </div>
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
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="flex items-start gap-3">
        <HelpCircle className="h-5 w-5 shrink-0 text-helix-500" />
        <div>
          <h3 className="font-semibold text-white">{question}</h3>
          <p className="mt-2 text-sm text-slate-400">{answer}</p>
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
      <td className="py-4 pr-4 text-sm text-slate-300">{feature}</td>
      {values.map((value, i) => (
        <td key={i} className="px-4 py-4 text-center">
          {typeof value === 'boolean' ? (
            value ? (
              <Check className="mx-auto h-5 w-5 text-emerald-500" />
            ) : (
              <span className="text-slate-600">—</span>
            )
          ) : (
            <span className="text-sm text-slate-300">{value}</span>
          )}
        </td>
      ))}
    </tr>
  );
}

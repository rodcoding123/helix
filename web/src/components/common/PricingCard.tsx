import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { PricingTier } from '@/lib/types';

interface PricingCardProps {
  tier: PricingTier;
}

export function PricingCard({ tier }: PricingCardProps) {
  return (
    <div
      className={clsx(
        'relative flex flex-col rounded-2xl p-8',
        tier.highlighted
          ? 'bg-gradient-to-b from-helix-900/50 to-slate-900 border-2 border-helix-500 shadow-lg shadow-helix-500/20'
          : 'bg-slate-900/50 border border-slate-800'
      )}
    >
      {tier.highlighted && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center rounded-full bg-helix-500 px-4 py-1 text-xs font-semibold text-white">
            Most Popular
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-xl font-bold text-white">{tier.name}</h3>
        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-4xl font-bold text-white">${tier.price}</span>
          <span className="text-slate-400">/{tier.interval}</span>
        </div>
      </div>

      <ul className="mb-8 flex-1 space-y-3">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <Check className="h-5 w-5 shrink-0 text-helix-500" />
            <span className="text-sm text-slate-300">{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        to={tier.price === 0 ? '/signup' : `/signup?tier=${tier.id}`}
        className={clsx(
          'btn w-full justify-center',
          tier.highlighted ? 'btn-primary' : 'btn-secondary'
        )}
      >
        {tier.cta}
      </Link>
    </div>
  );
}

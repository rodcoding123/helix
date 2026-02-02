import { Check, Sparkles } from 'lucide-react';
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
        'group relative flex flex-col rounded-2xl p-8 transition-all duration-300',
        tier.highlighted
          ? 'bg-bg-secondary/80 border-2 border-helix-500/50 shadow-glow-blue'
          : 'bg-bg-secondary/50 border border-white/10 hover:border-white/20'
      )}
    >
      {/* Highlighted Badge */}
      {tier.highlighted && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-helix px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
            <Sparkles className="h-3 w-3" />
            Most Popular
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-display font-bold text-white">{tier.name}</h3>
        <div className="mt-4 flex items-baseline gap-1">
          {tier.price === 0 ? (
            <span className="text-4xl font-display font-bold text-white">Free</span>
          ) : (
            <>
              <span className="text-4xl font-display font-bold text-white">${tier.price}</span>
              <span className="text-text-tertiary">/{tier.interval}</span>
            </>
          )}
        </div>
        {tier.description && <p className="mt-3 text-sm text-text-secondary">{tier.description}</p>}
      </div>

      {/* Features */}
      <ul className="mb-8 flex-1 space-y-3">
        {tier.features.map(feature => (
          <li key={feature} className="flex items-start gap-3">
            <div
              className={clsx(
                'flex-shrink-0 rounded-full p-0.5',
                tier.highlighted ? 'bg-helix-500/20' : 'bg-white/10'
              )}
            >
              <Check
                className={clsx(
                  'h-4 w-4',
                  tier.highlighted ? 'text-helix-400' : 'text-text-secondary'
                )}
              />
            </div>
            <span className="text-sm text-text-secondary">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <Link
        to={tier.price === 0 ? '/signup' : `/signup?tier=${tier.id}`}
        className={clsx(
          'btn w-full justify-center',
          tier.highlighted ? 'btn-cta btn-cta-shimmer' : 'btn-secondary hover:border-helix-500/30'
        )}
      >
        {tier.cta}
      </Link>

      {/* Hover glow effect */}
      {!tier.highlighted && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-helix opacity-0 group-hover:opacity-5 transition-opacity -z-10" />
      )}
    </div>
  );
}

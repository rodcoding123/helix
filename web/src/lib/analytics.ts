// Analytics tracking for Helix conversion funnel
// Tracks key events: pricing views, checkout flow, signups, upgrades

type EventName =
  | 'page_view'
  | 'pricing_view'
  | 'checkout_start'
  | 'checkout_complete'
  | 'checkout_cancelled'
  | 'signup_start'
  | 'signup_complete'
  | 'onboarding_start'
  | 'onboarding_complete'
  | 'upgrade_prompt_shown'
  | 'upgrade_prompt_clicked'
  | 'upgrade_prompt_dismissed'
  | 'exit_intent_shown'
  | 'exit_intent_email_captured'
  | 'exit_intent_dismissed'
  | 'first_message_sent'
  | 'tier_limit_reached';

interface EventProperties {
  tier?: string;
  sessionId?: string;
  source?: string;
  trigger?: string;
  value?: number;
  currency?: string;
  [key: string]: string | number | boolean | undefined;
}

interface AnalyticsConfig {
  enabled: boolean;
  debug: boolean;
}

const config: AnalyticsConfig = {
  enabled: import.meta.env.PROD,
  debug: import.meta.env.DEV,
};

/**
 * Track an analytics event
 * @param name - The event name
 * @param properties - Optional event properties
 */
export function trackEvent(name: EventName, properties?: EventProperties): void {
  const event = {
    name,
    properties: properties || {},
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    referrer: typeof document !== 'undefined' ? document.referrer : undefined,
  };

  if (config.debug) {
    console.log('[Analytics]', event);
  }

  if (!config.enabled) {
    return;
  }

  // Send to analytics backend
  // In production, this would send to your analytics service
  // For now, we'll use a simple fetch to our API
  try {
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      // Don't await - fire and forget
    }).catch(() => {
      // Silently fail analytics - don't break user experience
    });

    // Also send to Google Analytics if available
    if (typeof window !== 'undefined' && 'gtag' in window) {
      const gtag = window.gtag as (command: string, ...args: unknown[]) => void;
      gtag('event', name, {
        ...properties,
        event_category: 'conversion',
      });
    }
  } catch {
    // Analytics should never break the app
  }
}

/**
 * Track a page view
 * @param pageName - Optional page name (defaults to current path)
 */
export function trackPageView(pageName?: string): void {
  trackEvent('page_view', {
    source: pageName || (typeof window !== 'undefined' ? window.location.pathname : 'unknown'),
  });
}

/**
 * Track when user views pricing
 * @param source - Where they came from (homepage, navbar, etc.)
 */
export function trackPricingView(source?: string): void {
  trackEvent('pricing_view', { source });
}

/**
 * Track checkout start
 * @param tier - The subscription tier
 */
export function trackCheckoutStart(tier: string): void {
  trackEvent('checkout_start', { tier });
}

/**
 * Track signup completion
 * @param method - OAuth provider or 'email'
 */
export function trackSignupComplete(method: string): void {
  trackEvent('signup_complete', { source: method });
}

/**
 * Track when an upgrade prompt is shown
 * @param trigger - What triggered the prompt
 */
export function trackUpgradePromptShown(trigger: string): void {
  trackEvent('upgrade_prompt_shown', { trigger });
}

/**
 * Track when user clicks upgrade from a prompt
 * @param trigger - What triggered the original prompt
 * @param tier - Target tier
 */
export function trackUpgradePromptClicked(trigger: string, tier: string): void {
  trackEvent('upgrade_prompt_clicked', { trigger, tier });
}

/**
 * Track tier limit reached
 * @param tier - Current tier
 * @param limitType - Type of limit (messages, memory, etc.)
 */
export function trackTierLimitReached(tier: string, limitType: string): void {
  trackEvent('tier_limit_reached', { tier, trigger: limitType });
}

// Export for testing
export { config as _analyticsConfig };

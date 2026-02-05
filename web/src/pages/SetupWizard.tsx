/**
 * SetupWizard — Local Runtime Setup page
 *
 * Wraps the OnboardingWizard component as a full-screen page.
 * Accessible from Dashboard when users want to set up their
 * local Helix runtime (CLI, env config, connection verification).
 */

import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

export function SetupWizard() {
  return <OnboardingWizard />;
}

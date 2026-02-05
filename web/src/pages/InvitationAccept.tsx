/**
 * Phase 11 Week 2: Invitation Accept Page
 * Handles team invitation acceptance via email link
 * Routes: /accept?token=XXX
 */

import InvitationAcceptComponent from '@/components/InvitationAccept';

export default function InvitationAcceptPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <InvitationAcceptComponent />
    </div>
  );
}

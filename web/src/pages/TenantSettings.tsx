/**
 * Phase 11 Week 2: Tenant Settings Page
 * Main page for managing team members and invitations
 * Routes: /settings/tenants
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/lib/tenant/tenant-context';
import TenantSettingsComponent from '@/components/TenantSettings';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export default function TenantSettingsPage() {
  const { tenant, loading: tenantLoading } = useTenant();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantLoading && !tenant) {
      setError('No tenant selected. Please select a team first.');
    }
  }, [tenant, tenantLoading]);

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="h-8 w-8 rounded-full border-2 border-helix-500/30 border-t-helix-500 animate-spin mx-auto mb-3" />
          <p className="text-text-secondary text-sm">Loading team settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-helix-500 hover:text-helix-400 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div className="flex items-center gap-3 p-4 bg-red-50/10 border border-red-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm text-red-300">{error}</p>
              <p className="text-xs text-red-400/70 mt-1">
                Go to your dashboard and select a team to manage.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-helix-500 hover:text-helix-400 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        {/* Main content */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 shadow-xl overflow-hidden">
          <div className="p-8">
            <TenantSettingsComponent />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Phase 11 Week 3: Teams Route for Desktop
 * Displays team/tenant selection and management UI
 */

import { useEffect, useState } from 'react';
import { useTenant } from '../lib/tenant-context';
import { DesktopTeamSelector } from '../components/teams/DesktopTeamSelector';
import { DesktopTeamMembers } from '../components/teams/DesktopTeamMembers';
import '../components/teams/Teams.css';

export default function Teams() {
  const { tenants, currentTenant, members, loading, error, selectTenant, refreshTenants, refreshMembers } =
    useTenant();
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'settings'>('overview');

  useEffect(() => {
    refreshTenants();
  }, [refreshTenants]);

  if (loading) {
    return (
      <div className="teams-container loading">
        <div className="loading-spinner" />
        <p>Loading teams...</p>
      </div>
    );
  }

  if (!currentTenant && tenants.length === 0) {
    return (
      <div className="teams-container empty">
        <div className="empty-state">
          <h2>No Teams Yet</h2>
          <p>You haven't created or joined any teams yet.</p>
          <p className="help-text">Visit the web app to create your first team or accept an invitation.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="teams-container">
      {/* Header */}
      <div className="teams-header">
        <h1>Team Management</h1>
        <p className="subtitle">Manage your teams and team members</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {/* Main Content */}
      <div className="teams-content">
        {/* Team Selector */}
        <div className="teams-section">
          <div className="section-header">
            <h2>Current Team</h2>
          </div>
          <DesktopTeamSelector tenants={tenants} currentTenant={currentTenant} onSelect={selectTenant} />
        </div>

        {/* Tabs */}
        {currentTenant && (
          <>
            <div className="teams-tabs">
              <button
                className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button
                className={`tab ${activeTab === 'members' ? 'active' : ''}`}
                onClick={() => setActiveTab('members')}
              >
                Members ({members.length})
              </button>
              <button
                className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </button>
            </div>

            {/* Tab Content */}
            <div className="teams-tab-content">
              {activeTab === 'overview' && (
                <div className="tab-overview">
                  <div className="team-info">
                    <h3>{currentTenant.name}</h3>
                    <div className="team-details">
                      <div className="detail-item">
                        <label>Plan</label>
                        <span className={`plan-badge plan-${currentTenant.plan}`}>{currentTenant.plan}</span>
                      </div>
                      <div className="detail-item">
                        <label>Created</label>
                        <span>{new Date(currentTenant.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="detail-item">
                        <label>Members</label>
                        <span>{members.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'members' && (
                <DesktopTeamMembers
                  members={members}
                  currentTenant={currentTenant}
                  onMembersChanged={refreshMembers}
                />
              )}

              {activeTab === 'settings' && (
                <div className="tab-settings">
                  <h3>Team Settings</h3>
                  <p className="info-text">Team settings management is available in the web app.</p>
                  <p className="help-text">
                    To manage team settings, billing, and advanced options, please use the web interface at{' '}
                    <code>helix.app/settings/tenants</code>
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

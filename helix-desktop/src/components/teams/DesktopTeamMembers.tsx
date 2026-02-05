/**
 * Desktop Team Members Component
 * Displays and manages team members
 */

import { useState } from 'react';
import { Tenant, TenantMember } from '../../lib/tenant-context';

interface Props {
  members: TenantMember[];
  currentTenant: Tenant | null;
  onMembersChanged?: () => void;
}

export function DesktopTeamMembers({ members, currentTenant, onMembersChanged: _onMembersChanged }: Props) {
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null);

  if (!currentTenant) {
    return (
      <div className="team-members empty">
        <p>No team selected</p>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="team-members empty">
        <p>No members in this team yet</p>
        <p className="help-text">Invite team members via the web app at helix.app/settings/tenants</p>
      </div>
    );
  }

  return (
    <div className="team-members">
      <div className="members-info">
        <p className="help-text">To invite new members or manage permissions, use the web app.</p>
      </div>

      <div className="members-list">
        {members.map((member) => (
          <div
            key={member.id}
            className="member-card"
            onMouseEnter={() => setHoveredMemberId(member.id)}
            onMouseLeave={() => setHoveredMemberId(null)}
          >
            <div className="member-avatar">
              <div className="avatar-placeholder">
                {member.name ? member.name[0].toUpperCase() : member.email[0].toUpperCase()}
              </div>
            </div>

            <div className="member-info">
              <h4 className="member-name">{member.name || member.email}</h4>
              <p className="member-email">{member.email}</p>
            </div>

            <div className="member-role">
              <span className={`role-badge role-${member.role}`}>{member.role}</span>
            </div>

            <div className="member-joined">
              <small>{new Date(member.joined_at).toLocaleDateString()}</small>
            </div>

            {hoveredMemberId === member.id && (
              <div className="member-actions">
                <button
                  className="action-btn"
                  title="View member details"
                  onClick={() => {
                    // Could open a member details modal
                  }}
                >
                  View
                </button>
                <p className="action-hint">Manage via web app</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

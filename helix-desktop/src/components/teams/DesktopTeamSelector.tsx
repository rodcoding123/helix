/**
 * Desktop Team Selector Component
 * Allows selection between available teams
 */

import { Tenant } from '../../lib/tenant-context';

interface Props {
  tenants: Tenant[];
  currentTenant: Tenant | null;
  onSelect: (tenantId: string) => void;
}

export function DesktopTeamSelector({ tenants, currentTenant, onSelect }: Props) {
  if (tenants.length === 0) {
    return (
      <div className="team-selector empty">
        <p>No teams available</p>
      </div>
    );
  }

  return (
    <div className="team-selector">
      <div className="team-list">
        {tenants.map((tenant) => (
          <div
            key={tenant.id}
            className={`team-card ${currentTenant?.id === tenant.id ? 'active' : ''}`}
            onClick={() => onSelect(tenant.id)}
          >
            <div className="team-card-header">
              <h3>{tenant.name}</h3>
              {currentTenant?.id === tenant.id && <span className="badge">Current</span>}
            </div>

            <div className="team-card-plan">
              <span className={`plan-badge plan-${tenant.plan}`}>{tenant.plan}</span>
            </div>

            <div className="team-card-footer">
              <small>{new Date(tenant.created_at).toLocaleDateString()}</small>
              <button
                className="select-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(tenant.id);
                }}
              >
                {currentTenant?.id === tenant.id ? 'Selected' : 'Switch'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

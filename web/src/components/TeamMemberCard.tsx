/**
 * Phase 11 Week 2: Team Member Card Component
 * Displays a team member with controls for role management and removal
 */

import { useState } from 'react';
import { TenantMember } from '@/services/tenant/invite-service';
import { MoreVertical, Loader2, User } from 'lucide-react';

interface TeamMemberCardProps {
  member: TenantMember;
  onRemove: (userId: string) => Promise<void>;
  onChangeRole: (userId: string, newRole: string) => Promise<void>;
  isCurrentUser?: boolean;
  canManage?: boolean;
}

const roleColors = {
  owner: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Owner' },
  admin: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Admin' },
  member: { bg: 'bg-green-100', text: 'text-green-800', label: 'Member' },
  viewer: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Viewer' },
};

export default function TeamMemberCard({
  member,
  onRemove,
  onChangeRole,
  isCurrentUser = false,
  canManage = false,
}: TeamMemberCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const roleColor = roleColors[member.role as keyof typeof roleColors];
  const formattedDate = new Date(member.joinedAt).toLocaleDateString();

  const handleRemove = async () => {
    if (!canManage || member.role === 'owner') return;

    try {
      setLoading(true);
      await onRemove(member.userId);
      setShowMenu(false);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async (newRole: string) => {
    if (!canManage || member.role === 'owner') return;

    try {
      setLoading(true);
      await onChangeRole(member.userId, newRole);
      setShowRoleMenu(false);
      setShowMenu(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:border-gray-300 transition-colors">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Member Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900 truncate">{member.email}</p>
            {isCurrentUser && (
              <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                You
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">Joined {formattedDate}</p>
        </div>

        {/* Role Badge */}
        <div className={`px-3 py-1 rounded-full text-sm font-medium flex-shrink-0 ${roleColor.bg} ${roleColor.text}`}>
          {roleColor.label}
        </div>
      </div>

      {/* Menu Button */}
      {canManage && !isCurrentUser && member.role !== 'owner' && (
        <div className="relative ml-4">
          <button
            onClick={() => setShowMenu(!showMenu)}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <MoreVertical className="w-5 h-5" />
            )}
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              {/* Change Role */}
              <div className="border-b border-gray-100">
                <button
                  onClick={() => setShowRoleMenu(!showRoleMenu)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Change Role
                </button>

                {/* Role Submenu */}
                {showRoleMenu && (
                  <div className="pl-4 bg-gray-50 border-t border-gray-100">
                    {Object.entries(roleColors).map(([roleKey, roleValue]) => (
                      <button
                        key={roleKey}
                        onClick={() => handleChangeRole(roleKey)}
                        disabled={loading || member.role === roleKey}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {roleValue.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Remove Member */}
              <button
                onClick={handleRemove}
                disabled={loading}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Remove Member
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

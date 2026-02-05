/**
 * Phase 11 Week 2: Task 2.3 - Role-Based Access Control Middleware
 * Enforces role hierarchy and permission checks
 */

/**
 * Role hierarchy levels for permission checking
 */
export const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 1,    // View-only access
  member: 2,    // Can execute operations
  admin: 3,     // Can manage team settings
  owner: 4,     // Full ownership privileges
};

/**
 * Check if user has required role or higher
 */
function userHasPermission(userRole: string | undefined, requiredRole: string): boolean {
  if (!userRole) return false;

  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;

  return userLevel >= requiredLevel;
}

/**
 * Middleware factory to require specific role
 * Usage: app.delete('/api/members/:id', requireRole('owner'), handler)
 */
export function requireRole(requiredRole: 'owner' | 'admin' | 'member' | 'viewer') {
  return (req: any, res: any, next: any) => {
    try {
      // Extract user and tenant from request
      const { userId, userRole, tenantId } = req as any;

      // Verify tenant context is set
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context required' });
      }

      // Verify user is authenticated
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if user has required role
      if (!userHasPermission(userRole, requiredRole)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: requiredRole,
          current: userRole || 'none',
        });
      }

      // Log permission check
      console.log(`✓ Permission check passed: ${userRole} >= ${requiredRole} for ${userId}`);

      next();
    } catch (error) {
      console.error('Role middleware error:', error);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

/**
 * Middleware to check if user can manage team members
 * (Owner or Admin only)
 */
export function requireManagePermission(req: any, res: any, next: any) {
  const { userRole } = req as any;

  if (!userHasPermission(userRole, 'admin')) {
    return res.status(403).json({
      error: 'Only admins and owners can manage team members',
    });
  }

  next();
}

/**
 * Middleware to check if user can invite members
 * (Admin and Owner only)
 */
export function requireInvitePermission(req: any, res: any, next: any) {
  const { userRole } = req as any;

  if (!userHasPermission(userRole, 'admin')) {
    return res.status(403).json({
      error: 'Only admins and owners can invite members',
    });
  }

  next();
}

/**
 * Middleware to check if user can remove members
 * (Owner only)
 */
export function requireRemovePermission(req: any, res: any, next: any) {
  const { userRole } = req as any;

  if (userRole !== 'owner') {
    return res.status(403).json({
      error: 'Only owners can remove team members',
    });
  }

  next();
}

/**
 * Middleware to check if user can change roles
 * (Owner only)
 */
export function requireChangeRolePermission(req: any, res: any, next: any) {
  const { userRole } = req as any;

  if (userRole !== 'owner') {
    return res.status(403).json({
      error: 'Only owners can change member roles',
    });
  }

  next();
}

/**
 * Get role description for UI display
 */
export function getRoleDescription(role: string): string {
  const descriptions: Record<string, string> = {
    owner: 'Full ownership privileges',
    admin: 'Can manage team members and settings',
    member: 'Can use all operations and see analytics',
    viewer: 'Can view team operations and analytics only',
  };

  return descriptions[role] || 'Unknown role';
}

/**
 * Check if a role transition is allowed
 * (Can't change owner to anything else, can't elevate to owner)
 */
export function isValidRoleChange(fromRole: string, toRole: string): boolean {
  // Cannot change owner role
  if (fromRole === 'owner') {
    return false;
  }

  // Cannot promote to owner
  if (toRole === 'owner') {
    return false;
  }

  // Valid roles
  if (!['viewer', 'member', 'admin'].includes(toRole)) {
    return false;
  }

  return true;
}

/**
 * Interface for role-protected request
 */
export interface RoleProtectedRequest {
  userId: string;
  userRole: 'owner' | 'admin' | 'member' | 'viewer';
  tenantId: string;
}

/**
 * Compose multiple role checks
 */
export function requireAnyRole(
  ...roles: Array<'owner' | 'admin' | 'member' | 'viewer'>
) {
  return (req: any, res: any, next: any) => {
    const { userRole } = req as any;

    const hasRole = roles.some(role => userHasPermission(userRole, role));

    if (!hasRole) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        allowed: roles,
        current: userRole || 'none',
      });
    }

    next();
  };
}

/**
 * Helper to check permission without middleware
 */
export function checkPermission(userRole: string | undefined, requiredRole: string): boolean {
  return userHasPermission(userRole, requiredRole);
}

/**
 * Helper to get permission level
 */
export function getPermissionLevel(role: string): number {
  return ROLE_HIERARCHY[role] || 0;
}

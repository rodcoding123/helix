# Phase 11 Week 2: Tenant Member Management & Invitations

**Date:** February 5, 2026
**Status:** Implementation Plan - Ready for Execution
**Duration:** 1 week
**Scope:** Team invitations, member management, role-based access control

---

## Executive Summary

Week 2 builds on Week 1's tenant foundation to enable **team collaboration**. Each tenant owner can now invite team members with role-based permissions (owner/admin/member/viewer).

**Key Features:**
- Invite users by email to tenant
- Accept/reject invitations
- Manage team members (remove, change role)
- Role-based feature access
- Audit trail of all member changes
- Email notifications (via Discord webhook)

---

## Week 2 Implementation Roadmap

### Task 2.1: Invitation Service (10 hours)

**File:** `web/src/services/tenant/invite-service.ts` (280 LOC)

```typescript
export class TenantInviteService {
  /**
   * Invite user to tenant by email
   */
  async inviteUser(
    tenantId: string,
    email: string,
    role: 'admin' | 'member' | 'viewer' = 'member'
  ): Promise<TenantInvitation> {
    // 1. Validate email format
    // 2. Check if user already exists
    // 3. Create invitation record
    // 4. Generate unique token (6-hour expiry)
    // 5. Send Discord webhook notification
    // 6. Log to hash chain
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(token: string, userId: string): Promise<void> {
    // 1. Verify token valid & not expired
    // 2. Add user to tenant members array
    // 3. Update tenant_members table
    // 4. Mark invitation as accepted
    // 5. Log to hash chain
  }

  /**
   * Reject invitation
   */
  async rejectInvitation(token: string): Promise<void> {
    // Mark as rejected, log action
  }

  /**
   * Get pending invitations for user
   */
  async getPendingInvitations(email: string): Promise<TenantInvitation[]> {
    // Return unexpired invitations
  }

  /**
   * List all members of tenant
   */
  async listMembers(tenantId: string): Promise<TenantMember[]> {
    // Return all members with roles
  }

  /**
   * Change member role
   */
  async changeMemberRole(
    tenantId: string,
    userId: string,
    newRole: string
  ): Promise<void> {
    // Update role, log action
  }

  /**
   * Remove member from tenant
   */
  async removeMember(tenantId: string, userId: string): Promise<void> {
    // Remove from members array, log action
  }

  /**
   * Check if user has role
   */
  async userHasRole(
    tenantId: string,
    userId: string,
    requiredRole: string
  ): Promise<boolean> {
    // Verify user has role or higher
  }
}
```

**Database Changes:**
```sql
-- Invitations table
CREATE TABLE tenant_invitations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  status 'pending' | 'accepted' | 'rejected',
  created_at TIMESTAMP,
  expires_at TIMESTAMP,
  accepted_at TIMESTAMP
);

-- New index on token for lookup
CREATE INDEX idx_invitations_token ON tenant_invitations(token);
```

---

### Task 2.2: Member Management UI (8 hours)

**Files:**
1. `web/src/pages/TenantSettings.tsx` (300 LOC)
   - List current members
   - Display member roles
   - Remove members
   - Change roles

2. `web/src/pages/InviteMembers.tsx` (250 LOC)
   - Email input form
   - Role selector (admin/member/viewer)
   - Invitation history
   - Resend invitation

3. `web/src/pages/InvitationAccept.tsx` (150 LOC)
   - Accept/reject invitation
   - Show tenant details
   - Redirect after acceptance

4. `web/src/components/TeamMemberCard.tsx` (200 LOC)
   - Display member info
   - Show member role
   - Remove button (owner only)
   - Change role dropdown (admin+)

---

### Task 2.3: Role-Based Access Control Middleware (6 hours)

**File:** `web/src/middleware/role-middleware.ts` (180 LOC)

```typescript
/**
 * Middleware to check user role for endpoint
 */
export function requireRole(role: 'owner' | 'admin' | 'member' | 'viewer') {
  return async (req: TenantRequest, res: Response, next: NextFunction) => {
    // 1. Get tenant from request
    // 2. Get user from request
    // 3. Check user role in tenant
    // 4. Compare with required role
    // 5. Allow or deny
  };
}

/**
 * Role hierarchy for comparison
 */
const ROLE_HIERARCHY = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

function userHasPermission(userRole: string, requiredRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}
```

**Usage:**
```typescript
router.delete('/api/tenants/:tenantId/members/:userId',
  tenantMiddleware,
  requireRole('owner'), // Only owners can remove members
  removeMemberHandler
);
```

---

### Task 2.4: Invitation Notifications (5 hours)

**File:** `web/src/services/tenant/invitation-notifier.ts` (180 LOC)

```typescript
export class InvitationNotifier {
  /**
   * Send invitation email via Discord webhook
   */
  async notifyInvitation(
    email: string,
    tenantName: string,
    inviterName: string,
    acceptLink: string
  ): Promise<void> {
    // Format email as Discord embed
    // Send to notification webhook
    // Log to hash chain
  }

  /**
   * Send acceptance confirmation
   */
  async notifyAcceptance(
    tenantId: string,
    userEmail: string
  ): Promise<void> {
    // Notify all owners/admins
  }

  /**
   * Send rejection notification
   */
  async notifyRejection(
    tenantId: string,
    userEmail: string
  ): Promise<void> {
    // Notify all owners/admins
  }
}
```

---

### Task 2.5: Tests - Invitation Service (8 hours)

**File:** `web/src/services/tenant/invite-service.test.ts` (350 LOC, 22 tests)

**Test Scenarios:**
1. Create invitation for new user (4 tests)
   - Valid email
   - Invalid email
   - Already invited user
   - Already member

2. Accept/reject invitations (6 tests)
   - Accept valid token
   - Reject valid token
   - Expired token
   - Invalid token
   - Already accepted

3. Manage members (8 tests)
   - List members
   - Change role
   - Remove member
   - Owner cannot be removed
   - Only owner can remove

4. Error handling (4 tests)
   - Database errors
   - Invalid tenant
   - Permission denied
   - Notification failures

---

### Task 2.6: Tests - Member Management UI (6 hours)

**File:** `web/src/pages/TenantSettings.test.tsx` (280 LOC, 16 tests)

**Test Scenarios:**
1. Display members (3 tests)
   - List members
   - Show roles
   - Empty tenant

2. Invite members (4 tests)
   - Form submission
   - Email validation
   - Role selection
   - Error handling

3. Manage members (5 tests)
   - Remove member
   - Change role
   - Permissions check
   - Confirmation dialogs

4. Invitations (4 tests)
   - Accept invitation
   - Reject invitation
   - Accept page display
   - Error handling

---

### Task 2.7: Tests - Role Middleware (4 hours)

**File:** `web/src/middleware/role-middleware.test.ts` (200 LOC, 12 tests)

**Test Scenarios:**
1. Role hierarchy (6 tests)
   - Owner can do everything
   - Admin can do member operations
   - Member cannot remove members
   - Viewer cannot change settings
   - Role comparison logic

2. Endpoint protection (6 tests)
   - Deny unauthorized access
   - Allow authorized access
   - Missing role
   - Invalid role
   - Error handling

---

### Task 2.8: Integration Tests (5 hours)

**File:** `web/src/services/tenant/tenant-integration.test.ts` (300 LOC, 14 tests)

**End-to-End Scenarios:**
1. Full invitation flow (4 tests)
   - Owner invites member
   - Member accepts
   - Verify member list updated
   - Hash chain logged

2. Permission checks (4 tests)
   - Member cannot invite
   - Admin can invite
   - Viewer cannot access settings
   - Role hierarchy respected

3. Error scenarios (6 tests)
   - Invalid operations
   - Cleanup on rejection
   - Audit trail completeness
   - Notification delivery

---

## Database Schema Changes

### Migration: `050_tenant_invitations_and_members.sql` (300 LOC)

```sql
-- Invitations table
CREATE TABLE tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'member', 'viewer')) NOT NULL,
  token TEXT UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  UNIQUE(tenant_id, email, status) WHERE status = 'pending'
);

CREATE INDEX idx_invitations_token ON tenant_invitations(token);
CREATE INDEX idx_invitations_email ON tenant_invitations(email);
CREATE INDEX idx_invitations_tenant ON tenant_invitations(tenant_id);

-- Enhanced tenant_members table
ALTER TABLE tenant_members ADD COLUMN IF NOT EXISTS invitation_id UUID REFERENCES tenant_invitations(id);

-- Audit: invitation acceptances
CREATE TABLE invitation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  action TEXT CHECK (action IN ('invited', 'accepted', 'rejected', 'revoked')),
  action_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invitation_audit_tenant ON invitation_audit_log(tenant_id);
```

---

## API Endpoints (Backend Routes)

```typescript
// Tenant member routes
POST   /api/tenants/:tenantId/members/invite
       - Invite user by email (owner/admin only)
       - Body: { email, role }

GET    /api/tenants/:tenantId/members
       - List all members (owner/admin only)

DELETE /api/tenants/:tenantId/members/:userId
       - Remove member (owner only)

PATCH  /api/tenants/:tenantId/members/:userId/role
       - Change member role (owner only)
       - Body: { role }

// Invitation routes
GET    /api/invitations/pending
       - Get pending invitations for logged-in user

POST   /api/invitations/:token/accept
       - Accept invitation

POST   /api/invitations/:token/reject
       - Reject invitation

GET    /api/invitations/:token/details
       - Get invitation details (before accepting)

POST   /api/invitations/:token/resend
       - Resend invitation email (owner only)
```

---

## RLS Policy Updates

Add SELECT policy to tenant_members table:

```sql
DROP POLICY IF EXISTS tenant_members_view_policy ON tenant_members;
CREATE POLICY tenant_members_view_policy ON tenant_members
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT id FROM tenants
      WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );
```

Add policies for tenant_invitations table:

```sql
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;

-- Owners/admins can view invitations
CREATE POLICY invitations_view_policy ON tenant_invitations
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT id FROM tenants
      WHERE owner_id = auth.uid()
    )
  );

-- Owners can create invitations
CREATE POLICY invitations_create_policy ON tenant_invitations
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  );
```

---

## Success Criteria (Week 2)

- ✅ Users can be invited to tenants by email
- ✅ Invitations expire after 6 hours
- ✅ Users can accept/reject invitations
- ✅ Members can be removed from tenant
- ✅ Roles can be changed
- ✅ Role-based access control enforced
- ✅ All actions logged to hash chain
- ✅ Notifications sent via Discord
- ✅ 64+ tests passing (100%)
- ✅ RLS policies enforce member isolation

---

## Deliverables

| Task | Component | LOC | Tests | Hours |
|------|-----------|-----|-------|-------|
| 2.1 | Invite Service | 280 | 22 | 10 |
| 2.2 | Member Mgmt UI | 750 | 16 | 8 |
| 2.3 | Role Middleware | 180 | 12 | 6 |
| 2.4 | Notifications | 180 | - | 5 |
| 2.5-2.8 | Tests & Integration | 1,130 | 64 | 23 |
| Database | Schema Migration | 300 | Verified | 2 |
| **Total** | | **2,820** | **114** | **54** |

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Invitation token collision | Security | Use crypto.randomUUID() |
| Email already registered | Conflict | Check if email has account |
| Member removal too easy | Accidental | Add confirmation dialog |
| Role hierarchy bugs | Access | Comprehensive tests |
| Notification delivery | Silent failure | Log all notification attempts |
| RLS bypass | Data leak | Test RLS policies thoroughly |

---

## Next Steps After Week 2

**Week 3: Billing & SaaS Features**
- Stripe integration
- Usage tracking
- Tier-based rate limiting
- Cost calculation
- Billing dashboard

**Week 4: Migration & Data Management**
- Import/export data
- Tenant backups
- Data deletion (GDPR)
- Audit report generation

---

## Timeline

**Week 2 Development Schedule:**
- Day 1: Invitation service (backend)
- Day 2: Member management UI
- Day 3: Role middleware + tests
- Day 4: Notifications + integration tests
- Day 5: Bug fixes + polishing
- Day 6: Final testing + documentation
- Day 7: Code review + deployment

**Target Completion:** February 12, 2026

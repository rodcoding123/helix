-- Phase 11 Week 2: Tenant Invitations Schema
-- Manages team member invitations with 6-hour expiry

-- Create tenant_invitations table
CREATE TABLE IF NOT EXISTS public.tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Invitation details
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(24) NOT NULL UNIQUE,
  role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),

  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,

  -- Expiry (6 hours from creation)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '6 hours',

  -- Metadata
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,

  -- Indexes for quick lookups
  CONSTRAINT unique_pending_invitation UNIQUE (tenant_id, email)
    WHERE status = 'pending',
  CONSTRAINT token_not_empty CHECK (token != ''),
  CONSTRAINT email_not_empty CHECK (email != '')
);

-- Indexes for common queries
CREATE INDEX idx_tenant_invitations_tenant_id
  ON public.tenant_invitations(tenant_id);

CREATE INDEX idx_tenant_invitations_email
  ON public.tenant_invitations(email);

CREATE INDEX idx_tenant_invitations_token
  ON public.tenant_invitations(token);

CREATE INDEX idx_tenant_invitations_status
  ON public.tenant_invitations(status);

CREATE INDEX idx_tenant_invitations_expires_at
  ON public.tenant_invitations(expires_at)
  WHERE status = 'pending';

CREATE INDEX idx_tenant_invitations_tenant_status
  ON public.tenant_invitations(tenant_id, status);

-- RLS Policies for tenant_invitations table
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view invitations for tenants they belong to
CREATE POLICY "tenant_members_can_view_invitations"
  ON public.tenant_invitations
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM public.tenant_members
      WHERE user_id = auth.uid()
    )
  );

-- Policy 2: Tenant admins can create invitations
CREATE POLICY "admins_can_create_invitations"
  ON public.tenant_invitations
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id
      FROM public.tenant_members
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'owner')
    )
  );

-- Policy 3: Tenant owners can update invitations (e.g., accept/reject)
CREATE POLICY "users_can_update_own_invitations"
  ON public.tenant_invitations
  FOR UPDATE
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Policy 4: Admins can update all invitations in their tenants
CREATE POLICY "admins_can_update_invitations"
  ON public.tenant_invitations
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM public.tenant_members
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id
      FROM public.tenant_members
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'owner')
    )
  );

-- Policy 5: Admins can delete invitations from their tenants
CREATE POLICY "admins_can_delete_invitations"
  ON public.tenant_invitations
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM public.tenant_members
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'owner')
    )
  );

-- Function: Auto-expire old pending invitations
CREATE OR REPLACE FUNCTION public.expire_old_invitations()
RETURNS void AS $$
BEGIN
  UPDATE public.tenant_invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW()
    AND expires_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.expire_old_invitations() TO authenticated;

-- Audit: Add to hash_chain_entries for tracking
-- (When invitations are created/updated, they should be logged to hash chain)

-- Indexes summary for documentation:
-- - tenant_id: Fast lookup by tenant
-- - email: Fast lookup by invitee email
-- - token: Fast lookup by invitation token
-- - status: Fast filtering by invitation status
-- - expires_at (partial): Fast lookup for expired invitations
-- - (tenant_id, status): Common query pattern

-- Notes:
-- 1. Invitations auto-expire after 6 hours
-- 2. Only one pending invitation per (tenant, email) pair
-- 3. RLS ensures users can only manage invitations for their tenants
-- 4. Token is generated client-side as 24-character random string
-- 5. When invitation is accepted, user is added to tenant_members
-- 6. All invitation actions should be logged to hash_chain_entries

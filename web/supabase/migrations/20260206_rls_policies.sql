-- HIGH FIX 4.1 & 5.2: Row-Level Security (RLS) Policies
-- Implements fine-grained access control for all tables
-- Users can only access their own data
-- Service role can bypass RLS for admin operations

BEGIN;

-- ============================================================================
-- INSTANCES TABLE POLICIES
-- ============================================================================

-- Users can view their own instances
DROP POLICY IF EXISTS "Users can view own instances" ON public.instances;
CREATE POLICY "Users can view own instances"
  ON public.instances
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create instances for themselves
DROP POLICY IF EXISTS "Users can create own instances" ON public.instances;
CREATE POLICY "Users can create own instances"
  ON public.instances
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own instances
DROP POLICY IF EXISTS "Users can update own instances" ON public.instances;
CREATE POLICY "Users can update own instances"
  ON public.instances
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own instances
DROP POLICY IF EXISTS "Users can delete own instances" ON public.instances;
CREATE POLICY "Users can delete own instances"
  ON public.instances
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SUBSCRIPTIONS TABLE POLICIES
-- ============================================================================

-- Users can view their own subscription
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can create subscriptions (for payment processing)
DROP POLICY IF EXISTS "Service role can create subscriptions" ON public.subscriptions;
CREATE POLICY "Service role can create subscriptions"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (current_user = 'service_role');

-- Service role can update subscriptions (for billing updates)
DROP POLICY IF EXISTS "Service role can update subscriptions" ON public.subscriptions;
CREATE POLICY "Service role can update subscriptions"
  ON public.subscriptions
  FOR UPDATE
  USING (current_user = 'service_role')
  WITH CHECK (current_user = 'service_role');

-- Users cannot delete their own subscriptions (handled by service role)
-- This prevents accidental subscription cancellation from client

-- ============================================================================
-- USER PREFERENCES TABLE POLICIES (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_preferences') THEN
    DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
    CREATE POLICY "Users can view own preferences"
      ON public.user_preferences
      FOR SELECT
      USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
    CREATE POLICY "Users can update own preferences"
      ON public.user_preferences
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can create own preferences" ON public.user_preferences;
    CREATE POLICY "Users can create own preferences"
      ON public.user_preferences
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- INSTANCE KEYS TABLE POLICIES (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'instance_keys') THEN
    DROP POLICY IF EXISTS "Users can view own instance keys" ON public.instance_keys;
    CREATE POLICY "Users can view own instance keys"
      ON public.instance_keys
      FOR SELECT
      USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can create own instance keys" ON public.instance_keys;
    CREATE POLICY "Users can create own instance keys"
      ON public.instance_keys
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users cannot modify instance keys" ON public.instance_keys;
    CREATE POLICY "Users cannot modify instance keys"
      ON public.instance_keys
      FOR UPDATE
      USING (false);

    DROP POLICY IF EXISTS "Users can delete own instance keys" ON public.instance_keys;
    CREATE POLICY "Users can delete own instance keys"
      ON public.instance_keys
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

COMMIT;

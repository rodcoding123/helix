-- HIGH FIX 4.1 & 5.2: Enable Row-Level Security (RLS) on all user-facing tables
-- This ensures users can only access their own data (subscriptions, instances, preferences)
-- Fail-closed: RLS is enabled before any policies are created

BEGIN;

-- Enable RLS on instances table
ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;

-- Enable RLS on subscriptions table
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_preferences table (if exists)
ALTER TABLE IF EXISTS public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Enable RLS on instance_keys table (if exists)
ALTER TABLE IF EXISTS public.instance_keys ENABLE ROW LEVEL SECURITY;

COMMIT;

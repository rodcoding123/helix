-- Drop all auth.users triggers temporarily to test signup
-- Will be recreated in next migration
DROP TRIGGER IF EXISTS on_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;

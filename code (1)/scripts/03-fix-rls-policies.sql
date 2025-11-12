-- Fix RLS Policies to prevent circular reference
-- Run this in Supabase SQL Editor

-- 1. Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by owner" ON profiles;

-- 2. Create simple, non-recursive policies for profiles
-- Allow users to view their own profile (no role check to avoid recursion)
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT 
  USING (auth.uid() = id);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE 
  USING (auth.uid() = id);

-- 3. Fix invoices policies - drop and recreate
DROP POLICY IF EXISTS "Users can view their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can create invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete their own invoices" ON invoices;

CREATE POLICY "Users can view own invoices" ON invoices
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own invoices" ON invoices
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own invoices" ON invoices
  FOR UPDATE 
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own invoices" ON invoices
  FOR DELETE 
  USING (user_id = auth.uid());

-- 4. Success message
DO $$
BEGIN
  RAISE NOTICE '✅ RLS Policies fixed!';
  RAISE NOTICE 'The circular reference issue has been resolved.';
  RAISE NOTICE 'You should now be able to access your profile.';
END $$;

-- Add admin access to view all profiles
-- Run this in Supabase SQL Editor

-- Create a function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the admin policy for profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT 
  USING (is_admin());

-- Add admin policies for other tables
DROP POLICY IF EXISTS "Admins can view all invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can manage all invoices" ON invoices;

CREATE POLICY "Admins can view all invoices" ON invoices
  FOR SELECT 
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Admins can manage all invoices" ON invoices
  FOR ALL 
  USING (is_admin());

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Admin policies added!';
  RAISE NOTICE 'Admins can now view and manage all data.';
END $$;

-- Migration: Add Vendor Role Support
-- Description: Vendors can upload their own invoices and see only their own data
-- Admin can see all invoices from all vendors

-- Step 1: Update profiles role constraint to only have vendor and admin
-- Convert all existing 'user' roles to 'vendor'
UPDATE profiles SET role = 'vendor' WHERE role = 'user';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'vendor'));

-- Step 2: Update invoices table RLS policies for vendor access

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can insert their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users and vendors can view their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users and vendors can insert their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users and vendors can update their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users and vendors can delete their own invoices" ON invoices;

-- Create new policies for vendors only

-- Allow vendors to view their own invoices
CREATE POLICY "Vendors can view their own invoices"
  ON invoices FOR SELECT
  USING (auth.uid() = user_id);

-- Allow vendors to insert their own invoices
CREATE POLICY "Vendors can insert their own invoices"
  ON invoices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow vendors to update their own invoices
CREATE POLICY "Vendors can update their own invoices"
  ON invoices FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow vendors to delete their own invoices
CREATE POLICY "Vendors can delete their own invoices"
  ON invoices FOR DELETE
  USING (auth.uid() = user_id);

-- Admin can view ALL invoices (already exists in most setups, but ensuring it's here)
DROP POLICY IF EXISTS "Admins can view all invoices" ON invoices;
CREATE POLICY "Admins can view all invoices"
  ON invoices FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Admin can update ALL invoices
DROP POLICY IF EXISTS "Admins can update all invoices" ON invoices;
CREATE POLICY "Admins can update all invoices"
  ON invoices FOR UPDATE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Admin can delete ALL invoices
DROP POLICY IF EXISTS "Admins can delete all invoices" ON invoices;
CREATE POLICY "Admins can delete all invoices"
  ON invoices FOR DELETE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Step 3: Create a helper function to check if user is vendor
CREATE OR REPLACE FUNCTION is_vendor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT role FROM profiles WHERE id = auth.uid()) = 'vendor';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create a helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_vendor() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Step 5: Add vendor_company_name field to profiles (optional but useful)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vendor_type TEXT; -- e.g., 'supplier', 'contractor', 'service provider'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;

-- Step 6: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Step 7: Update the vendor_invoice_summary view to include vendor info
DROP VIEW IF EXISTS vendor_invoice_summary;
CREATE VIEW vendor_invoice_summary AS
SELECT 
    i.user_id,
    p.email as vendor_email,
    p.full_name as vendor_full_name,
    p.company_name as vendor_company,
    i.vendor_name,
    COUNT(*) as invoice_count,
    SUM(i.amount) as total_amount,
    COUNT(*) FILTER (WHERE i.status = 'paid') as paid_count,
    SUM(i.amount) FILTER (WHERE i.status = 'paid') as paid_amount,
    COUNT(*) FILTER (WHERE i.status = 'submitted') as submitted_count,
    COUNT(*) FILTER (WHERE i.status = 'approved') as approved_count,
    COUNT(*) FILTER (WHERE i.status = 'rejected') as rejected_count
FROM invoices i
LEFT JOIN profiles p ON i.user_id = p.id
GROUP BY i.user_id, p.email, p.full_name, p.company_name, i.vendor_name;

-- Grant access to the view
GRANT SELECT ON vendor_invoice_summary TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Role migration completed successfully!';
  RAISE NOTICE 'System now has only 2 roles:';
  RAISE NOTICE '  VENDOR - Upload, create, and manage their own invoices';
  RAISE NOTICE '  ADMIN - View and manage all invoices from all vendors';
  RAISE NOTICE '';
  RAISE NOTICE 'All existing users have been converted to vendors.';
END $$;

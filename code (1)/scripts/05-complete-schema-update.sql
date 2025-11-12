-- Complete Smart Invoice Assistant Schema Update
-- Run this in Supabase SQL Editor

-- 1. Ensure invoices table has all required fields
ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS invoice_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS paid_on TIMESTAMP WITH TIME ZONE;

-- Update check constraint for status
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check 
  CHECK (status IN ('paid', 'unpaid', 'pending', 'overdue', 'disputed'));

-- 2. Create Supabase Storage bucket for invoices (run this after in Supabase Dashboard → Storage)
-- Bucket name: invoices
-- Public: false (admin/user access only)

-- 3. Create function to check if user is admin (for RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 4. Update RLS policies for invoices to allow admin full access
DROP POLICY IF EXISTS "Users can view own invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can view all invoices" ON invoices;
DROP POLICY IF EXISTS "Users can create own invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can manage all invoices" ON invoices;

-- Users can view their own invoices OR admin can view all
CREATE POLICY "Users can view own invoices or admin sees all" ON invoices
  FOR SELECT 
  USING (user_id = auth.uid() OR is_admin());

-- Only admins can insert invoices
CREATE POLICY "Admins can insert invoices" ON invoices
  FOR INSERT 
  WITH CHECK (is_admin());

-- Users can update their own invoices (pay status), admins can update all
CREATE POLICY "Users can update own invoices or admin all" ON invoices
  FOR UPDATE 
  USING (user_id = auth.uid() OR is_admin());

-- Only admins can delete
CREATE POLICY "Admins can delete invoices" ON invoices
  FOR DELETE 
  USING (is_admin());

-- 5. Update profiles policies to allow admin to see all users
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT 
  USING (id = auth.uid() OR is_admin());

-- 6. Enable Realtime for invoices table
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_user_status ON invoices(user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date_status ON invoices(due_date, status);

-- 8. Create a view for analytics
CREATE OR REPLACE VIEW invoice_analytics AS
SELECT 
  COUNT(*) as total_invoices,
  COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
  COUNT(*) FILTER (WHERE status = 'unpaid') as unpaid_count,
  SUM(amount) as total_amount,
  SUM(amount) FILTER (WHERE status = 'paid') as paid_amount,
  SUM(amount) FILTER (WHERE status = 'unpaid') as unpaid_amount,
  user_id
FROM invoices
GROUP BY user_id;

-- Grant access to the view
GRANT SELECT ON invoice_analytics TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Database schema updated successfully!';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Go to Supabase Storage and create bucket "invoices"';
  RAISE NOTICE '2. Set bucket policy to allow authenticated users';
  RAISE NOTICE '3. Deploy your updated frontend code';
END $$;

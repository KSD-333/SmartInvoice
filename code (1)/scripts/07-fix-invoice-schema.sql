-- Fix invoice schema and policies for user uploads
-- Run this in Supabase SQL Editor

-- 1. Add invoice_date column if it doesn't exist
ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS invoice_date DATE DEFAULT CURRENT_DATE;

-- 2. Update status check constraint to allow all valid statuses
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check 
  CHECK (status IN ('paid', 'unpaid', 'pending', 'overdue', 'disputed'));

-- 3. Update RLS policies to allow users to insert their own invoices
DROP POLICY IF EXISTS "Admins can insert invoices" ON invoices;
DROP POLICY IF EXISTS "Users can insert own invoices" ON invoices;

-- Users can insert their own invoices, admins can insert any
CREATE POLICY "Users can insert own invoices" ON invoices
  FOR INSERT 
  WITH CHECK (user_id = auth.uid() OR is_admin());

-- 4. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- 5. Verify the setup
DO $$
DECLARE
  column_exists BOOLEAN;
  policy_exists BOOLEAN;
BEGIN
  -- Check invoice_date column
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'invoices' 
    AND column_name = 'invoice_date'
  ) INTO column_exists;
  
  -- Check insert policy
  SELECT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE tablename = 'invoices' 
    AND policyname = 'Users can insert own invoices'
  ) INTO policy_exists;
  
  IF column_exists THEN
    RAISE NOTICE '✅ invoice_date column exists';
  ELSE
    RAISE NOTICE '❌ invoice_date column missing';
  END IF;
  
  IF policy_exists THEN
    RAISE NOTICE '✅ User insert policy exists';
  ELSE
    RAISE NOTICE '❌ User insert policy missing';
  END IF;
END $$;

-- Success
SELECT '✅ Schema fixed! Users can now upload invoices.' as status;

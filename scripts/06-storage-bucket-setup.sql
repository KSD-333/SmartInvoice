-- Create Storage Bucket and Policies for Invoices
-- Run this ENTIRE script in Supabase SQL Editor: 
-- https://supabase.com/dashboard/project/hvkbxoathivlosxstfsu/sql

-- STEP 1: Create the invoices bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices', 
  false, -- Private bucket
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- STEP 2: Drop any existing policies
DROP POLICY IF EXISTS "Users can upload own invoices" ON storage.objects;
DROP POLICY IF EXISTS "Users view own or admin all" ON storage.objects;
DROP POLICY IF EXISTS "Users update own or admin all" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own or admin all" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload invoices" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own invoices or admin all" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to invoices" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to view own files or admin all" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update own files or admin all" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete own files or admin all" ON storage.objects;

-- STEP 3: Create new policies
-- Allow authenticated users to upload to invoices bucket
CREATE POLICY "Allow authenticated uploads to invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoices');

-- Allow users to view their own files OR admin to view all
CREATE POLICY "Allow users to view own files or admin all"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoices' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
);

-- Allow users to update their own files OR admin to update all  
CREATE POLICY "Allow users to update own files or admin all"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'invoices' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
);

-- Allow users to delete their own files OR admin to delete all
CREATE POLICY "Allow users to delete own files or admin all"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoices' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
);

-- STEP 4: Verify
SELECT 
  'Storage bucket "invoices" is ready!' as message,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'objects' 
  AND policyname LIKE '%invoices%';

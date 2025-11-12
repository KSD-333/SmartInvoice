-- Fixed RLS infinite recursion by using user_id only (no role checks in policies)
-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('user', 'admin');

-- Create profiles table with role
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role user_role DEFAULT 'user',
  full_name TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  amount DECIMAL(10, 2),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Simplified RLS policies: Remove role-based checks to prevent recursion
-- RLS Policy: Users can only see their own profile
CREATE POLICY "users_view_own_profile" ON profiles FOR SELECT USING (auth.uid() = id);

-- RLS Policy: Allow profile updates only by the user themselves or admins (admin-only enforcement in app code)
CREATE POLICY "users_update_own_profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- RLS Policy: Users can only see their own invoices
CREATE POLICY "users_view_own_invoices" ON invoices FOR SELECT USING (
  auth.uid() = user_id
);

-- RLS Policy: Allow inserts for any authenticated user (admin verification in app code)
CREATE POLICY "authenticated_insert_invoices" ON invoices FOR INSERT WITH CHECK (
  auth.uid() = admin_id
);

-- RLS Policy: Allow updates for any authenticated user (admin verification in app code)
CREATE POLICY "authenticated_update_invoices" ON invoices FOR UPDATE USING (
  auth.uid() = admin_id
) WITH CHECK (
  auth.uid() = admin_id
);

-- Create indexes
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_admin_id ON invoices(admin_id);
CREATE INDEX idx_profiles_email ON profiles(email);

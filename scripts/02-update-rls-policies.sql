-- Updated RLS policies to properly separate admin and user data

-- Drop existing policies
DROP POLICY IF EXISTS "Users can only access their own invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can access all invoices" ON invoices;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Invoices RLS Policies
CREATE POLICY "Users can only access their own invoices" ON invoices
  FOR SELECT USING (auth.uid() = user_id OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can insert invoices for users" ON invoices
  FOR INSERT WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users cannot access admin invoices" ON invoices
  FOR SELECT USING (
    CASE 
      WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN true
      ELSE auth.uid() = user_id
    END
  );

-- Profiles RLS Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by owner" ON profiles
  FOR SELECT USING (auth.uid() = id OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Chat Messages RLS Policies
DROP POLICY IF EXISTS "Users can read own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON chat_messages;

CREATE POLICY "Users can only access their own chat messages" ON chat_messages
  FOR SELECT USING (auth.uid() = user_id OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users can insert their own chat messages" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

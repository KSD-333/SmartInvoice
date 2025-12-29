-- ============================================
-- CLEAN ADMIN SETUP - Run This Entire Script
-- ============================================

-- STEP 1: Check current admin accounts
SELECT 'Current Admin Accounts:' as info;
SELECT id, email, role, full_name, created_at 
FROM profiles 
WHERE role = 'admin';

-- STEP 2: Promote existing user to admin
-- Replace with YOUR actual email below:
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'ketandhainje533@gmail.com';

-- STEP 3: Verify in auth.users that email is confirmed
SELECT 
    'Auth User Status:' as info,
    email,
    email_confirmed_at,
    confirmed_at,
    last_sign_in_at
FROM auth.users 
WHERE email = 'ketandhainje533@gmail.com';

-- STEP 4: Force confirm email if not confirmed
UPDATE auth.users 
SET 
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    confirmed_at = COALESCE(confirmed_at, NOW())
WHERE email = 'ketandhainje533@gmail.com';

-- STEP 5: Verify profile is properly linked
SELECT 
    'Profile Check:' as info,
    p.id as profile_id,
    p.email as profile_email,
    p.role,
    p.full_name,
    au.id as auth_id,
    au.email as auth_email
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE p.email = 'ketandhainje533@gmail.com';

-- STEP 6: Final verification
SELECT 'Setup Complete! Admin details:' as info;
SELECT id, email, role, full_name 
FROM profiles 
WHERE email = 'ketandhainje533@gmail.com';

-- ============================================
-- NOW RESET PASSWORD IN SUPABASE DASHBOARD:
-- 1. Go to Authentication → Users
-- 2. Find: ketandhainje533@gmail.com
-- 3. Click "..." → "Update user"
-- 4. Set password to: Admin@123456
-- 5. Click Save
-- 
-- THEN LOGIN WITH:
-- Email: ketandhainje533@gmail.com
-- Password: Admin@123456
-- ============================================

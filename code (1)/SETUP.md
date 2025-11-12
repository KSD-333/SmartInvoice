# 🚀 Quick Setup Guide

## ✅ What I Fixed:
1. ✅ Fixed `package.json` - removed placeholder dependencies
2. ✅ Fixed imports in `invoice-list.tsx`
3. ✅ Created `.env.local` for Supabase credentials
4. ✅ Created `.npmrc` to fix Windows symlink issues
5. ✅ Fixed profile creation API to use correct table name
6. ✅ Added auto-profile creation in dashboard
7. ✅ Created complete SQL setup script

---

## 📋 Steps to Complete Setup:

### 1️⃣ Run SQL Script in Supabase

1. Go to: https://supabase.com/dashboard/project/_/sql
2. Copy the contents of `scripts/00-setup-complete.sql`
3. Paste into the SQL Editor
4. Click **"Run"**
5. You should see: ✅ Database setup complete!

### 2️⃣ Make Yourself Admin

1. Go to: https://supabase.com/dashboard/project/_/editor
2. Click on the **"profiles"** table
3. Find your user row (by email)
4. Click on the **"role"** cell
5. Change it from `user` to `admin` (lowercase!)
6. Save the change

### 3️⃣ Refresh Your Dashboard

1. Go back to your app: http://localhost:3000
2. Press `Ctrl + Shift + R` (hard refresh)
3. You should now see the **"Admin Panel"** button! 🎉

---

## 🔧 Your Current Configuration:

**Environment File:** `.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=https://hvkbxoathivlosxstfsu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<already-set>
SUPABASE_SERVICE_ROLE_KEY=<add-this-from-supabase>
```

⚠️ **IMPORTANT:** You need to add your `SUPABASE_SERVICE_ROLE_KEY`
- Go to: https://supabase.com/dashboard/project/hvkbxoathivlosxstfsu/settings/api
- Copy the **"service_role"** key (not the anon key!)
- Add it to `.env.local`
- **NEVER commit this to git!** It's like a master password

**Dev Server:** Running at http://localhost:3000

---

## 🐛 Troubleshooting:

### If you still don't see "Admin Panel" button:

1. Open browser console (F12)
2. Look for the log: `Profile data: {role: 'admin'}`
3. If it shows `role: 'user'`, go back to Supabase and verify the role is set to `admin`
4. Clear browser cache and cookies
5. Sign out and sign in again

### If profile is null:

The dashboard will now auto-create a profile for you. Just refresh the page!

---

## 📊 Database Tables Created:

- ✅ `profiles` - User accounts with roles
- ✅ `invoices` - Invoice data
- ✅ `payments` - Payment records
- ✅ `audit_logs` - Activity logs
- ✅ `chat_messages` - AI chat history

---

## 🎯 Next Steps:

Once you're logged in as admin:
1. Go to Admin Panel
2. You can manage user roles
3. Upload invoices
4. Use AI chat for invoice queries

---

## 💡 Need Help?

Check the browser console (F12) for any errors or logs!

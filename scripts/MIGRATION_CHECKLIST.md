# B2B Platform Migration Checklist

## ⚠️ CRITICAL: Pre-Migration Steps

### 1. Backup Your Database
**REQUIRED before proceeding!**

```bash
# Option 1: Full database backup
pg_dump -h your_host -U your_user -d your_database > backup_full_$(date +%Y%m%d_%H%M%S).sql

# Option 2: Specific tables only
pg_dump -h your_host -U your_user -d your_database \
  -t profiles \
  -t invoices \
  -t vendor_company_relationships \
  -t audit_logs \
  -t companies \
  > backup_tables_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Review Current Schema State

Run these queries to understand your current state:

```sql
-- Check current profiles.role values
SELECT role, COUNT(*) FROM profiles GROUP BY role;

-- Check current invoices.status values
SELECT status, COUNT(*) FROM invoices GROUP BY status;

-- Check audit_logs column names
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'audit_logs' 
ORDER BY ordinal_position;

-- Check vendor_company_relationships structure
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'vendor_company_relationships' 
ORDER BY ordinal_position;
```

### 3. Document Current Policies

```sql
-- Export current policies for reference
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

## 📋 Migration Execution Plan

### Phase 1: Non-Breaking Changes (Safe)
**Can be run during low-traffic periods**

- ✅ Section 1: Audit logs column reconciliation
- ✅ Section 3: Companies table enhancements
- ✅ Section 4: Vendor-company relationships enhancements
- ✅ Section 6: New tables creation
- ✅ Section 7: Notifications enhancements

**Risk Level:** LOW
- No data loss
- No breaking changes
- Additive only

### Phase 2: Schema Alterations (Review Required)
**Requires validation and testing**

- ⚠️ Section 2: Profiles role migration
  - **ACTION REQUIRED:** Review existing role values first
  - Updates 'admin' → 'platform_admin'
  - Updates 'user' → 'vendor'
  - Adds CHECK constraint

- ⚠️ Section 5: Invoices bidirectional support
  - **ACTION REQUIRED:** Review existing status values
  - Expands status CHECK constraint
  - Adds many new columns

**Risk Level:** MEDIUM
- Modifies CHECK constraints
- Updates existing data
- No data loss if rolled back properly

### Phase 3: Functions & Triggers (Critical)
**Test thoroughly before production**

- ⚠️ Section 8: Functions & Triggers
  - **CRITICAL:** Updates log_invoice_status_change to use new audit_logs columns
  - Adds invoice total calculation trigger

**Risk Level:** MEDIUM-HIGH
- Changes trigger behavior
- Must run AFTER Section 1 (audit_logs fix)

### Phase 4: RLS Policies (Add Only)
**No existing policies removed**

- ✅ Section 9: New table policies
  - Only adds policies for NEW tables
  - Does NOT modify existing policies

**Risk Level:** LOW
- Additive only for new tables

---

## 🔍 Section-by-Section Review

### Section 1: Audit Logs (CRITICAL FIX)
**Purpose:** Fix column name mismatch causing function failures

**Changes:**
- Rename `user_id` → `performed_by`
- Rename `resource_type` → `entity_type`
- Rename `resource_id` → `entity_id`
- Add `action`, `changes`, `ip_address`, `user_agent` columns

**Impact:** 
- ✅ Fixes log_invoice_status_change function
- ✅ Preserves all existing audit data
- ✅ No data loss

**Validation:**
```sql
-- After running, verify columns renamed
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'audit_logs';
-- Should see: performed_by, entity_type, entity_id
```

**Rollback:** Provided in script

---

### Section 2: Profiles Role Migration
**Purpose:** Extend role enum to support 4-tier hierarchy

**Changes:**
- Drop CHECK constraint
- Update 'admin' → 'platform_admin'
- Update 'user'/'NULL' → 'vendor'
- Expand VARCHAR(20) → VARCHAR(50)
- Add new CHECK with 4 roles
- Add company_id, department, job_title, is_active, last_login

**Pre-Flight Check:**
```sql
-- RUN THIS FIRST to see what will be updated
SELECT role, COUNT(*) FROM profiles GROUP BY role;
-- If you see unexpected roles, STOP and review!
```

**Impact:**
- ⚠️ Changes existing role values
- ✅ Preserves all user data
- ⚠️ May break existing code expecting 'admin' role

**Validation:**
```sql
-- After running, verify no invalid roles
SELECT role, COUNT(*) FROM profiles GROUP BY role;
-- Should only see: vendor, company_manager, company_admin, platform_admin
```

**Rollback:** Provided in script

---

### Section 3: Companies Enhancement
**Purpose:** Add enterprise fields

**Changes:** Adds columns only (registration_number, tax_id, industry, etc.)

**Impact:** ✅ Safe - additive only

**Rollback:** Provided in script

---

### Section 4: Vendor-Company Relationships
**Purpose:** Support bidirectional invoice flow

**Changes:**
- **PRESERVES EXISTING DATA**
- Adds direction, requested_by, approved_by, notes, payment_terms, etc.

**Impact:** 
- ✅ Safe - no data loss
- ✅ Existing relationships preserved
- ✅ Additive only

**Validation:**
```sql
-- Verify existing relationships still intact
SELECT COUNT(*) FROM vendor_company_relationships;
-- Should match count before migration
```

**Rollback:** Provided in script

---

### Section 5: Invoices Bidirectional Support
**Purpose:** Support company→vendor invoices (returns, penalties)

**Changes:**
- Adds 15+ new columns for workflow
- **Expands status CHECK constraint**
- Adds invoice_direction, invoice_type, payment_status

**Pre-Flight Check:**
```sql
-- RUN THIS FIRST to see current status values
SELECT DISTINCT status FROM invoices;
-- Ensure all values will be valid in new CHECK constraint!
```

**Impact:**
- ⚠️ Modifies status CHECK constraint
- ⚠️ May fail if invoices have unexpected status values
- ✅ No data loss

**Validation:**
```sql
-- After running, check no status violations
SELECT status, COUNT(*) FROM invoices GROUP BY status;
```

**Rollback:** Provided in script (but CHECK constraint rollback needs manual adjustment)

---

### Section 6: New Tables Creation
**Purpose:** Add approval, dispute, assignment, and invoice type tables

**Changes:** Creates 4 new tables with seed data

**Impact:** ✅ Safe - only creates if not exists

**Validation:**
```sql
-- Verify tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('invoice_types', 'invoice_approvals', 'invoice_disputes', 'invoice_assignments');
```

**Rollback:** Provided in script

---

### Section 7: Notifications Enhancement
**Purpose:** Add priority and action tracking

**Changes:** Adds priority, action_url, action_label, sent_via columns

**Impact:** ✅ Safe - additive only

**Rollback:** Provided in script

---

### Section 8: Functions & Triggers (DEPENDS ON SECTION 1)
**Purpose:** Fix function to use new audit_logs columns

**Changes:**
- Updates log_invoice_status_change to use `performed_by`, `entity_type`, `entity_id`
- Adds calculate_invoice_total trigger

**Impact:**
- ✅ Fixes broken audit logging
- ⚠️ MUST run AFTER Section 1
- ⚠️ Changes trigger behavior

**Validation:**
```sql
-- Test trigger by updating an invoice status
UPDATE invoices SET status = status WHERE id = (SELECT id FROM invoices LIMIT 1);

-- Check audit log created with correct columns
SELECT entity_type, entity_id, performed_by, changes 
FROM audit_logs 
ORDER BY created_at DESC 
LIMIT 5;
```

**Rollback:** Drop and recreate old function version

---

### Section 9: RLS Policies for New Tables
**Purpose:** Secure new tables

**Changes:** Adds policies ONLY to new tables (invoice_types, approvals, disputes, assignments, audit_logs)

**Impact:** 
- ✅ Safe - does not touch existing policies
- ✅ Only affects new tables

**Rollback:** Drop policies if needed

---

## 🚀 Recommended Execution Order

### Option A: All-at-Once (Staging Environment)
```bash
# Run entire script
psql -h your_host -U your_user -d your_database -f scripts/16-safe-migration-patch.sql
```

### Option B: Incremental (Production - RECOMMENDED)
```sql
-- Step 1: Run Section 1 (audit_logs fix) - CRITICAL
-- Copy Section 1 from script and run

-- Step 2: Verify audit_logs columns renamed
SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_logs';

-- Step 3: Run Section 8 (functions) - DEPENDS ON SECTION 1
-- Copy Section 8 from script and run

-- Step 4: Test audit logging works
UPDATE invoices SET status = status WHERE id = (SELECT id FROM invoices LIMIT 1);
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 1;

-- Step 5: Run Sections 3, 4, 6, 7 (safe additive changes)
-- Copy and run each section

-- Step 6: Review and run Section 2 (profiles role migration)
-- FIRST: Check existing roles
SELECT role, COUNT(*) FROM profiles GROUP BY role;
-- THEN: Run Section 2 if safe

-- Step 7: Review and run Section 5 (invoices enhancement)
-- FIRST: Check existing status values
SELECT DISTINCT status FROM invoices;
-- THEN: Run Section 5 if safe

-- Step 8: Run Section 9 (RLS policies for new tables)
-- Copy Section 9 from script and run
```

---

## ✅ Post-Migration Verification

### 1. Data Integrity Checks
```sql
-- Verify row counts unchanged
SELECT 'profiles' as table, COUNT(*) FROM profiles
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'vendor_company_relationships', COUNT(*) FROM vendor_company_relationships
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs;

-- Compare with pre-migration counts
```

### 2. Schema Validation
```sql
-- Check all new columns exist
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'invoices', 'companies', 'vendor_company_relationships', 'audit_logs')
AND column_name IN ('company_id', 'invoice_direction', 'performed_by', 'direction', 'priority')
ORDER BY table_name, column_name;
```

### 3. Function Testing
```sql
-- Test invoice status change logging
BEGIN;
UPDATE invoices SET status = 'approved' WHERE id = (SELECT id FROM invoices LIMIT 1);
SELECT * FROM audit_logs WHERE entity_type = 'invoice' ORDER BY created_at DESC LIMIT 1;
ROLLBACK;
```

### 4. Policy Testing
```sql
-- Test as vendor role
SET ROLE your_vendor_user;
SELECT COUNT(*) FROM invoices; -- Should see only their invoices
SELECT COUNT(*) FROM invoice_types; -- Should see all
RESET ROLE;
```

---

## 🔄 Rollback Procedures

### Emergency Rollback (Nuclear Option)
```bash
# Restore from backup
psql -h your_host -U your_user -d your_database < backup_full_YYYYMMDD_HHMMSS.sql
```

### Selective Rollback (Per Section)
Each section has rollback SQL commented at the end. Copy and execute the appropriate rollback block.

Example:
```sql
-- To rollback Section 1 (audit_logs)
ALTER TABLE audit_logs RENAME COLUMN performed_by TO user_id;
ALTER TABLE audit_logs RENAME COLUMN entity_type TO resource_type;
ALTER TABLE audit_logs RENAME COLUMN entity_id TO resource_id;
-- etc.
```

---

## 📊 Expected Changes Summary

| Table | Added Columns | Modified Constraints | Data Changes |
|-------|--------------|---------------------|--------------|
| **audit_logs** | 4 new | Renamed 3 columns | ✅ Preserved |
| **profiles** | 5 new | New role CHECK | ⚠️ Role values updated |
| **companies** | 8 new | Status CHECK | ✅ No data changes |
| **vendor_company_relationships** | 9 new | Direction CHECK | ✅ Preserved |
| **invoices** | 15 new | Status CHECK expanded | ✅ Preserved |
| **notifications** | 4 new | Priority CHECK | ✅ No data changes |
| **invoice_types** | New table | N/A | Seeded with 10 types |
| **invoice_approvals** | New table | N/A | Empty |
| **invoice_disputes** | New table | N/A | Empty |
| **invoice_assignments** | New table | N/A | Empty |

---

## ⏱️ Estimated Timeline

- **Backup:** 5-15 minutes (depends on database size)
- **Review queries:** 10 minutes
- **Section 1 (critical):** 2 minutes
- **Section 8 (functions):** 2 minutes
- **Sections 3,4,6,7 (safe):** 5 minutes
- **Section 2 (profiles):** 3 minutes (+ review time)
- **Section 5 (invoices):** 3 minutes (+ review time)
- **Section 9 (policies):** 2 minutes
- **Verification:** 10 minutes

**Total:** 45-60 minutes (including review time)

---

## 🆘 Troubleshooting

### Issue: "CHECK constraint violation"
**Cause:** Existing data doesn't match new CHECK constraint

**Solution:**
```sql
-- Find violating rows
SELECT * FROM profiles WHERE role NOT IN ('vendor', 'company_manager', 'company_admin', 'platform_admin');

-- Or for invoices:
SELECT DISTINCT status FROM invoices;

-- Update or adjust CHECK constraint to include existing values
```

### Issue: "Column already exists"
**Cause:** Partial migration already run

**Solution:** Script uses `ADD COLUMN IF NOT EXISTS` - safe to re-run

### Issue: "Function auth.uid() does not exist"
**Cause:** Running outside Supabase context

**Solution:** Replace `auth.uid()` with `current_user` or session variable

### Issue: Trigger not firing
**Cause:** Function created before column rename

**Solution:**
```sql
-- Drop and recreate function after Section 1
DROP FUNCTION IF EXISTS log_invoice_status_change() CASCADE;
-- Then run Section 8 again
```

---

## 📞 Support Checklist

Before asking for help, have ready:
- [ ] Backup confirmation (timestamp, file size)
- [ ] Pre-migration query results (roles, statuses)
- [ ] Exact error message with context
- [ ] Section number where error occurred
- [ ] PostgreSQL version (`SELECT version();`)
- [ ] Supabase or self-hosted?

---

## ✨ Success Criteria

Migration is successful when:
- ✅ All pre-migration row counts match post-migration
- ✅ No constraint violations reported
- ✅ Audit logging works (test trigger)
- ✅ All new tables created
- ✅ RLS policies allow expected access
- ✅ Frontend can create invoices with company selection
- ✅ No errors in application logs

---

## 📝 Notes

- This script is **non-destructive** by design
- The old 15-full-b2b-platform-schema.sql should NOT be used
- Run in a transaction if your PostgreSQL version supports DDL transactions:
  ```sql
  BEGIN;
  -- Run sections here
  -- Test thoroughly
  COMMIT; -- or ROLLBACK if issues found
  ```
- Consider running on a staging/dev environment first
- Schedule migration during low-traffic period

---

**Generated:** 2025-11-15  
**For:** B2B Supply Chain Invoice Exchange Platform  
**Safe Migration Script:** 16-safe-migration-patch.sql

-- ============================================
-- SAFE MIGRATION PATCH SCRIPT
-- Non-Destructive Schema Upgrade for B2B Platform
-- ============================================
-- 
-- IMPORTANT: This script is designed to be run incrementally.
-- Review each section before executing. Rollback SQL provided.
-- 
-- BACKUP FIRST: Run the backup queries at the bottom before proceeding!
-- ============================================

-- ============================================
-- SECTION 1: AUDIT_LOGS COLUMN RECONCILIATION
-- ============================================
-- Current: user_id, resource_type, resource_id
-- Target: performed_by, entity_type, entity_id
-- Strategy: Rename existing columns to match function expectations

-- Step 1.1: Rename audit_logs columns (preserves existing data)
DO $$ 
BEGIN
    -- Check if old column names exist before renaming
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'audit_logs' AND column_name = 'user_id') THEN
        ALTER TABLE audit_logs RENAME COLUMN user_id TO performed_by;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'audit_logs' AND column_name = 'resource_type') THEN
        ALTER TABLE audit_logs RENAME COLUMN resource_type TO entity_type;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'audit_logs' AND column_name = 'resource_id') THEN
        ALTER TABLE audit_logs RENAME COLUMN resource_id TO entity_id;
    END IF;
END $$;

-- Step 1.2: Add missing audit_logs columns if they don't exist
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS action VARCHAR(50),
ADD COLUMN IF NOT EXISTS changes JSONB,
ADD COLUMN IF NOT EXISTS ip_address INET,
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Create indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

COMMENT ON TABLE audit_logs IS 'Enterprise audit logging - tracks all system actions';

-- ROLLBACK for Section 1:
-- ALTER TABLE audit_logs RENAME COLUMN performed_by TO user_id;
-- ALTER TABLE audit_logs RENAME COLUMN entity_type TO resource_type;
-- ALTER TABLE audit_logs RENAME COLUMN entity_id TO resource_id;
-- ALTER TABLE audit_logs DROP COLUMN IF EXISTS action;
-- ALTER TABLE audit_logs DROP COLUMN IF EXISTS changes;
-- ALTER TABLE audit_logs DROP COLUMN IF EXISTS ip_address;
-- ALTER TABLE audit_logs DROP COLUMN IF EXISTS user_agent;

-- ============================================
-- SECTION 2: PROFILES TABLE - EXTEND ROLE ENUM
-- ============================================
-- Current: CHECK (role IN ('admin', 'vendor')) with default 'user'
-- Target: Support 'vendor', 'company_manager', 'company_admin', 'platform_admin'
-- Strategy: Drop CHECK, update existing data, add new CHECK

-- Step 2.1: Drop existing CHECK constraint on profiles.role
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Step 2.2: Update any existing 'admin' roles to 'platform_admin' for clarity
UPDATE profiles SET role = 'platform_admin' WHERE role = 'admin';

-- Step 2.3: Update any existing 'user' roles to 'vendor' (based on your default)
UPDATE profiles SET role = 'vendor' WHERE role = 'user' OR role IS NULL;

-- Step 2.4: Alter column to support longer role names
ALTER TABLE profiles ALTER COLUMN role TYPE VARCHAR(50);

-- Step 2.5: Add new CHECK constraint with expanded roles
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('vendor', 'company_manager', 'company_admin', 'platform_admin'));

-- Step 2.6: Set proper default
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'vendor';

-- Step 2.7: Add new profile columns for company relationships
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS department VARCHAR(100),
ADD COLUMN IF NOT EXISTS job_title VARCHAR(100),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Create indexes for company lookups
CREATE INDEX IF NOT EXISTS idx_profiles_company ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

COMMENT ON COLUMN profiles.role IS 'vendor: supplier, company_manager: invoice handler, company_admin: company owner, platform_admin: system owner';
COMMENT ON COLUMN profiles.company_id IS 'For managers/admins - which company they belong to. NULL for vendors and platform admin';

-- ROLLBACK for Section 2:
-- ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- UPDATE profiles SET role = 'admin' WHERE role = 'platform_admin';
-- ALTER TABLE profiles ALTER COLUMN role TYPE VARCHAR(20);
-- ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'vendor'));
-- ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'user';
-- ALTER TABLE profiles DROP COLUMN IF EXISTS company_id;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS department;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS job_title;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS is_active;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS last_login;

-- ============================================
-- SECTION 3: COMPANIES TABLE - ADD FIELDS
-- ============================================

ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS tax_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS industry VARCHAR(100),
ADD COLUMN IF NOT EXISTS company_size VARCHAR(50),
ADD COLUMN IF NOT EXISTS website VARCHAR(255),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;

-- Add CHECK constraint for company status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_status_check') THEN
        ALTER TABLE companies ADD CONSTRAINT companies_status_check 
        CHECK (status IN ('active', 'suspended', 'pending'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);

-- ROLLBACK for Section 3:
-- ALTER TABLE companies DROP COLUMN IF EXISTS registration_number;
-- ALTER TABLE companies DROP COLUMN IF EXISTS tax_id;
-- ALTER TABLE companies DROP COLUMN IF EXISTS industry;
-- ALTER TABLE companies DROP COLUMN IF EXISTS company_size;
-- ALTER TABLE companies DROP COLUMN IF EXISTS website;
-- ALTER TABLE companies DROP COLUMN IF EXISTS status;
-- ALTER TABLE companies DROP COLUMN IF EXISTS subscription_plan;
-- ALTER TABLE companies DROP COLUMN IF EXISTS subscription_expires_at;

-- ============================================
-- SECTION 4: VENDOR_COMPANY_RELATIONSHIPS - ENHANCE
-- ============================================
-- PRESERVE EXISTING DATA - Only add missing columns

ALTER TABLE vendor_company_relationships
ADD COLUMN IF NOT EXISTS direction VARCHAR(20) DEFAULT 'both',
ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS vendor_category VARCHAR(100),
ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100),
ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(15,2);

-- Add CHECK constraint for direction
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vcr_direction_check') THEN
        ALTER TABLE vendor_company_relationships ADD CONSTRAINT vcr_direction_check
        CHECK (direction IN ('vendor_to_company', 'company_to_vendor', 'both'));
    END IF;
END $$;

-- Create additional indexes
CREATE INDEX IF NOT EXISTS idx_vcr_vendor ON vendor_company_relationships(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vcr_company ON vendor_company_relationships(company_id);
CREATE INDEX IF NOT EXISTS idx_vcr_status ON vendor_company_relationships(status);
CREATE INDEX IF NOT EXISTS idx_vcr_direction ON vendor_company_relationships(direction);

COMMENT ON TABLE vendor_company_relationships IS 'Bidirectional relationships between vendors and companies for invoice exchange';
COMMENT ON COLUMN vendor_company_relationships.direction IS 'vendor_to_company: vendor invoices company | company_to_vendor: company invoices vendor | both: bidirectional';

-- ROLLBACK for Section 4:
-- ALTER TABLE vendor_company_relationships DROP COLUMN IF EXISTS direction;
-- ALTER TABLE vendor_company_relationships DROP COLUMN IF EXISTS requested_by;
-- ALTER TABLE vendor_company_relationships DROP COLUMN IF EXISTS approved_by;
-- ALTER TABLE vendor_company_relationships DROP COLUMN IF EXISTS approved_at;
-- ALTER TABLE vendor_company_relationships DROP COLUMN IF EXISTS blocked_reason;
-- ALTER TABLE vendor_company_relationships DROP COLUMN IF EXISTS notes;
-- ALTER TABLE vendor_company_relationships DROP COLUMN IF EXISTS vendor_category;
-- ALTER TABLE vendor_company_relationships DROP COLUMN IF EXISTS payment_terms;
-- ALTER TABLE vendor_company_relationships DROP COLUMN IF EXISTS credit_limit;

-- ============================================
-- SECTION 5: INVOICES TABLE - BIDIRECTIONAL SUPPORT
-- ============================================

-- Step 5.1: Add new columns for bidirectional invoices
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS invoice_direction VARCHAR(20) DEFAULT 'vendor_to_company',
ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(50) DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS po_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS items JSONB,
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);

-- Step 5.2: Add CHECK constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_direction_check') THEN
        ALTER TABLE invoices ADD CONSTRAINT invoices_direction_check
        CHECK (invoice_direction IN ('vendor_to_company', 'company_to_vendor'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_payment_status_check') THEN
        ALTER TABLE invoices ADD CONSTRAINT invoices_payment_status_check
        CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'overdue'));
    END IF;
END $$;

-- Step 5.3: Update status CHECK constraint (preserve existing values first!)
-- First, check what status values currently exist
DO $$
DECLARE
    old_statuses TEXT[];
BEGIN
    -- Get unique status values
    SELECT array_agg(DISTINCT status) INTO old_statuses FROM invoices;
    
    -- Drop old CHECK constraint
    ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
    
    -- Add new CHECK constraint with expanded statuses
    ALTER TABLE invoices ADD CONSTRAINT invoices_status_check 
    CHECK (status IN (
        'draft', 'submitted', 'under_review', 'correction_requested', 
        'approved', 'rejected', 'paid', 'overdue', 'cancelled', 'disputed',
        -- Legacy statuses (add your existing ones here if different)
        'pending', 'processing', 'completed'
    ));
END $$;

-- Step 5.4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_direction ON invoices(invoice_direction);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_invoices_assigned_to ON invoices(assigned_to);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_po_number ON invoices(po_number);

COMMENT ON COLUMN invoices.invoice_direction IS 'vendor_to_company: normal supplier invoice | company_to_vendor: return/penalty/debit note';
COMMENT ON COLUMN invoices.invoice_type IS 'standard, return, penalty, debit_note, credit_note, service_charge, repair, etc.';

-- ROLLBACK for Section 5:
-- ALTER TABLE invoices DROP COLUMN IF EXISTS invoice_direction;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS invoice_type;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS created_by;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS assigned_to;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS reviewed_by;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS approved_by;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS po_number;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS items;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS tax_amount;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS discount_amount;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS total_amount;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS payment_status;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS payment_date;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS payment_method;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS payment_reference;
-- ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
-- -- Add back old CHECK constraint with original values

-- ============================================
-- SECTION 6: NEW TABLES (Safe - only create if not exists)
-- ============================================

-- Invoice Types Reference Table
CREATE TABLE IF NOT EXISTS invoice_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('vendor_to_company', 'company_to_vendor', 'both')),
    description TEXT,
    requires_approval BOOLEAN DEFAULT true,
    auto_approve_threshold DECIMAL(15,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert standard invoice types (use ON CONFLICT to avoid duplicates)
INSERT INTO invoice_types (code, name, direction, description) VALUES
('STANDARD', 'Standard Invoice', 'vendor_to_company', 'Regular supplier invoice for goods/services'),
('RETURN', 'Purchase Return', 'company_to_vendor', 'Invoice for returned goods'),
('PENALTY', 'Penalty Invoice', 'company_to_vendor', 'Late delivery or quality penalties'),
('DEBIT_NOTE', 'Debit Note', 'company_to_vendor', 'Additional charges to vendor'),
('CREDIT_NOTE', 'Credit Note', 'both', 'Credit adjustment'),
('SERVICE_CHARGE', 'Service Charge', 'company_to_vendor', 'Service fees charged to vendor'),
('DAMAGE', 'Damage Charge', 'company_to_vendor', 'Charges for damaged goods'),
('TRANSPORT', 'Transportation Cost', 'both', 'Shipping and logistics costs'),
('REPAIR', 'Repair Service', 'company_to_vendor', 'Equipment repair charges'),
('ADVANCE', 'Advance Payment', 'vendor_to_company', 'Advance payment invoice')
ON CONFLICT (code) DO NOTHING;

-- Invoice Approvals Table
CREATE TABLE IF NOT EXISTS invoice_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL REFERENCES profiles(id),
    approver_role VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('approved', 'rejected', 'requested_correction', 'disputed', 'accepted')),
    comments TEXT,
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_approvals_invoice ON invoice_approvals(invoice_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver ON invoice_approvals(approver_id);

-- Invoice Disputes Table
CREATE TABLE IF NOT EXISTS invoice_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    raised_by UUID NOT NULL REFERENCES profiles(id),
    dispute_type VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'closed')),
    resolved_by UUID REFERENCES profiles(id),
    resolution TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_disputes_invoice ON invoice_disputes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON invoice_disputes(status);

-- Invoice Assignments Table
CREATE TABLE IF NOT EXISTS invoice_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    assigned_to UUID NOT NULL REFERENCES profiles(id),
    assigned_by UUID NOT NULL REFERENCES profiles(id),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    due_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'reassigned')),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assignments_invoice ON invoice_assignments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_to ON invoice_assignments(assigned_to);

-- ROLLBACK for Section 6:
-- DROP TABLE IF EXISTS invoice_types CASCADE;
-- DROP TABLE IF EXISTS invoice_approvals CASCADE;
-- DROP TABLE IF EXISTS invoice_disputes CASCADE;
-- DROP TABLE IF EXISTS invoice_assignments CASCADE;

-- ============================================
-- SECTION 7: NOTIFICATIONS TABLE - ENHANCE
-- ============================================

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS action_url TEXT,
ADD COLUMN IF NOT EXISTS action_label VARCHAR(100),
ADD COLUMN IF NOT EXISTS sent_via JSONB;

-- Add CHECK constraint for priority
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_priority_check') THEN
        ALTER TABLE notifications ADD CONSTRAINT notifications_priority_check
        CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
    END IF;
END $$;

-- ROLLBACK for Section 7:
-- ALTER TABLE notifications DROP COLUMN IF EXISTS priority;
-- ALTER TABLE notifications DROP COLUMN IF EXISTS action_url;
-- ALTER TABLE notifications DROP COLUMN IF EXISTS action_label;
-- ALTER TABLE notifications DROP COLUMN IF EXISTS sent_via;

-- ============================================
-- SECTION 8: FUNCTIONS & TRIGGERS
-- ============================================

-- Function to auto-calculate invoice total
CREATE OR REPLACE FUNCTION calculate_invoice_total()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.items IS NOT NULL THEN
        NEW.total_amount := COALESCE(NEW.amount, 0) + COALESCE(NEW.tax_amount, 0) - COALESCE(NEW.discount_amount, 0);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_invoice_total ON invoices;
CREATE TRIGGER trigger_calculate_invoice_total
    BEFORE INSERT OR UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION calculate_invoice_total();

-- Function to log invoice status changes (FIXED to use correct column names)
CREATE OR REPLACE FUNCTION log_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO audit_logs (entity_type, entity_id, action, performed_by, changes)
        VALUES (
            'invoice',
            NEW.id,
            'status_changed',
            COALESCE(auth.uid(), NEW.created_by, NEW.user_id),
            jsonb_build_object(
                'old_status', OLD.status,
                'new_status', NEW.status
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_invoice_status_change ON invoices;
CREATE TRIGGER trigger_log_invoice_status_change
    AFTER UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION log_invoice_status_change();

-- ============================================
-- SECTION 9: RLS POLICIES (Add new tables only)
-- ============================================
-- NOTE: This section DOES NOT drop existing policies.
-- It only enables RLS and creates policies for NEW tables.

-- Enable RLS on new tables
ALTER TABLE invoice_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_assignments ENABLE ROW LEVEL SECURITY;

-- Invoice Types Policies
DROP POLICY IF EXISTS "Invoice types viewable by all authenticated" ON invoice_types;
CREATE POLICY "Invoice types viewable by all authenticated"
    ON invoice_types FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Only platform admin can manage invoice types" ON invoice_types;
CREATE POLICY "Only platform admin can manage invoice types"
    ON invoice_types FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'platform_admin'
        )
    );

-- Invoice Approvals Policies
DROP POLICY IF EXISTS "Users can view relevant approvals" ON invoice_approvals;
CREATE POLICY "Users can view relevant approvals"
    ON invoice_approvals FOR SELECT
    TO authenticated
    USING (
        approver_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM invoices
            WHERE invoices.id = invoice_approvals.invoice_id
            AND (invoices.user_id = auth.uid() OR invoices.created_by = auth.uid())
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('company_admin', 'company_manager', 'platform_admin')
        )
    );

DROP POLICY IF EXISTS "Users can create approvals" ON invoice_approvals;
CREATE POLICY "Users can create approvals"
    ON invoice_approvals FOR INSERT
    TO authenticated
    WITH CHECK (
        approver_id = auth.uid()
    );

-- Invoice Disputes Policies
DROP POLICY IF EXISTS "Users can view relevant disputes" ON invoice_disputes;
CREATE POLICY "Users can view relevant disputes"
    ON invoice_disputes FOR SELECT
    TO authenticated
    USING (
        raised_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM invoices
            WHERE invoices.id = invoice_disputes.invoice_id
            AND (invoices.user_id = auth.uid() OR invoices.created_by = auth.uid())
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('company_admin', 'company_manager', 'platform_admin')
        )
    );

DROP POLICY IF EXISTS "Users can create disputes" ON invoice_disputes;
CREATE POLICY "Users can create disputes"
    ON invoice_disputes FOR INSERT
    TO authenticated
    WITH CHECK (
        raised_by = auth.uid()
    );

-- Invoice Assignments Policies
DROP POLICY IF EXISTS "Users can view their assignments" ON invoice_assignments;
CREATE POLICY "Users can view their assignments"
    ON invoice_assignments FOR SELECT
    TO authenticated
    USING (
        assigned_to = auth.uid()
        OR assigned_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('company_admin', 'company_manager', 'platform_admin')
        )
    );

DROP POLICY IF EXISTS "Managers can create assignments" ON invoice_assignments;
CREATE POLICY "Managers can create assignments"
    ON invoice_assignments FOR INSERT
    TO authenticated
    WITH CHECK (
        assigned_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('company_admin', 'company_manager', 'platform_admin')
        )
    );

-- Audit Logs Policy (only platform/company admins can view)
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
CREATE POLICY "Admins can view audit logs"
    ON audit_logs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('company_admin', 'platform_admin')
        )
    );

DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
CREATE POLICY "System can insert audit logs"
    ON audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

COMMENT ON SCHEMA public IS 'Full B2B Supply Chain Invoice Exchange Platform - Safe Migration Applied';

-- ============================================
-- BACKUP QUERIES (Run BEFORE executing this script!)
-- ============================================
/*
-- Export existing data to CSV or pg_dump
COPY (SELECT * FROM profiles) TO '/tmp/backup_profiles.csv' CSV HEADER;
COPY (SELECT * FROM invoices) TO '/tmp/backup_invoices.csv' CSV HEADER;
COPY (SELECT * FROM vendor_company_relationships) TO '/tmp/backup_vcr.csv' CSV HEADER;
COPY (SELECT * FROM audit_logs) TO '/tmp/backup_audit_logs.csv' CSV HEADER;
COPY (SELECT * FROM companies) TO '/tmp/backup_companies.csv' CSV HEADER;

-- Or use pg_dump
pg_dump -h your_host -U your_user -d your_database -t profiles -t invoices -t vendor_company_relationships -t audit_logs -t companies > backup_pre_migration.sql
*/

-- ============================================
-- VERIFICATION QUERIES (Run AFTER migration)
-- ============================================
/*
-- Check profiles role distribution
SELECT role, COUNT(*) FROM profiles GROUP BY role;

-- Check invoices status distribution
SELECT status, COUNT(*) FROM invoices GROUP BY status;

-- Check vendor_company_relationships
SELECT direction, status, COUNT(*) FROM vendor_company_relationships GROUP BY direction, status;

-- Check new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('invoice_types', 'invoice_approvals', 'invoice_disputes', 'invoice_assignments')
ORDER BY table_name;

-- Verify audit_logs column names
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'audit_logs' 
ORDER BY ordinal_position;
*/

-- ============================================
-- FULL B2B SUPPLY CHAIN INVOICE EXCHANGE PLATFORM
-- Enterprise-Grade Schema (Like SAP Ariba / Oracle Supplier Portal)
-- ============================================

-- ============================================
-- 1. ROLES & PERMISSIONS HIERARCHY
-- ============================================

-- First, get list of all tables that might have policies referencing role column
DO $$ 
DECLARE
    r RECORD;
    table_name TEXT;
BEGIN
    -- Disable RLS on all user tables
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE 'pg_%'
    ) LOOP
        BEGIN
            EXECUTE 'ALTER TABLE ' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY';
        EXCEPTION WHEN OTHERS THEN
            -- Table might not exist, continue
            NULL;
        END;
    END LOOP;
    
    -- Drop ALL policies from ALL tables in public schema
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        BEGIN
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || quote_ident(r.tablename);
        EXCEPTION WHEN OTHERS THEN
            -- Policy might not exist, continue
            NULL;
        END;
    END LOOP;
END $$;
-- Now we can safely alter the role column
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ALTER COLUMN role TYPE VARCHAR(50);

-- Update profiles table with new role structure
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS department VARCHAR(100),
ADD COLUMN IF NOT EXISTS job_title VARCHAR(100),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Add index for company lookups
CREATE INDEX IF NOT EXISTS idx_profiles_company ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

COMMENT ON COLUMN profiles.role IS 'vendor: supplier, company_manager: invoice handler, company_admin: company owner, platform_admin: system owner';
COMMENT ON COLUMN profiles.company_id IS 'For managers/admins - which company they belong to. NULL for vendors and platform admin';

-- ============================================
-- 2. COMPANIES TABLE (Enhanced)
-- ============================================

ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS tax_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS industry VARCHAR(100),
ADD COLUMN IF NOT EXISTS company_size VARCHAR(50),
ADD COLUMN IF NOT EXISTS website VARCHAR(255),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);

-- ============================================
-- 3. VENDOR-COMPANY RELATIONSHIPS (Bidirectional)
-- ============================================

-- Drop old table if exists and recreate with bidirectional support
DROP TABLE IF EXISTS vendor_company_relationships CASCADE;

CREATE TABLE vendor_company_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Relationship direction
    direction VARCHAR(20) DEFAULT 'both' CHECK (direction IN ('vendor_to_company', 'company_to_vendor', 'both')),
    
    -- Status management
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'blocked', 'suspended')),
    
    -- Approval tracking
    requested_by UUID REFERENCES profiles(id),
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    blocked_reason TEXT,
    
    -- Notes and metadata
    notes TEXT,
    vendor_category VARCHAR(100), -- e.g., 'Raw Materials', 'Services', 'Equipment'
    payment_terms VARCHAR(100), -- e.g., 'Net 30', 'Net 60'
    credit_limit DECIMAL(15,2),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(vendor_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_vcr_vendor ON vendor_company_relationships(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vcr_company ON vendor_company_relationships(company_id);
CREATE INDEX IF NOT EXISTS idx_vcr_status ON vendor_company_relationships(status);
CREATE INDEX IF NOT EXISTS idx_vcr_direction ON vendor_company_relationships(direction);

COMMENT ON TABLE vendor_company_relationships IS 'Bidirectional relationships between vendors and companies for invoice exchange';
COMMENT ON COLUMN vendor_company_relationships.direction IS 'vendor_to_company: vendor invoices company | company_to_vendor: company invoices vendor | both: bidirectional';

-- ============================================
-- 4. INVOICES TABLE (Enhanced for Bidirectional Flow)
-- ============================================

-- Add new columns for bidirectional invoices
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS invoice_direction VARCHAR(20) DEFAULT 'vendor_to_company' CHECK (invoice_direction IN ('vendor_to_company', 'company_to_vendor')),
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
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'overdue')),
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);

-- Update status to support more workflow states
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check 
CHECK (status IN ('draft', 'submitted', 'under_review', 'correction_requested', 'approved', 'rejected', 'paid', 'overdue', 'cancelled', 'disputed'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_direction ON invoices(invoice_direction);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_invoices_assigned_to ON invoices(assigned_to);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_po_number ON invoices(po_number);

COMMENT ON COLUMN invoices.invoice_direction IS 'vendor_to_company: normal supplier invoice | company_to_vendor: return/penalty/debit note';
COMMENT ON COLUMN invoices.invoice_type IS 'standard, return, penalty, debit_note, credit_note, service_charge, repair, etc.';

-- ============================================
-- 5. INVOICE TYPES (Reference Table)
-- ============================================

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

-- Insert standard invoice types
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

-- ============================================
-- 6. INVOICE WORKFLOW & APPROVALS
-- ============================================

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

-- ============================================
-- 7. INVOICE DISPUTES
-- ============================================

CREATE TABLE IF NOT EXISTS invoice_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    raised_by UUID NOT NULL REFERENCES profiles(id),
    dispute_type VARCHAR(50) NOT NULL, -- 'amount', 'items', 'quality', 'quantity', 'other'
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'closed')),
    resolved_by UUID REFERENCES profiles(id),
    resolution TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_disputes_invoice ON invoice_disputes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON invoice_disputes(status);

-- ============================================
-- 8. INVOICE ASSIGNMENTS (Manager Teams)
-- ============================================

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

-- ============================================
-- 9. AUDIT LOGS (Enterprise Feature)
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL, -- 'invoice', 'company', 'vendor', 'user'
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted', 'approved', 'rejected'
    performed_by UUID NOT NULL REFERENCES profiles(id),
    changes JSONB, -- Store before/after values
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ============================================
-- 10. NOTIFICATION SYSTEM (Enhanced)
-- ============================================

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
ADD COLUMN IF NOT EXISTS action_url TEXT,
ADD COLUMN IF NOT EXISTS action_label VARCHAR(100),
ADD COLUMN IF NOT EXISTS sent_via JSONB; -- Track email, SMS, push sent status

-- ============================================
-- 11. RLS POLICIES (Security)
-- ============================================

-- Enable RLS on new tables
ALTER TABLE invoice_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Invoice Types: Everyone can read, only platform admin can modify
CREATE POLICY "Invoice types viewable by all authenticated"
    ON invoice_types FOR SELECT
    TO authenticated
    USING (true);

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

-- Invoice Approvals: Users can view their own approvals
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

-- Invoice Disputes: Involved parties can view
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

-- Audit Logs: Only admins can view
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

-- ============================================
-- 12. FUNCTIONS & TRIGGERS
-- ============================================

-- Function to auto-calculate invoice total
CREATE OR REPLACE FUNCTION calculate_invoice_total()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.items IS NOT NULL THEN
        NEW.total_amount := NEW.amount + COALESCE(NEW.tax_amount, 0) - COALESCE(NEW.discount_amount, 0);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_invoice_total
    BEFORE INSERT OR UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION calculate_invoice_total();

-- Function to log invoice status changes
CREATE OR REPLACE FUNCTION log_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO audit_logs (entity_type, entity_id, action, performed_by, changes)
        VALUES (
            'invoice',
            NEW.id,
            'status_changed',
            auth.uid(),
            jsonb_build_object(
                'old_status', OLD.status,
                'new_status', NEW.status
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_invoice_status_change
    AFTER UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION log_invoice_status_change();

-- ============================================
-- 13. SAMPLE DATA (For Testing)
-- ============================================

-- Update existing companies with enhanced fields
UPDATE companies SET
    industry = 'Technology',
    company_size = 'Large',
    status = 'active'
WHERE name = 'TechCorp Industries';

-- ============================================
-- 14. RECREATE ESSENTIAL RLS POLICIES
-- ============================================

-- Re-enable RLS on core tables
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Invoices policies
CREATE POLICY "Vendors can view their own invoices"
    ON invoices FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR created_by = auth.uid()
    );

CREATE POLICY "Vendors can insert their own invoices"
    ON invoices FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        OR created_by = auth.uid()
    );

CREATE POLICY "Vendors can update their own invoices"
    ON invoices FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR created_by = auth.uid()
    );

CREATE POLICY "Company staff can view their company invoices"
    ON invoices FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('company_manager', 'company_admin')
            AND profiles.company_id = invoices.company_id
        )
    );

CREATE POLICY "Managers can update their company invoices"
    ON invoices FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('company_manager', 'company_admin')
            AND profiles.company_id = invoices.company_id
        )
    );

CREATE POLICY "Managers can create invoices to vendors"
    ON invoices FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('company_manager', 'company_admin')
        )
        AND invoice_direction = 'company_to_vendor'
    );

CREATE POLICY "Platform admins can view all invoices"
    ON invoices FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'platform_admin'
        )
    );

CREATE POLICY "Platform admins can update all invoices"
    ON invoices FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'platform_admin'
        )
    );

-- Profiles policies
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Company admins can view their company profiles"
    ON profiles FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role = 'company_admin'
            AND p.company_id = profiles.company_id
        )
    );

CREATE POLICY "Platform admins can view all profiles"
    ON profiles FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'platform_admin'
        )
    );

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
    ON notifications FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Invoice Comments policies
CREATE POLICY "Users can view comments on their invoices"
    ON invoice_comments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM invoices
            WHERE invoices.id = invoice_comments.invoice_id
            AND (invoices.user_id = auth.uid() OR invoices.created_by = auth.uid())
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('company_manager', 'company_admin', 'platform_admin')
        )
    );

CREATE POLICY "Users can create comments on accessible invoices"
    ON invoice_comments FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
    );

-- Invoice Status History policies
CREATE POLICY "Users can view status history of their invoices"
    ON invoice_status_history FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM invoices
            WHERE invoices.id = invoice_status_history.invoice_id
            AND (invoices.user_id = auth.uid() OR invoices.created_by = auth.uid())
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('company_manager', 'company_admin', 'platform_admin')
        )
    );

CREATE POLICY "System can insert status history"
    ON invoice_status_history FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Companies policies
CREATE POLICY "Companies are viewable by authenticated users"
    ON companies FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Company admins can update their own company"
    ON companies FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'company_admin'
            AND profiles.company_id = companies.id
        )
    );

CREATE POLICY "Platform admins can manage all companies"
    ON companies FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'platform_admin'
        )
    );

-- Vendor-Company Relationships policies
CREATE POLICY "Vendors can view their relationships"
    ON vendor_company_relationships FOR SELECT
    TO authenticated
    USING (
        vendor_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('company_manager', 'company_admin')
            AND profiles.company_id = vendor_company_relationships.company_id
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'platform_admin'
        )
    );

CREATE POLICY "Vendors can request relationships"
    ON vendor_company_relationships FOR INSERT
    TO authenticated
    WITH CHECK (
        vendor_id = auth.uid()
        AND status = 'pending'
    );

CREATE POLICY "Company admins can manage relationships"
    ON vendor_company_relationships FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'company_admin'
            AND profiles.company_id = vendor_company_relationships.company_id
        )
    );

COMMENT ON SCHEMA public IS 'Full B2B Supply Chain Invoice Exchange Platform - Enterprise Grade';

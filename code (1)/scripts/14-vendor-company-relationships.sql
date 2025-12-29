-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create vendor_company_relationships table
CREATE TABLE IF NOT EXISTS vendor_company_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'blocked')),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vendor_id, company_id)
);

-- Add company_id to invoices table
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_company_vendor ON vendor_company_relationships(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_company_company ON vendor_company_relationships(company_id);
CREATE INDEX IF NOT EXISTS idx_vendor_company_status ON vendor_company_relationships(status);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

-- Enable RLS on new tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_company_relationships ENABLE ROW LEVEL SECURITY;

-- RLS Policies for companies table
CREATE POLICY "Companies are viewable by everyone authenticated"
    ON companies FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can insert companies"
    ON companies FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can update companies"
    ON companies FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- RLS Policies for vendor_company_relationships
CREATE POLICY "Vendors can view their own company relationships"
    ON vendor_company_relationships FOR SELECT
    TO authenticated
    USING (
        vendor_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can insert vendor company relationships"
    ON vendor_company_relationships FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can update vendor company relationships"
    ON vendor_company_relationships FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Insert sample companies (optional - for testing)
INSERT INTO companies (name, description, contact_email, contact_phone, address) VALUES
    ('TechCorp Industries', 'Leading technology company', 'accounting@techcorp.com', '+1-555-0101', '123 Tech Street, Silicon Valley, CA 94025'),
    ('Global Manufacturing Ltd', 'Industrial manufacturing solutions', 'billing@globalmanuf.com', '+1-555-0202', '456 Industry Blvd, Detroit, MI 48201'),
    ('Retail Solutions Inc', 'Retail and distribution services', 'finance@retailsol.com', '+1-555-0303', '789 Commerce Ave, New York, NY 10001')
ON CONFLICT (name) DO NOTHING;

-- Create a trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendor_company_relationships_updated_at BEFORE UPDATE ON vendor_company_relationships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE companies IS 'Stores information about client companies that vendors supply to';
COMMENT ON TABLE vendor_company_relationships IS 'Manages relationships between vendors and companies they supply to';
COMMENT ON COLUMN vendor_company_relationships.status IS 'pending: awaiting approval, approved: can send invoices, blocked: cannot send invoices';

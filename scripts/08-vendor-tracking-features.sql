-- Add Vendor Tracking Features to Invoice System
-- Run this in Supabase SQL Editor

-- 1. Add comments column for rejection/clarification notes
ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS comments TEXT;

-- 2. Add status_history column to track status changes
ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;

-- 3. Update status constraint to include all required statuses
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check 
  CHECK (status IN ('submitted', 'approved', 'paid', 'rejected', 'unpaid', 'pending', 'overdue', 'disputed'));

-- 4. Add notification tracking
ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMP WITH TIME ZONE;

-- 5. Create function to log status changes
CREATE OR REPLACE FUNCTION log_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_history = COALESCE(NEW.status_history, '[]'::jsonb) || 
      jsonb_build_object(
        'from', OLD.status,
        'to', NEW.status,
        'changed_at', NOW(),
        'changed_by', auth.uid()
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create trigger for status change logging
DROP TRIGGER IF EXISTS invoice_status_change_trigger ON invoices;
CREATE TRIGGER invoice_status_change_trigger
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION log_invoice_status_change();

-- 7. Create function to send email notification (placeholder for integration)
CREATE OR REPLACE FUNCTION notify_payment_released()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark for notification if status changed to 'paid' and not yet sent
  IF NEW.status = 'paid' AND OLD.status != 'paid' AND NOT NEW.notification_sent THEN
    NEW.notification_sent = TRUE;
    NEW.notification_sent_at = NOW();
    -- Note: Actual email sending should be done by your backend service
    -- This just flags the invoice for notification
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create trigger for payment notifications
DROP TRIGGER IF EXISTS payment_notification_trigger ON invoices;
CREATE TRIGGER payment_notification_trigger
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION notify_payment_released();

-- 9. Create view for vendor invoice summary
CREATE OR REPLACE VIEW vendor_invoice_summary AS
SELECT 
  user_id,
  vendor_name,
  COUNT(*) as total_invoices,
  COUNT(*) FILTER (WHERE status = 'submitted') as submitted_count,
  COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
  COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
  SUM(amount) as total_amount,
  SUM(amount) FILTER (WHERE status = 'paid') as paid_amount,
  SUM(amount) FILTER (WHERE status IN ('submitted', 'approved')) as pending_amount
FROM invoices
GROUP BY user_id, vendor_name;

-- Grant access
GRANT SELECT ON vendor_invoice_summary TO authenticated;

-- 10. Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Success message
SELECT '✅ Vendor tracking features added successfully!' as status;

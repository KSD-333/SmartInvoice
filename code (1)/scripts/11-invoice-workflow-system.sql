-- =============================================
-- Invoice Workflow System
-- =============================================
-- This script adds:
-- 1. Updated invoice status (submitted/approved/paid/rejected)
-- 2. Comments table for invoice communication
-- 3. Notifications table for auto-notifications
-- 4. Proper constraints and indexes
-- =============================================

-- Step 1: Update invoice status constraint
ALTER TABLE invoices 
DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE invoices 
ADD CONSTRAINT invoices_status_check 
CHECK (status IN ('submitted', 'approved', 'paid', 'rejected', 'pending', 'unpaid', 'overdue'));

-- Update existing statuses to new workflow
UPDATE invoices SET status = 'submitted' WHERE status = 'pending';

-- Step 2: Create invoice_comments table
CREATE TABLE IF NOT EXISTS invoice_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast comment retrieval
CREATE INDEX IF NOT EXISTS idx_invoice_comments_invoice_id ON invoice_comments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_comments_created_at ON invoice_comments(created_at DESC);

-- Step 3: Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('payment_released', 'status_change', 'comment_added', 'invoice_created')),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast notification retrieval
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Step 4: RLS Policies for invoice_comments

-- Enable RLS
ALTER TABLE invoice_comments ENABLE ROW LEVEL SECURITY;

-- Admins can see all comments
CREATE POLICY "Admins can view all comments"
ON invoice_comments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Vendors can see comments on their own invoices
CREATE POLICY "Vendors can view their invoice comments"
ON invoice_comments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = invoice_comments.invoice_id
    AND invoices.user_id = auth.uid()
  )
);

-- Authenticated users can create comments
CREATE POLICY "Authenticated users can create comments"
ON invoice_comments FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

-- Users can update their own comments
CREATE POLICY "Users can update their own comments"
ON invoice_comments FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Step 5: RLS Policies for notifications

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- System can create notifications (admins)
CREATE POLICY "Admins can create notifications"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Step 6: Add invoice status history tracking
CREATE TABLE IF NOT EXISTS invoice_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES profiles(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_invoice_status_history_invoice_id ON invoice_status_history(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_status_history_changed_at ON invoice_status_history(changed_at DESC);

-- Enable RLS
ALTER TABLE invoice_status_history ENABLE ROW LEVEL SECURITY;

-- Admins can view all history
CREATE POLICY "Admins can view all status history"
ON invoice_status_history FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Vendors can view history of their invoices
CREATE POLICY "Vendors can view their invoice history"
ON invoice_status_history FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = invoice_status_history.invoice_id
    AND invoices.user_id = auth.uid()
  )
);

-- Admins can create history records
CREATE POLICY "Admins can create status history"
ON invoice_status_history FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Step 7: Function to auto-create notification on status change
CREATE OR REPLACE FUNCTION notify_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create notification if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Create notification for vendor
    INSERT INTO notifications (user_id, invoice_id, title, message, type)
    VALUES (
      NEW.user_id,
      NEW.id,
      'Invoice Status Updated',
      'Invoice #' || NEW.invoice_number || ' status changed from ' || COALESCE(OLD.status, 'none') || ' to ' || NEW.status,
      CASE 
        WHEN NEW.status = 'paid' THEN 'payment_released'
        ELSE 'status_change'
      END
    );
    
    -- Log status change in history
    INSERT INTO invoice_status_history (invoice_id, old_status, new_status, changed_by, note)
    VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      'Status automatically tracked'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for invoice status changes
DROP TRIGGER IF EXISTS invoice_status_change_trigger ON invoices;
CREATE TRIGGER invoice_status_change_trigger
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION notify_invoice_status_change();

-- Step 8: Function to notify on comment added
CREATE OR REPLACE FUNCTION notify_comment_added()
RETURNS TRIGGER AS $$
DECLARE
  invoice_owner_id UUID;
  commenter_email TEXT;
BEGIN
  -- Get the invoice owner
  SELECT user_id INTO invoice_owner_id
  FROM invoices
  WHERE id = NEW.invoice_id;
  
  -- Get commenter email
  SELECT email INTO commenter_email
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Notify invoice owner (if they're not the commenter)
  IF invoice_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, invoice_id, title, message, type)
    SELECT 
      invoice_owner_id,
      NEW.invoice_id,
      'New Comment on Invoice',
      commenter_email || ' added a comment on your invoice',
      'comment_added';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for comment notifications
DROP TRIGGER IF EXISTS comment_notification_trigger ON invoice_comments;
CREATE TRIGGER comment_notification_trigger
  AFTER INSERT ON invoice_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_comment_added();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Invoice workflow system installed successfully!';
  RAISE NOTICE '📊 Tables created: invoice_comments, notifications, invoice_status_history';
  RAISE NOTICE '🔔 Auto-notifications enabled for status changes and comments';
  RAISE NOTICE '📝 Invoice statuses: submitted → approved → paid (or rejected)';
END $$;

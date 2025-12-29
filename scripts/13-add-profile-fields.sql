-- Add additional profile fields for vendor details
-- Run this in Supabase SQL Editor

-- Add new columns to profiles table
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS mobile VARCHAR(20),
  ADD COLUMN IF NOT EXISTS gst_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS pincode VARCHAR(20),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_gst_number ON profiles(gst_number);
CREATE INDEX IF NOT EXISTS idx_profiles_mobile ON profiles(mobile);

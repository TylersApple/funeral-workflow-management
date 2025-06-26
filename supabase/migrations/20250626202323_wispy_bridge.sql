/*
  # Funeral Workflow Management System Database Schema

  1. New Tables
    - `fw_users` - User management with roles (admin, staff, viewer)
    - `fw_records` - Main funeral records with all required fields
    - `fw_documents` - Document management for each workflow stage
    - `fw_status_history` - Track status changes and workflow progression
    - `fw_email_logs` - Log automated email notifications
    - `fw_system_settings` - Store email templates and system configuration

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access control
    - Secure document access and user management

  3. Features
    - Automated record numbering with sequence
    - Status-based workflow with percentage tracking
    - Document requirements for specific workflow stages
    - Email automation tracking infrastructure
    - Comprehensive audit trail
*/

-- Create sequence first (before it's referenced)
CREATE SEQUENCE IF NOT EXISTS fw_record_seq START 1;

-- Create custom types
CREATE TYPE fw_record_status AS ENUM (
  'record_created',
  'funeral_arrangement', 
  'documents_sent_home_affairs',
  'quotation_accepted',
  'payment_made',
  'payment_arrangement',
  'payment_reminder_1',
  'payment_reminder_2', 
  'payment_reminder_final',
  'agreement_breached',
  'funeral_completed'
);

CREATE TYPE fw_user_role AS ENUM ('admin', 'staff', 'viewer');

-- Users table
CREATE TABLE IF NOT EXISTS fw_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role fw_user_role DEFAULT 'staff',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Main records table
CREATE TABLE IF NOT EXISTS fw_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_number text UNIQUE NOT NULL DEFAULT 'FW-' || to_char(now(), 'YYYY') || '-' || LPAD(nextval('fw_record_seq')::text, 4, '0'),
  
  -- Personal Information
  full_name text NOT NULL,
  address text,
  id_number text,
  
  -- Death Information
  time_of_death time,
  date_of_death date,
  
  -- Funeral Information
  funeral_location text,
  funeral_date date,
  
  -- Policy Information
  policy_1 text,
  policy_2 text,
  policy_3 text,
  policy_4 text,
  policy_5 text,
  amount_covered decimal(12,2),
  
  -- Payment Information
  paid decimal(12,2),
  receipt_number text,
  invoice_number text,
  
  -- Contact Information
  next_of_kin text,
  cell_number text,
  email_address text,
  
  -- Status and Workflow
  status fw_record_status DEFAULT 'record_created',
  progress_percentage integer DEFAULT 1,
  
  -- System Fields
  created_by uuid REFERENCES fw_users(id),
  assigned_to uuid REFERENCES fw_users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Email automation tracking
  last_email_sent timestamptz,
  next_email_due timestamptz
);

-- Documents table
CREATE TABLE IF NOT EXISTS fw_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid REFERENCES fw_records(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  document_type text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  status_when_uploaded fw_record_status NOT NULL,
  uploaded_by uuid REFERENCES fw_users(id),
  uploaded_at timestamptz DEFAULT now()
);

-- Status history table
CREATE TABLE IF NOT EXISTS fw_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid REFERENCES fw_records(id) ON DELETE CASCADE,
  old_status fw_record_status,
  new_status fw_record_status NOT NULL,
  old_percentage integer,
  new_percentage integer NOT NULL,
  changed_by uuid REFERENCES fw_users(id),
  notes text,
  changed_at timestamptz DEFAULT now()
);

-- Email logs table
CREATE TABLE IF NOT EXISTS fw_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid REFERENCES fw_records(id) ON DELETE CASCADE,
  email_type text NOT NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  status text DEFAULT 'sent',
  error_message text
);

-- System settings table
CREATE TABLE IF NOT EXISTS fw_system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES fw_users(id),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE fw_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fw_users
CREATE POLICY "Users can read own profile"
  ON fw_users
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text);

CREATE POLICY "Admins can read all users"
  ON fw_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fw_users 
      WHERE id::text = auth.uid()::text 
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update users"
  ON fw_users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fw_users 
      WHERE id::text = auth.uid()::text 
      AND role = 'admin'
    )
  );

-- RLS Policies for fw_records
CREATE POLICY "Staff can read all records"
  ON fw_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fw_users 
      WHERE id::text = auth.uid()::text 
      AND is_active = true
    )
  );

CREATE POLICY "Staff can insert records"
  ON fw_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM fw_users 
      WHERE id::text = auth.uid()::text 
      AND is_active = true
    )
  );

CREATE POLICY "Staff can update records"
  ON fw_records
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fw_users 
      WHERE id::text = auth.uid()::text 
      AND is_active = true
    )
  );

-- RLS Policies for fw_documents
CREATE POLICY "Staff can manage documents"
  ON fw_documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fw_users 
      WHERE id::text = auth.uid()::text 
      AND is_active = true
    )
  );

-- RLS Policies for fw_status_history
CREATE POLICY "Staff can read status history"
  ON fw_status_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fw_users 
      WHERE id::text = auth.uid()::text 
      AND is_active = true
    )
  );

CREATE POLICY "Staff can insert status history"
  ON fw_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM fw_users 
      WHERE id::text = auth.uid()::text 
      AND is_active = true
    )
  );

-- RLS Policies for fw_email_logs
CREATE POLICY "Staff can read email logs"
  ON fw_email_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fw_users 
      WHERE id::text = auth.uid()::text 
      AND is_active = true
    )
  );

CREATE POLICY "System can insert email logs"
  ON fw_email_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for fw_system_settings
CREATE POLICY "Admins can manage system settings"
  ON fw_system_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fw_users 
      WHERE id::text = auth.uid()::text 
      AND role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fw_records_status ON fw_records(status);
CREATE INDEX IF NOT EXISTS idx_fw_records_created_at ON fw_records(created_at);
CREATE INDEX IF NOT EXISTS idx_fw_records_assigned_to ON fw_records(assigned_to);
CREATE INDEX IF NOT EXISTS idx_fw_records_next_email_due ON fw_records(next_email_due);
CREATE INDEX IF NOT EXISTS idx_fw_documents_record_id ON fw_documents(record_id);
CREATE INDEX IF NOT EXISTS idx_fw_status_history_record_id ON fw_status_history(record_id);
CREATE INDEX IF NOT EXISTS idx_fw_email_logs_record_id ON fw_email_logs(record_id);

-- Create functions for automatic updates
CREATE OR REPLACE FUNCTION update_fw_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER fw_users_updated_at
  BEFORE UPDATE ON fw_users
  FOR EACH ROW
  EXECUTE FUNCTION update_fw_updated_at();

CREATE TRIGGER fw_records_updated_at
  BEFORE UPDATE ON fw_records
  FOR EACH ROW
  EXECUTE FUNCTION update_fw_updated_at();

-- Function to get status percentage
CREATE OR REPLACE FUNCTION get_status_percentage(status_input fw_record_status)
RETURNS integer AS $$
BEGIN
  CASE status_input
    WHEN 'record_created' THEN RETURN 1;
    WHEN 'funeral_arrangement' THEN RETURN 10;
    WHEN 'documents_sent_home_affairs' THEN RETURN 15;
    WHEN 'quotation_accepted' THEN RETURN 20;
    WHEN 'payment_made' THEN RETURN 30;
    WHEN 'payment_arrangement' THEN RETURN 40;
    WHEN 'payment_reminder_1' THEN RETURN 50;
    WHEN 'payment_reminder_2' THEN RETURN 60;
    WHEN 'payment_reminder_final' THEN RETURN 70;
    WHEN 'agreement_breached' THEN RETURN 70;
    WHEN 'funeral_completed' THEN RETURN 100;
    ELSE RETURN 1;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Insert initial system settings
INSERT INTO fw_system_settings (setting_key, setting_value, description) VALUES
('email_templates', '{
  "payment_reminder_1": {
    "subject": "Payment Reminder - Funeral Services",
    "body": "Dear {next_of_kin}, This is a reminder regarding the outstanding payment for funeral services for {full_name}. Please contact us to arrange payment."
  },
  "payment_reminder_2": {
    "subject": "Second Payment Reminder - Funeral Services", 
    "body": "Dear {next_of_kin}, This is your second reminder regarding the outstanding payment for funeral services for {full_name}. Please contact us immediately."
  },
  "payment_reminder_final": {
    "subject": "Final Payment Reminder - Funeral Services",
    "body": "Dear {next_of_kin}, This is your final reminder regarding the outstanding payment for funeral services for {full_name}. Immediate action is required."
  },
  "agreement_breached": {
    "subject": "Agreement Breach Notice - Funeral Services",
    "body": "Dear {next_of_kin}, Due to non-payment, the agreement for funeral services for {full_name} has been breached. Immediate action is required."
  }
}', 'Email templates for automated notifications'),
('reminder_intervals', '{"days": 7}', 'Number of days between payment reminders'),
('company_info', '{
  "name": "Richter Funerals",
  "email": "admin@richterfunerals.com",
  "phone": "+27 11 123 4567",
  "address": "123 Main Road, Johannesburg, South Africa"
}', 'Company information for emails and documents')
ON CONFLICT (setting_key) DO NOTHING;
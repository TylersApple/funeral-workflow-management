import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set up your Supabase connection.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface FuneralRecord {
  id: string;
  record_number: string;
  full_name: string;
  address?: string;
  id_number?: string;
  time_of_death?: string;
  date_of_death?: string;
  funeral_location?: string;
  funeral_date?: string;
  policy_1?: string;
  policy_2?: string;
  policy_3?: string;
  policy_4?: string;
  policy_5?: string;
  amount_covered?: number;
  paid?: number;
  receipt_number?: string;
  invoice_number?: string;
  next_of_kin?: string;
  cell_number?: string;
  email_address?: string;
  status: RecordStatus;
  progress_percentage: number;
  created_by?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  last_email_sent?: string;
  next_email_due?: string;
}

export interface FuneralUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'staff' | 'viewer';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentUpload {
  id: string;
  record_id: string;
  document_name: string;
  document_type: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  status_when_uploaded: RecordStatus;
  uploaded_by?: string;
  uploaded_at: string;
}

export type RecordStatus = 
  | 'record_created'
  | 'funeral_arrangement'
  | 'documents_sent_home_affairs'
  | 'quotation_accepted'
  | 'payment_made'
  | 'payment_arrangement'
  | 'payment_reminder_1'
  | 'payment_reminder_2'
  | 'payment_reminder_final'
  | 'agreement_breached'
  | 'funeral_completed';

export const STATUS_CONFIG: Record<RecordStatus, { label: string; percentage: number; color: string; requiresDocument?: boolean }> = {
  record_created: { label: 'Record Created', percentage: 1, color: 'bg-gray-500' },
  funeral_arrangement: { label: 'Funeral Arrangement', percentage: 10, color: 'bg-blue-500', requiresDocument: true },
  documents_sent_home_affairs: { label: 'Documents Sent to Home Affairs', percentage: 15, color: 'bg-indigo-500', requiresDocument: true },
  quotation_accepted: { label: 'Quotation Accepted', percentage: 20, color: 'bg-purple-500', requiresDocument: true },
  payment_made: { label: 'Payment Made', percentage: 30, color: 'bg-green-500', requiresDocument: true },
  payment_arrangement: { label: 'Payment Arrangement', percentage: 40, color: 'bg-yellow-500', requiresDocument: true },
  payment_reminder_1: { label: 'Payment Reminder 1', percentage: 50, color: 'bg-orange-500' },
  payment_reminder_2: { label: 'Payment Reminder 2', percentage: 60, color: 'bg-red-500' },
  payment_reminder_final: { label: 'Final Payment Reminder', percentage: 70, color: 'bg-red-600' },
  agreement_breached: { label: 'Agreement Breached', percentage: 70, color: 'bg-red-800' },
  funeral_completed: { label: 'Funeral Completed', percentage: 100, color: 'bg-green-600' }
};
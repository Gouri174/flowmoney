export interface Profile {
  id: string;
  name: string;
  currency: string;
  daily_alert_threshold: number;
  large_expense_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface ConnectedAccount {
  id: string;
  user_id: string;
  provider: string;
  account_name: string;
  account_type: string;
  masked_number: string | null;
  balance: number;
  currency: string;
  last_synced: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string | null;
  external_id: string | null;
  amount: number;
  currency: string;
  merchant: string;
  description: string;
  category_name: string;
  payment_method: string;
  date: string;
  is_debit: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category_name: string;
  amount: number;
  month: number;
  year: number;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

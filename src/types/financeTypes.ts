export type TxType = 'expense' | 'income' | 'transfer' | 'asset_purchase' | 'asset_sale' | 'liability_acq' | 'liability_dis';
export type Currency = 'EGP' | 'USD' | 'AED';
export type AccountType = 'payment' | 'credit_card' | 'asset' | 'wallet';

export interface DbFinanceAccount {
  id: string;
  user_id: string;
  name: string;
  bank: string;
  account_type: AccountType;
  currency: Currency;
  balance: number;
  credit_limit: number | null;
  last4: string | null;
  emoji: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface DbFinanceCategory {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  parent_id: string | null;
  tx_type: 'expense' | 'income' | 'both';
  sort_order: number;
  is_system: boolean;
  created_at: string;
}

export interface DbFinanceTransaction {
  id: string;
  user_id: string;
  account_id: string | null;
  to_account_id: string | null;
  category_id: string | null;
  amount: number;
  currency: Currency;
  tx_type: TxType;
  payee: string;
  date: string; // YYYY-MM-DD
  paid_at: string | null;
  note: string | null;
  tags: string[];
  attachments: string[];
  is_cleared: boolean;
  is_recurring: boolean;
  created_at: string;
}

export interface DbFinanceGoal {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  target_amount: number;
  current_amount: number;
  color: string;
  sub_label: string | null;
  is_active: boolean;
  created_at: string;
}

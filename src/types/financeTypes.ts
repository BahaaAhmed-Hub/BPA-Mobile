export type TxType = 'expense' | 'income' | 'transfer' | 'asset_purchase' | 'asset_sale' | 'liability_acq' | 'liability_dis';
export type Currency = 'EGP' | 'USD' | 'AED';
/** `loan` is money owed to a person or a lender: below zero while it is owed, never somewhere you spend from. */
export type AccountType = 'payment' | 'credit_card' | 'asset' | 'wallet' | 'loan';

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
  // Planning columns the web adds to a goal; absent on a database that has not run them.
  rank?: number | null;
  deadline?: string | null;
  currency?: string | null;
  monthly_commit?: number | null;
  created_at: string;
}

export interface DbFinanceBudget {
  id: string;
  user_id: string;
  category_id: string | null;
  month: string; // YYYY-MM
  planned_amount: number;
  currency: Currency;
  created_at: string;
}

export interface DbFinanceBill {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  currency: Currency;
  due_day: number;
  category_id: string | null;
  is_active: boolean;
  last_paid_date: string | null;
  created_at: string;
}

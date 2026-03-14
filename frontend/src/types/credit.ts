export interface CreditBalance {
  balance: number;
  total_consumed: number;
  total_purchased: number;
}

export type TransactionType = 'initial' | 'deduction' | 'refund' | 'purchase' | 'redeem' | 'admin_adjustment';

export interface CreditTransaction {
  id: string;
  amount: number;
  type: TransactionType;
  task_id: string | null;
  description: string;
  created_at: string;
}

export interface CreditTransactionHistory {
  items: CreditTransaction[];
  total: number;
  page: number;
  pages: number;
  has_next: boolean;
}

export interface PurchaseRequest {
  amount: number;
}

export interface RedeemRequest {
  code: string;
}

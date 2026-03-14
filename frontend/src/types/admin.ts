import type { User } from './user';

export interface AdminStats {
  total_users: number;
  total_tasks: number;
  tasks_by_status: Record<string, number>;
  total_credits_consumed: number;
}

export interface AdminUser extends User {
  total_files: number;
}

export interface AdjustCreditsRequest {
  amount: number;
  description?: string;
}

export interface AdjustCreditsResponse {
  user_id: string;
  new_balance: number;
}

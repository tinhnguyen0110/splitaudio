export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type StemType = 'vocals' | 'instrumental' | 'drums' | 'bass' | 'other';

export type ModelType = 'demucs' | 'demucs_ft' | 'bs_roformer' | 'melband_roformer';

export interface SeparateResponse {
  task_id: string;
  status: TaskStatus;
  credit_consumed: number;
  credits_remaining: number;
}

export interface TaskDetail {
  id: string;
  status: TaskStatus;
  model_used: string;
  credit_consumed: number;
  duration_seconds: number | null;
  original_filename: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  download_urls: Record<string, string> | null;
  error_log: string | null;
}

export interface TaskHistoryResponse {
  items: TaskDetail[];
  total: number;
  page: number;
  pages: number;
  has_next: boolean;
}

export interface TaskHistoryParams {
  page?: number;
  limit?: number;
  status?: TaskStatus;
  sort_by?: string;
  order?: 'asc' | 'desc';
}

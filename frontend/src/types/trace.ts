export interface RequestLog {
  id: string;
  request_id: string;
  user_id: string | null;
  method: string;
  path: string;
  query_params: string | null;
  status_code: number;
  duration_ms: number;
  client_ip: string;
  user_agent: string | null;
  error_detail: string | null;
  task_id: string | null;
  created_at: string;
}

export interface RequestLogList {
  items: RequestLog[];
  total: number;
  page: number;
  pages: number;
  has_next: boolean;
}

export interface RequestLogFilters {
  page?: number;
  limit?: number;
  method?: string;
  path_contains?: string;
  status_code_min?: number;
  status_code_max?: number;
  date_from?: string;
  date_to?: string;
  task_id?: string;
}

export interface TaskProcessStep {
  id: string;
  task_id: string;
  step_name: string;
  step_order: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  detail: string | null;
  source: string;
}

export interface TaskTrace {
  task_id: string;
  original_filename: string | null;
  model_used: string | null;
  task_status: string;
  created_at: string;
  steps: TaskProcessStep[];
  total_duration_ms: number | null;
}

export interface TaskTraceListItem {
  task_id: string;
  original_filename: string | null;
  model_used: string | null;
  task_status: string;
  created_at: string;
  steps_count: number;
  total_duration_ms: number | null;
}

export interface TaskTraceList {
  items: TaskTraceListItem[];
  total: number;
  page: number;
  pages: number;
  has_next: boolean;
}

export interface TaskTraceFilters {
  page?: number;
  limit?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
}

export interface TraceStats {
  total_requests_24h: number;
  error_count_24h: number;
  error_rate_24h: number;
  avg_latency_ms: number;
  p99_latency_ms: number;
  active_tasks: number;
  processing_tasks: number;
}

export interface WorkerLog {
  id: string;
  task_id: string;
  level: string;
  message: string;
  timestamp: string;
}

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { RequestLogList, RequestLogFilters, TaskTraceList, TaskTraceFilters, TaskTrace, TraceStats, WorkerLog } from '@/types/trace';

export function useRequestLogs(filters: RequestLogFilters = {}) {
  return useQuery({
    queryKey: ['admin', 'request-logs', filters],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (filters.page) params.page = filters.page;
      if (filters.limit) params.limit = filters.limit;
      if (filters.method) params.method = filters.method;
      if (filters.path_contains) params.path_contains = filters.path_contains;
      if (filters.status_code_min !== undefined) params.status_code_min = filters.status_code_min;
      if (filters.status_code_max !== undefined) params.status_code_max = filters.status_code_max;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.task_id) params.task_id = filters.task_id;

      const { data } = await apiClient.get<RequestLogList>('/admin/request-logs', { params });
      return data;
    },
  });
}

export function useTaskTraces(filters: TaskTraceFilters = {}) {
  return useQuery({
    queryKey: ['admin', 'task-traces', filters],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (filters.page) params.page = filters.page;
      if (filters.limit) params.limit = filters.limit;
      if (filters.status) params.status = filters.status;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;

      const { data } = await apiClient.get<TaskTraceList>('/admin/task-traces', { params });
      return data;
    },
  });
}

export function useTaskTrace(taskId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'task-trace', taskId],
    queryFn: async () => {
      const { data } = await apiClient.get<TaskTrace>(`/admin/task-traces/${taskId}`);
      return data;
    },
    enabled: !!taskId,
  });
}

export function useTraceStats() {
  return useQuery({
    queryKey: ['admin', 'trace-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<TraceStats>('/admin/trace-stats');
      return data;
    },
    refetchInterval: 30000,
  });
}

export function useWorkerLogs(taskId: string | undefined, level?: string) {
  return useQuery({
    queryKey: ['admin', 'worker-logs', taskId, level],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (level) params.level = level;
      const { data } = await apiClient.get<WorkerLog[]>(`/admin/task-traces/${taskId}/logs`, { params });
      return data;
    },
    enabled: !!taskId,
    refetchInterval: 5000,
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { TaskDetail, TaskHistoryResponse, TaskHistoryParams } from '@/types';
import { toast } from 'sonner';

export function useTaskStatus(taskId: string) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const { data } = await apiClient.get<TaskDetail>(`/status/${taskId}`);
      return data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'pending' || status === 'processing') {
        return 3000;
      }
      return false;
    },
  });
}

export function useTaskHistory(params: TaskHistoryParams) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: async () => {
      const { data } = await apiClient.get<TaskHistoryResponse>('/history', { params });
      return data;
    },
  });
}

export function useCancelTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/tasks/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      toast.success('Task cancelled');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to cancel task');
    },
  });
}

export function useRetryTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<TaskDetail>(`/tasks/${id}/retry`);
      return data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      toast.success('Task retried');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to retry task');
    },
  });
}

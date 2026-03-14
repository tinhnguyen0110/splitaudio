import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { AdminStats, AdminUser, AdjustCreditsResponse } from '@/types';
import { toast } from 'sonner';

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminStats>('/admin/stats');
      return data;
    },
  });
}

export function useAdminUsers(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ['admin', 'users', page, limit],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminUser[]>('/admin/users', {
        params: { page, limit },
      });
      // Backend returns a flat array; wrap into paginated shape for the UI
      return {
        items: data,
        total: data.length,
        page,
        pages: 1,
      };
    },
  });
}

export function useAdjustCredits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, amount, description }: { userId: string; amount: number; description?: string }) => {
      const { data } = await apiClient.put<AdjustCreditsResponse>(`/admin/users/${userId}/credits`, {
        amount,
        description,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('Credits adjusted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to adjust credits');
    },
  });
}

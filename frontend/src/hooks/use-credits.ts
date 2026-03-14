import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { CreditBalance, CreditTransactionHistory, PurchaseRequest, RedeemRequest } from '@/types';
import { toast } from 'sonner';

export function useBalance() {
  return useQuery({
    queryKey: ['credits', 'balance'],
    queryFn: async () => {
      const { data } = await apiClient.get<CreditBalance>('/credits/balance');
      return data;
    },
  });
}

export function useTransactions(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ['credits', 'transactions', page, limit],
    queryFn: async () => {
      const { data } = await apiClient.get<CreditTransactionHistory>('/credits/transactions', {
        params: { page, limit },
      });
      return data;
    },
  });
}

export function usePurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: PurchaseRequest) => {
      const { data } = await apiClient.post('/credits/purchase', request);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      toast.success('Credits purchased');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Purchase failed');
    },
  });
}

export function useRedeem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: RedeemRequest) => {
      const { data } = await apiClient.post('/credits/redeem', request);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      toast.success('Code redeemed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Redemption failed');
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { User, UserUpdate, ChangePasswordRequest } from '@/types';
import { toast } from 'sonner';

export function useCurrentUser() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);

  const query = useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get<User>('/users/me');
      return data;
    },
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (query.data) {
      setUser(query.data);
    }
  }, [query.data, setUser]);

  return query;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (update: UserUpdate) => {
      const { data } = await apiClient.put<User>('/users/me', update);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
      toast.success('Profile updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (request: ChangePasswordRequest) => {
      await apiClient.put('/auth/change-password', request);
    },
    onSuccess: () => {
      toast.success('Password changed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    },
  });
}

export function useDeleteAccount() {
  const logout = useAuthStore((s) => s.logout);

  return useMutation({
    mutationFn: async () => {
      await apiClient.delete('/users/me');
    },
    onSuccess: () => {
      logout();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete account');
    },
  });
}

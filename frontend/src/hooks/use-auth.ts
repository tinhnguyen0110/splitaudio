import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { TokenResponse, LoginRequest, RegisterRequest, User } from '@/types';
import { toast } from 'sonner';

export function useLogin() {
  const { setTokens, setUser } = useAuthStore();

  return useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const { data } = await apiClient.post<TokenResponse>('/auth/login', credentials);
      return data;
    },
    onSuccess: async (data) => {
      setTokens(data.access_token, data.refresh_token);
      try {
        const { data: user } = await apiClient.get<User>('/users/me');
        setUser(user);
      } catch {
        // token is set, user will be fetched on next load
      }
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail;
      const message = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: any) => d.msg || d).join(', ')
          : 'Login failed';
      toast.error(message);
    },
  });
}

export function useRegister() {
  const { setTokens, setUser } = useAuthStore();

  return useMutation({
    mutationFn: async (credentials: RegisterRequest) => {
      const { data } = await apiClient.post<TokenResponse>('/auth/register', credentials);
      return data;
    },
    onSuccess: async (data) => {
      setTokens(data.access_token, data.refresh_token);
      try {
        const { data: user } = await apiClient.get<User>('/users/me');
        setUser(user);
      } catch {
        // token is set, user will be fetched on next load
      }
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail;
      const message = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: any) => d.msg || d).join(', ')
          : 'Registration failed';
      toast.error(message);
    },
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);

  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout');
    },
    onSettled: () => {
      logout();
    },
  });
}

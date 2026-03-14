import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { SeparateResponse } from '@/types';
import { toast } from 'sonner';

export function useSeparateAudio() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ file, model, device }: { file: File; model: string; device?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      const params = new URLSearchParams({ model });
      if (device && device !== 'auto') params.append('device', device);
      const { data } = await apiClient.post<SeparateResponse>(
        `/separate?${params.toString()}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (e.total) setUploadProgress(Math.round((e.loaded * 100) / e.total));
          },
        }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      setUploadProgress(0);
    },
    onError: (error: any) => {
      setUploadProgress(0);
      toast.error(error.response?.data?.detail || 'Upload failed');
    },
  });

  return { ...mutation, uploadProgress };
}

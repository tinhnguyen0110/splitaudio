import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface EnhanceStep {
  step_id: string;
  params: Record<string, unknown>;
}

interface EnhanceParams {
  taskId: string;
  stemType: string;
  steps: EnhanceStep[];
}

export function useEnhanceStem() {
  return useMutation({
    mutationFn: async (params: EnhanceParams) => {
      const response = await apiClient.post(
        `/tasks/${params.taskId}/enhance`,
        { stem_type: params.stemType, steps: params.steps },
        { responseType: 'blob', timeout: 120000 },
      );
      return URL.createObjectURL(response.data);
    },
  });
}

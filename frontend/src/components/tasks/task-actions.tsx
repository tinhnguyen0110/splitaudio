import { useTranslation } from 'react-i18next';
import { Ban, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCancelTask, useRetryTask } from '@/hooks/use-tasks';
import { apiClient } from '@/lib/api-client';
import type { TaskDetail } from '@/types';

interface TaskActionsProps {
  task: TaskDetail;
}

async function downloadStem(taskId: string, stem: string) {
  const response = await apiClient.get(`/tasks/${taskId}/download/${stem}`, {
    responseType: 'blob',
  });
  const blob = new Blob([response.data], {
    type: response.headers['content-type'] || 'audio/wav',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${stem}.wav`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function TaskActions({ task }: TaskActionsProps) {
  const { t } = useTranslation();
  const cancelTask = useCancelTask();
  const retryTask = useRetryTask();

  return (
    <div className="flex flex-wrap gap-2">
      {(task.status === 'pending' || task.status === 'processing') && (
        <Button
          variant="destructive"
          size="sm"
          disabled={cancelTask.isPending}
          onClick={() => cancelTask.mutate(task.id)}
        >
          <Ban className="h-4 w-4 mr-1" />
          {t('taskDetail.cancel')}
        </Button>
      )}

      {(task.status === 'failed' || task.status === 'cancelled') && (
        <Button
          variant="outline"
          size="sm"
          disabled={retryTask.isPending}
          onClick={() => retryTask.mutate(task.id)}
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          {t('taskDetail.retry')}
        </Button>
      )}

      {task.status === 'completed' &&
        task.download_urls &&
        Object.entries(task.download_urls).map(([stem]) => (
          <Button
            key={stem}
            variant="outline"
            size="sm"
            onClick={() => downloadStem(task.id, stem)}
          >
            <Download className="h-4 w-4 mr-1" />
            {stem}
          </Button>
        ))}
    </div>
  );
}

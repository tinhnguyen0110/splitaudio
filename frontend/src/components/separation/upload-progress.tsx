import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface UploadProgressProps {
  progress: number;
  taskId: string | null;
}

export default function UploadProgress({ progress, taskId }: UploadProgressProps) {
  const { t } = useTranslation();

  if (taskId) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/50 p-6 text-center">
        <CheckCircle2 className="h-8 w-8 text-green-500" />
        <p className="font-medium">{t('separation.taskCreated')}</p>
        <Link
          to={`/tasks/${taskId}`}
          className="text-sm text-primary hover:underline"
        >
          {t('separation.viewTask')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>{t('separation.uploading')}</span>
        <span>{progress}%</span>
      </div>
      <Progress value={progress} />
    </div>
  );
}

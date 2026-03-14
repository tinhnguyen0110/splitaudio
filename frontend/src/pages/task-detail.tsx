import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileAudio,
  Clock,
  Coins,
  Cpu,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/common/status-badge';
import TaskTimeline from '@/components/tasks/task-timeline';
import TaskActions from '@/components/tasks/task-actions';
import AudioPlayer from '@/components/audio/audio-player';
import { useTaskStatus } from '@/hooks/use-tasks';
import { formatDuration, formatRelativeTime } from '@/lib/utils';

export default function TaskDetailPage() {
  const { t } = useTranslation();
  const { taskId } = useParams<{ taskId: string }>();
  const { data: task, isLoading } = useTaskStatus(taskId!);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t('taskDetail.notFound')}
      </div>
    );
  }

  const isPolling = task.status === 'pending' || task.status === 'processing';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="border border-border" asChild>
          <Link to="/history">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold truncate">{task.original_filename}</h1>
        <StatusBadge status={task.status} />
        {isPolling && (
          <Badge variant="outline" className="flex items-center gap-1 animate-pulse">
            <RefreshCw className="h-3 w-3 animate-spin" />
            {t('taskDetail.autoRefresh')}
          </Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Info card */}
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('taskDetail.info')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileAudio className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t('history.filename')}</dt>
                  <dd className="text-sm font-medium break-all">{task.original_filename}</dd>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                  <Cpu className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t('history.model')}</dt>
                  <dd className="text-sm font-medium">{task.model_used}</dd>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                  <Clock className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t('history.duration')}</dt>
                  <dd className="text-sm font-medium">{formatDuration(task.duration_seconds)}</dd>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                  <Coins className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t('taskDetail.creditConsumed')}</dt>
                  <dd className="text-sm font-medium">{task.credit_consumed}</dd>
                </div>
              </div>

              <div className="flex items-start gap-3 pl-12">
                <div>
                  <dt className="text-sm text-muted-foreground">{t('history.created')}</dt>
                  <dd className="text-sm font-medium">{formatRelativeTime(task.created_at)}</dd>
                </div>
              </div>

              {task.completed_at && (
                <div className="flex items-start gap-3 pl-12">
                  <div>
                    <dt className="text-sm text-muted-foreground">{t('taskDetail.completedAt')}</dt>
                    <dd className="text-sm font-medium">{formatRelativeTime(task.completed_at)}</dd>
                  </div>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{t('taskDetail.timeline')}</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskTimeline task={task} />
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <TaskActions task={task} />

      {/* Original audio */}
      {task.status === 'completed' && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{t('taskDetail.originalAudio', 'Original Audio')}</CardTitle>
          </CardHeader>
          <CardContent>
            <AudioPlayer
              src={`/tasks/${task.id}/download/original`}
              label="original"
            />
          </CardContent>
        </Card>
      )}

      {/* Audio players (completed) */}
      {task.status === 'completed' && task.download_urls && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{t('taskDetail.stems')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(task.download_urls).map(([stem]) => (
              <AudioPlayer
                key={stem}
                src={`/tasks/${task.id}/download/${stem}`}
                label={stem}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Error log (failed) */}
      {task.status === 'failed' && task.error_log && (
        <Card className="rounded-2xl border-red-300 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              {t('taskDetail.errorLog')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
              {task.error_log}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

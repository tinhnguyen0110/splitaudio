import { useState, useCallback } from 'react';
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
  Music,
  Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import StatusBadge from '@/components/common/status-badge';
import TaskTimeline from '@/components/tasks/task-timeline';
import TaskActions from '@/components/tasks/task-actions';
import AudioPlayer from '@/components/audio/audio-player';
import EnhancePanel, { EnhancedPlayer } from '@/components/audio/enhance-panel';
import { useTaskStatus } from '@/hooks/use-tasks';
import { apiClient } from '@/lib/api-client';
import { formatDuration, formatRelativeTime } from '@/lib/utils';

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

export default function TaskDetailPage() {
  const { t } = useTranslation();
  const { taskId } = useParams<{ taskId: string }>();
  const { data: task, isLoading } = useTaskStatus(taskId!);
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [enhancedStem, setEnhancedStem] = useState<string>('vocals');

  const handleEnhanced = useCallback((url: string | null, stemType: string) => {
    setEnhancedUrl(url);
    setEnhancedStem(stemType);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-2xl" />
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
  const isCompleted = task.status === 'completed';
  const defaultTab = isCompleted ? 'audio' : 'overview';

  return (
    <div className="space-y-4">
      {/* ─── Compact Header ─────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="border border-border h-8 w-8" asChild>
            <Link to="/history">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-bold truncate flex-1">{task.original_filename}</h1>
          <StatusBadge status={task.status} />
          {isPolling && (
            <Badge variant="outline" className="flex items-center gap-1 animate-pulse text-xs">
              <RefreshCw className="h-3 w-3 animate-spin" />
              {t('taskDetail.autoRefresh')}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap pl-11">
          {task.model_used && (
            <Badge variant="secondary" className="gap-1 text-xs font-normal">
              <Cpu className="h-3 w-3" />
              {task.model_used}
            </Badge>
          )}
          <Badge variant="secondary" className="gap-1 text-xs font-normal">
            <Clock className="h-3 w-3" />
            {formatDuration(task.duration_seconds)}
          </Badge>
          <Badge variant="secondary" className="gap-1 text-xs font-normal">
            <Coins className="h-3 w-3" />
            {task.credit_consumed} credit
          </Badge>
          <Badge variant="secondary" className="gap-1 text-xs font-normal">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(task.created_at)}
          </Badge>
        </div>
      </div>

      {/* ─── Tabs ───────────────────────────────────────────────────── */}
      <Tabs defaultValue={defaultTab}>
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="overview" className="gap-1.5">
            <FileAudio className="h-4 w-4" />
            {t('taskDetail.info', 'Overview')}
          </TabsTrigger>
          {isCompleted && (
            <TabsTrigger value="audio" className="gap-1.5">
              <Music className="h-4 w-4" />
              Audio & Enhance
            </TabsTrigger>
          )}
        </TabsList>

        {/* ─── Tab: Overview ──────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 pt-4">
          <div className="grid gap-6 lg:grid-cols-3">
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

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>{t('taskDetail.timeline')}</CardTitle>
              </CardHeader>
              <CardContent>
                <TaskTimeline task={task} />
              </CardContent>
            </Card>
          </div>

          {/* Non-completed actions (cancel/retry) */}
          {!isCompleted && <TaskActions task={task} />}

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
        </TabsContent>

        {/* ─── Tab: Audio & Enhance ───────────────────────────────── */}
        {isCompleted && (
          <TabsContent value="audio" className="pt-4">
            <div className="grid gap-6 lg:grid-cols-[1fr_420px] items-start">
              {/* Left: Audio players + Downloads + Enhanced result */}
              <div className="space-y-4">
                {/* Original audio */}
                <Card className="rounded-2xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t('taskDetail.originalAudio', 'Original Audio')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AudioPlayer
                      src={`/tasks/${task.id}/download/original`}
                      label="original"
                    />
                  </CardContent>
                </Card>

                {/* Output stems */}
                {task.download_urls && (
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{t('taskDetail.stems')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
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

                {/* Download buttons */}
                {task.download_urls && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(task.download_urls).map(([stem]) => (
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
                )}

                {/* Enhanced result (rendered here, in left column) */}
                {enhancedUrl && (
                  <Card className="rounded-2xl border-primary/30">
                    <CardContent className="pt-6 pb-6">
                      <EnhancedPlayer blobUrl={enhancedUrl} stemType={enhancedStem} />
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right: Enhance panel */}
              <EnhancePanel taskId={task.id} stems={task.download_urls} onEnhanced={handleEnhanced} />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

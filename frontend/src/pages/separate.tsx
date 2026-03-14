import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Loader2, Zap, CheckCircle2, Info, XCircle, ExternalLink, Cpu, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useSeparateAudio } from '@/hooks/use-separation';
import { useBalance } from '@/hooks/use-credits';
import { useTaskStatus, useTaskHistory } from '@/hooks/use-tasks';
import { useAuthStore } from '@/stores/auth-store';
import FileDropzone from '@/components/separation/file-dropzone';
import ModelSelector from '@/components/separation/model-selector';
import { MODELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { TaskStatus, TaskDetail } from '@/types';

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'separate-submitted-tasks';

interface SubmittedTask {
  taskId: string;
  filename: string;
  model: string;
}

function loadSubmitted(): SubmittedTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSubmitted(tasks: SubmittedTask[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks.slice(0, 20)));
}

// ---------------------------------------------------------------------------
// Task card (polls status via useTaskStatus)
// ---------------------------------------------------------------------------

function TaskCard({ taskId, filename, model, onRemove }: SubmittedTask & { onRemove?: (id: string) => void }) {
  const { t } = useTranslation();
  const { data: task, isError } = useTaskStatus(taskId);

  useEffect(() => {
    if (isError) {
      onRemove?.(taskId);
    }
  }, [isError, taskId, onRemove]);

  if (isError) return null;

  const status: TaskStatus = task?.status ?? 'pending';
  const modelConfig = MODELS.find((m) => m.id === model);
  const modelName = modelConfig ? t(modelConfig.nameKey) : model;

  const isActive = status === 'pending' || status === 'processing';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed' || status === 'cancelled';

  return (
    <div className="flex items-center gap-4 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate">{filename}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Model: {modelName}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-3">
        {isActive && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{t(`tasks.${status}`)}</span>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          </div>
        )}
        {isCompleted && (
          <Link to={`/tasks/${taskId}`} className="flex items-center gap-1.5 text-xs text-green-500 hover:underline">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t('tasks.completed')}
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
        {isFailed && (
          <Link to={`/tasks/${taskId}`} className="flex items-center gap-1.5 text-xs text-red-500 hover:underline">
            <XCircle className="h-3.5 w-3.5" />
            {t(`tasks.${status}`)}
          </Link>
        )}
      </div>
    </div>
  );
}

function HistoryTaskCard({ task }: { task: TaskDetail }) {
  const { t } = useTranslation();
  const status = task.status;
  const modelConfig = MODELS.find((m) => m.id === task.model_used);
  const modelName = modelConfig ? t(modelConfig.nameKey) : task.model_used;

  const isActive = status === 'pending' || status === 'processing';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed' || status === 'cancelled';

  return (
    <div className="flex items-center gap-4 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate">{task.original_filename}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Model: {modelName}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-3">
        {isActive && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{t(`tasks.${status}`)}</span>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          </div>
        )}
        {isCompleted && (
          <Link to={`/tasks/${task.id}`} className="flex items-center gap-1.5 text-xs text-green-500 hover:underline">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t('tasks.completed')}
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
        {isFailed && (
          <Link to={`/tasks/${task.id}`} className="flex items-center gap-1.5 text-xs text-red-500 hover:underline">
            <XCircle className="h-3.5 w-3.5" />
            {t(`tasks.${status}`)}
          </Link>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SeparatePage() {
  const { t } = useTranslation();
  const { mutate, isPending, uploadProgress } = useSeparateAudio();
  const { data: balance } = useBalance();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedModel, setSelectedModel] = useState('bs_roformer');
  const [selectedDevice, setSelectedDevice] = useState<'auto' | 'cpu'>('auto');
  const [submittedTasks, setSubmittedTasks] = useState<SubmittedTask[]>(loadSubmitted);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const currentModelConfig = MODELS.find((m) => m.id === selectedModel);

  // Reset device to auto when switching to a model that doesn't support CPU
  useEffect(() => {
    if (currentModelConfig && !currentModelConfig.cpuSupported && selectedDevice === 'cpu') {
      setSelectedDevice('auto');
    }
  }, [selectedModel, currentModelConfig, selectedDevice]);

  // Clear localStorage tasks when user changes (login/logout/switch account)
  useEffect(() => {
    setSubmittedTasks([]);
    saveSubmitted([]);
  }, [user?.id]);

  const removeTask = useCallback((taskId: string) => {
    setSubmittedTasks((prev) => {
      const next = prev.filter((t) => t.taskId !== taskId);
      saveSubmitted(next);
      return next;
    });
  }, []);

  const { data: historyData } = useTaskHistory({ page: 1, limit: 5, sort_by: 'created_at', order: 'desc' });

  useEffect(() => {
    saveSubmitted(submittedTasks);
  }, [submittedTasks]);

  const submittedIds = new Set(submittedTasks.map((t) => t.taskId));
  const extraHistoryTasks = (historyData?.items ?? []).filter(
    (task) => !submittedIds.has(task.id),
  );

  const handleSubmit = useCallback(() => {
    if (!selectedFile || !selectedModel) return;
    const filename = selectedFile.name;
    const model = selectedModel;
    mutate(
      { file: selectedFile, model: selectedModel, device: selectedDevice },
      {
        onSuccess: (data) => {
          setSubmittedTasks((prev) => [
            { taskId: data.task_id, filename, model },
            ...prev,
          ]);
          setSelectedFile(null);
          toast.success(t('separation.taskCreated'));
        },
        onError: () => toast.error(t('common.error')),
      },
    );
  }, [selectedFile, selectedModel, selectedDevice, mutate, t]);

  const credits = balance?.balance ?? 0;
  const hasTasks = submittedTasks.length > 0 || extraHistoryTasks.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('separation.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('separation.subtitle')}</p>
      </div>

      <div className="grid items-start gap-6" style={{ gridTemplateColumns: '1fr 340px' }}>
        {/* Main content area */}
        <div className="space-y-4">
          <FileDropzone
            onFileSelect={setSelectedFile}
            selectedFile={selectedFile}
            onRemove={() => setSelectedFile(null)}
          />

          {isPending && (
            <Card className="rounded-2xl">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-medium">{t('separation.uploading')}</span>
                  <span className="text-[13px] font-medium text-primary">
                    {Math.min(Math.round(uploadProgress), 100)}%
                  </span>
                </div>
                <Progress value={uploadProgress} />
              </CardContent>
            </Card>
          )}

          {hasTasks && (
            <Card className="rounded-2xl">
              <CardContent className="pt-6 pb-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <span className={cn(
                    'inline-block h-2 w-2 rounded-full bg-primary',
                    submittedTasks.some(() => true) && 'animate-pulse',
                  )} />
                  {t('separation.recentTasks')}
                </h3>

                {submittedTasks.map((task) => (
                  <TaskCard
                    key={task.taskId}
                    taskId={task.taskId}
                    filename={task.filename}
                    model={task.model}
                    onRemove={removeTask}
                  />
                ))}

                {extraHistoryTasks.map((task) => (
                  <HistoryTaskCard key={task.id} task={task} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar settings */}
        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardContent className="pt-6 pb-6">
              <h3 className="text-sm font-semibold mb-4">{t('separation.settings')}</h3>

              <label className="mb-1.5 block text-xs text-muted-foreground">
                {t('separation.aiModel')}
              </label>

              <div className="mb-5">
                <ModelSelector
                  selectedModel={selectedModel}
                  onSelect={setSelectedModel}
                />
              </div>

              {/* Device toggle — admin only, CPU-supported models only */}
              {isAdmin && currentModelConfig?.cpuSupported && (
                <div className="mb-5">
                  <label className="mb-1.5 block text-xs text-muted-foreground">
                    Device
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-[13px] font-medium transition-all',
                        selectedDevice === 'auto'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:border-primary/50 text-muted-foreground',
                      )}
                      onClick={() => setSelectedDevice('auto')}
                    >
                      <Monitor className="h-4 w-4" />
                      GPU
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-[13px] font-medium transition-all',
                        selectedDevice === 'cpu'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:border-primary/50 text-muted-foreground',
                      )}
                      onClick={() => setSelectedDevice('cpu')}
                    >
                      <Cpu className="h-4 w-4" />
                      CPU
                    </button>
                  </div>
                </div>
              )}

              {/* Credit info panel */}
              <div className="mb-5 rounded-xl bg-secondary p-4">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">{t('separation.estimatedCost')}</span>
                  <span className="font-semibold">1 Credit</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">{t('separation.remainingCredits')}</span>
                  <span className={`font-semibold ${credits > 2 ? 'text-green-500' : 'text-red-500'}`}>
                    {credits}
                  </span>
                </div>
              </div>

              {!isPending && (
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedFile}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  {t('separation.upload')}
                </Button>
              )}

              {isPending && (
                <Button disabled className="w-full opacity-50">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('separation.uploading')}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 bg-gradient-to-br from-purple-600 to-purple-800 text-white">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
                  <Info className="h-5 w-5" />
                </div>
                <span className="text-[13px] font-semibold">{t('separation.creditRules')}</span>
              </div>
              <div className="text-xs leading-[1.8] opacity-90">
                <div>{t('separation.rule1')}</div>
                <div>{t('separation.rule2')}</div>
                <div>{t('separation.rule3')}</div>
                <div>{t('separation.rule4')}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

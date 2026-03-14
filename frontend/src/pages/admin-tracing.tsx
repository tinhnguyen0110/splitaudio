import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Search,
  X,
  Zap,
  BarChart3,
  Link2,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useRequestLogs,
  useTaskTraces,
  useTaskTrace,
  useTraceStats,
  useWorkerLogs,
} from '@/hooks/use-traces';
import { RequestLogTable } from '@/components/admin/request-log-table';
import type {
  RequestLog,
  RequestLogFilters,
  TaskTraceListItem,
  TaskProcessStep,
} from '@/types/trace';

import { formatLocalDateTime, formatLocalTime } from '@/lib/utils';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtTime = (d: string) => formatLocalTime(d);

const methodColorClass: Record<string, string> = {
  GET: 'bg-cyan-500/10 text-cyan-400',
  POST: 'bg-violet-500/10 text-violet-400',
  PUT: 'bg-amber-500/10 text-amber-400',
  DELETE: 'bg-red-500/10 text-red-400',
  PATCH: 'bg-emerald-500/10 text-emerald-400',
};

function statusColorClass(s: number) {
  if (s >= 500) return 'text-red-400';
  if (s >= 400) return 'text-amber-400';
  if (s >= 300) return 'text-blue-400';
  return 'text-emerald-400';
}

function statusBgClass(s: number) {
  if (s >= 500) return 'bg-red-500/10 text-red-400';
  if (s >= 400) return 'bg-amber-500/10 text-amber-400';
  if (s >= 300) return 'bg-blue-500/10 text-blue-400';
  return 'bg-emerald-500/10 text-emerald-400';
}

const stepStatusConfig: Record<string, { icon: string; color: string; bg: string }> = {
  completed: { icon: '✓', color: 'text-emerald-400', bg: 'border-emerald-500 bg-emerald-500/10' },
  started: { icon: '◉', color: 'text-indigo-400', bg: 'border-indigo-500 bg-indigo-500/10' },
  failed: { icon: '✕', color: 'text-red-400', bg: 'border-red-500 bg-red-500/10' },
  pending: { icon: '○', color: 'text-muted-foreground', bg: 'border-muted bg-muted' },
};

// ── Main Component ───────────────────────────────────────────────────────────

export default function AdminTracingPage() {
  const { t } = useTranslation();

  // Shared state
  const [selectedRequest, setSelectedRequest] = useState<RequestLog | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(undefined);
  const [logFilter, setLogFilter] = useState<'all' | 'errors' | 'separate' | 'auth'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [correlatedTaskId, setCorrelatedTaskId] = useState<string | null>(null);

  // Data hooks
  const stats = useTraceStats();
  const taskTraces = useTaskTraces({ limit: 20 });
  const selectedTrace = useTaskTrace(selectedTaskId);
  const correlatedTrace = useTaskTrace(correlatedTaskId ?? undefined);

  // Request log filters
  const requestLogFilters = useMemo<RequestLogFilters>(() => {
    const f: RequestLogFilters = { limit: 100 };
    if (logFilter === 'errors') {
      f.status_code_min = 400;
    } else if (logFilter === 'separate') {
      f.path_contains = '/separate';
    } else if (logFilter === 'auth') {
      f.path_contains = '/auth';
    }
    if (searchQuery) {
      // Search overrides path filter from chips
      f.path_contains = searchQuery;
    }
    return f;
  }, [logFilter, searchQuery]);

  const requestLogs = useRequestLogs(requestLogFilters);

  // Correlated request logs (filtered by task_id)
  const correlatedRequestLogs = useRequestLogs(
    correlatedTaskId ? { task_id: correlatedTaskId, limit: 50 } : { limit: 0 }
  );

  // Error logs for overview
  const errorLogs = useRequestLogs({ status_code_min: 400, limit: 5 });

  const correlateTask = (taskId: string) => {
    setCorrelatedTaskId(taskId);
  };

  const clearCorrelation = () => {
    setCorrelatedTaskId(null);
    setSelectedRequest(null);
  };

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('admin.tracing')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('admin.tracingSubtitle')}</p>
        </div>
        {correlatedTaskId && (
          <div className="flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-2">
            <Link2 className="h-4 w-4 text-indigo-400" />
            <span className="text-sm text-indigo-300">
              {t('admin.correlating')}: <strong className="font-mono">{correlatedTaskId.slice(0, 8)}</strong>
            </span>
            <button onClick={clearCorrelation} className="ml-2 text-indigo-400 hover:text-indigo-300">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="mb-6 w-full justify-start border-b">
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4" />
            {t('admin.tracingOverview')}
          </TabsTrigger>
          <TabsTrigger value="requests">
            <Activity className="h-4 w-4" />
            {t('admin.requestLogs')}
          </TabsTrigger>
          <TabsTrigger value="pipeline">
            <Zap className="h-4 w-4" />
            {t('admin.taskPipeline')}
          </TabsTrigger>
          <TabsTrigger value="correlation">
            <Link2 className="h-4 w-4" />
            {t('admin.logCorrelation')}
          </TabsTrigger>
        </TabsList>

        {/* ══════ OVERVIEW TAB ══════ */}
        <TabsContent value="overview">
          <OverviewTab
            stats={stats.data}
            isLoadingStats={stats.isLoading}
            errorLogs={errorLogs.data?.items}
            taskTraces={taskTraces.data?.items}
            onErrorClick={(log) => setSelectedRequest(log)}
            onTaskClick={(taskId) => {
              correlateTask(taskId);
            }}
            t={t}
          />
        </TabsContent>

        {/* ══════ REQUEST LOGS TAB ══════ */}
        <TabsContent value="requests">
          <RequestLogsTab
            logFilter={logFilter}
            setLogFilter={setLogFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            logs={requestLogs.data?.items}
            isLoading={requestLogs.isLoading}
            total={requestLogs.data?.total}
            selectedRequest={selectedRequest}
            setSelectedRequest={setSelectedRequest}
            onCorrelate={(taskId) => correlateTask(taskId)}
            t={t}
          />
        </TabsContent>

        {/* ══════ TASK PIPELINE TAB ══════ */}
        <TabsContent value="pipeline">
          <TaskPipelineTab
            taskTraces={taskTraces.data?.items}
            isLoadingList={taskTraces.isLoading}
            selectedTaskId={selectedTaskId}
            setSelectedTaskId={setSelectedTaskId}
            selectedTrace={selectedTrace.data}
            isLoadingTrace={selectedTrace.isLoading}
            expandedStep={expandedStep}
            setExpandedStep={setExpandedStep}
            t={t}
          />
        </TabsContent>

        {/* ══════ LOG CORRELATION TAB ══════ */}
        <TabsContent value="correlation">
          <CorrelationTab
            correlatedTaskId={correlatedTaskId}
            correlatedTrace={correlatedTrace.data}
            correlatedRequests={correlatedRequestLogs.data?.items}
            isLoading={correlatedTrace.isLoading || correlatedRequestLogs.isLoading}
            selectedRequest={selectedRequest}
            setSelectedRequest={setSelectedRequest}
            expandedStep={expandedStep}
            setExpandedStep={setExpandedStep}
            clearCorrelation={clearCorrelation}
            t={t}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── OVERVIEW TAB ─────────────────────────────────────────────────────────────

interface OverviewTabProps {
  stats: ReturnType<typeof useTraceStats>['data'];
  isLoadingStats: boolean;
  errorLogs: RequestLog[] | undefined;
  taskTraces: TaskTraceListItem[] | undefined;
  onErrorClick: (log: RequestLog) => void;
  onTaskClick: (taskId: string) => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function OverviewTab({ stats, isLoadingStats, errorLogs, taskTraces, onErrorClick, onTaskClick, t }: OverviewTabProps) {
  const statCards = [
    { label: t('admin.totalRequests24h'), value: stats?.total_requests_24h?.toLocaleString() ?? '—', sub: t('admin.last24h'), color: 'text-indigo-400' },
    { label: t('admin.errorRate'), value: stats ? `${stats.error_rate_24h}%` : '—', sub: stats ? `${stats.error_count_24h} ${t('admin.errors')}` : '', color: 'text-red-400' },
    { label: t('admin.avgLatency'), value: stats ? `${Math.round(stats.avg_latency_ms)}ms` : '—', sub: stats ? `p99: ${Math.round(stats.p99_latency_ms)}ms` : '', color: 'text-emerald-400' },
    { label: t('admin.activeTasks'), value: stats?.active_tasks?.toString() ?? '—', sub: stats ? `${stats.processing_tasks} ${t('status.processing').toLowerCase()}` : '', color: 'text-amber-400' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <Card key={i} className="rounded-xl">
            <CardContent className="p-5">
              {isLoadingStats ? (
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={cn('mt-1 text-2xl font-bold font-mono', s.color)}>{s.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground/60">{s.sub}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Errors + Active Tasks */}
      <div className="grid grid-cols-2 gap-4">
        {/* Recent Errors */}
        <Card className="rounded-xl">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-sm font-semibold">{t('admin.recentErrors')}</span>
            </div>
            {!errorLogs || errorLogs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('admin.noErrors')}</p>
            ) : (
              <div className="space-y-1">
                {errorLogs.map((log) => (
                  <div
                    key={log.id}
                    className="cursor-pointer rounded-md px-3 py-2.5 transition-colors hover:bg-muted/50"
                    onClick={() => onErrorClick(log)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn('font-mono text-xs font-semibold', methodColorClass[log.method])}>
                          {log.method}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">{log.path}</span>
                      </div>
                      <span className={cn('font-mono text-xs px-2 py-0.5 rounded', statusBgClass(log.status_code))}>
                        {log.status_code}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      {log.error_detail || 'Error'} &middot; {fmtTime(log.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Task Pipelines */}
        <Card className="rounded-xl">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
              </span>
              <span className="text-sm font-semibold">{t('admin.activeTaskPipelines')}</span>
            </div>
            {!taskTraces || taskTraces.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('admin.noTraces')}</p>
            ) : (
              <div className="space-y-2">
                {taskTraces.filter(t => ['pending', 'processing'].includes(t.task_status)).slice(0, 5).map((task) => (
                  <div
                    key={task.task_id}
                    className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    onClick={() => onTaskClick(task.task_id)}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{task.original_filename || 'Unknown'}</span>
                        <span className="ml-2 font-mono text-xs text-muted-foreground">{task.task_id.slice(0, 8)}</span>
                      </div>
                      <Badge variant={task.task_status === 'failed' ? 'destructive' : 'secondary'} className="text-xs">
                        {t(`status.${task.task_status}`, { defaultValue: task.task_status })}
                      </Badge>
                    </div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: task.steps_count || 1 }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            'h-1 flex-1 rounded-full',
                            i < (task.steps_count || 0) ? 'bg-emerald-500' : 'bg-muted',
                          )}
                        />
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground/60">
                      {task.steps_count} {t('admin.stepsCompleted').toLowerCase()} &middot; {task.model_used}
                    </p>
                  </div>
                ))}
                {/* Also show recent completed/failed for context */}
                {taskTraces.filter(t => !['pending', 'processing'].includes(t.task_status)).slice(0, 3).map((task) => (
                  <div
                    key={task.task_id}
                    className="cursor-pointer rounded-lg border border-transparent px-3 py-2 opacity-60 transition-colors hover:bg-muted/30 hover:opacity-100"
                    onClick={() => onTaskClick(task.task_id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs">{task.original_filename || 'Unknown'}</span>
                      <Badge variant={task.task_status === 'failed' ? 'destructive' : 'outline'} className="text-xs">
                        {t(`status.${task.task_status}`, { defaultValue: task.task_status })}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── REQUEST LOGS TAB ─────────────────────────────────────────────────────────

interface RequestLogsTabProps {
  logFilter: 'all' | 'errors' | 'separate' | 'auth';
  setLogFilter: (f: 'all' | 'errors' | 'separate' | 'auth') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  logs: RequestLog[] | undefined;
  isLoading: boolean;
  total: number | undefined;
  selectedRequest: RequestLog | null;
  setSelectedRequest: (r: RequestLog | null) => void;
  onCorrelate: (taskId: string) => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function RequestLogsTab({
  logFilter,
  setLogFilter,
  searchQuery,
  setSearchQuery,
  logs,
  isLoading,
  total: _total,
  selectedRequest,
  setSelectedRequest,
  onCorrelate,
  t,
}: RequestLogsTabProps) {
  const filterChips = [
    { id: 'all' as const, label: t('admin.allMethods') },
    { id: 'errors' as const, label: t('admin.errorsOnly') },
    { id: 'separate' as const, label: '/separate' },
    { id: 'auth' as const, label: '/auth' },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Filters */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          {filterChips.map((f) => (
            <button
              key={f.id}
              onClick={() => setLogFilter(f.id)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                logFilter === f.id
                  ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-400'
                  : 'border-border bg-card text-muted-foreground hover:border-indigo-500/30 hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('admin.searchLogs')}
            className="w-64 pl-9"
          />
        </div>
      </div>

      <div className={cn('grid gap-4', selectedRequest ? 'grid-cols-[1fr_420px]' : 'grid-cols-1')}>
        {/* Log Table */}
        <Card className="overflow-hidden rounded-xl">
          <CardContent className="p-0">
            <RequestLogTable
              logs={logs}
              isLoading={isLoading}
              onRowClick={setSelectedRequest}
            />
          </CardContent>
        </Card>

        {/* Detail Side Panel */}
        {selectedRequest && (
          <RequestDetailPanel
            request={selectedRequest}
            onClose={() => setSelectedRequest(null)}
            onCorrelate={onCorrelate}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

// ── REQUEST DETAIL PANEL ─────────────────────────────────────────────────────

interface RequestDetailPanelProps {
  request: RequestLog;
  onClose: () => void;
  onCorrelate: (taskId: string) => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function RequestDetailPanel({ request, onClose, onCorrelate, t }: RequestDetailPanelProps) {
  const fields = [
    { label: t('admin.requestId'), value: request.request_id },
    { label: t('tasks.created'), value: formatLocalDateTime(request.created_at) },
    { label: t('admin.durationMs'), value: `${request.duration_ms}ms` },
    { label: t('admin.clientIp'), value: request.client_ip },
    request.user_agent && { label: 'User Agent', value: request.user_agent },
    request.task_id && { label: 'Task ID', value: request.task_id },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <Card className="sticky top-6 max-h-[calc(100vh-180px)] overflow-auto rounded-xl animate-in fade-in slide-in-from-right-4 duration-200">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold">{t('admin.requestDetail')}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Method + Path + Status */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className={cn('rounded px-2 py-0.5 font-mono text-xs font-semibold', methodColorClass[request.method])}>
            {request.method}
          </span>
          <span className="font-mono text-xs text-foreground">{request.path}</span>
          <span className={cn('rounded px-2 py-0.5 font-mono text-xs font-semibold', statusBgClass(request.status_code))}>
            {request.status_code}
          </span>
        </div>

        {/* Fields */}
        <div className="space-y-0">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center justify-between border-b border-border/50 py-2">
              <span className="text-xs text-muted-foreground">{f.label}</span>
              <span className="max-w-[240px] truncate font-mono text-xs">{f.value}</span>
            </div>
          ))}
        </div>

        {/* Error detail */}
        {request.error_detail && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{t('admin.errorDetail')}</p>
            <pre className="overflow-auto rounded-md border bg-red-500/5 p-3 font-mono text-xs text-red-400 leading-relaxed">
              {request.error_detail}
            </pre>
          </div>
        )}

        {/* Query params */}
        {request.query_params && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Query Params</p>
            <pre className="overflow-auto rounded-md border bg-muted/50 p-3 font-mono text-xs text-muted-foreground leading-relaxed">
              {request.query_params}
            </pre>
          </div>
        )}

        {/* View Task Pipeline button */}
        {request.task_id && (
          <Button
            onClick={() => onCorrelate(request.task_id!)}
            className="mt-4 w-full"
            variant="outline"
          >
            {t('admin.viewTaskPipeline')} &rarr;
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── TASK PIPELINE TAB ────────────────────────────────────────────────────────

interface TaskPipelineTabProps {
  taskTraces: TaskTraceListItem[] | undefined;
  isLoadingList: boolean;
  selectedTaskId: string | undefined;
  setSelectedTaskId: (id: string | undefined) => void;
  selectedTrace: ReturnType<typeof useTaskTrace>['data'];
  isLoadingTrace: boolean;
  expandedStep: number | null;
  setExpandedStep: (s: number | null) => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function TaskPipelineTab({
  taskTraces,
  isLoadingList,
  selectedTaskId,
  setSelectedTaskId,
  selectedTrace,
  isLoadingTrace,
  expandedStep,
  setExpandedStep,
  t,
}: TaskPipelineTabProps) {
  const [logLevelFilter, setLogLevelFilter] = useState<string>('all');

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Task Selector Chips */}
      <div className="mb-5 flex flex-wrap gap-2">
        {isLoadingList ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-40" />)
        ) : (
          taskTraces?.slice(0, 10).map((task) => (
            <button
              key={task.task_id}
              onClick={() => setSelectedTaskId(task.task_id === selectedTaskId ? undefined : task.task_id)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                selectedTaskId === task.task_id
                  ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-400'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {task.original_filename || task.task_id.slice(0, 8)}{' '}
              <span className={cn(
                'ml-1',
                task.task_status === 'failed' ? 'text-red-400' : 'text-indigo-400',
              )}>
                ({t(`status.${task.task_status}`, { defaultValue: task.task_status })})
              </span>
            </button>
          ))
        )}
      </div>

      {selectedTrace ? (
        <Card className="rounded-xl">
          <CardContent className="p-6">
            {/* Task header */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">{selectedTrace.original_filename}</h3>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {selectedTrace.task_id} &middot; {selectedTrace.model_used} &middot;{' '}
                  {selectedTrace.total_duration_ms ? `${selectedTrace.total_duration_ms}ms` : '—'}
                </p>
              </div>
              <Badge variant={selectedTrace.task_status === 'failed' ? 'destructive' : 'secondary'}>
                {t(`status.${selectedTrace.task_status}`, { defaultValue: selectedTrace.task_status })}
              </Badge>
            </div>

            {/* Processing Steps */}
            <div className="mb-6">
              <h4 className="mb-4 text-sm font-semibold">{t('admin.processingSteps')}</h4>
              <PipelineSteps
                steps={selectedTrace.steps}
                expandedStep={expandedStep}
                setExpandedStep={setExpandedStep}
                t={t}
              />
            </div>

            {/* Step Logs (worker-log style) */}
            <StepLogs
              taskId={selectedTaskId}
              levelFilter={logLevelFilter}
              setLevelFilter={setLogLevelFilter}
              t={t}
            />
          </CardContent>
        </Card>
      ) : isLoadingTrace ? (
        <Card className="rounded-xl">
          <CardContent className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="py-16 text-center text-muted-foreground">
          <Zap className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p>{t('admin.selectTaskToView')}</p>
        </div>
      )}
    </div>
  );
}

// ── PIPELINE STEPS (reusable) ────────────────────────────────────────────────

interface PipelineStepsProps {
  steps: TaskProcessStep[];
  expandedStep: number | null;
  setExpandedStep: (s: number | null) => void;
  t: ReturnType<typeof useTranslation>['t'];
  compact?: boolean;
}

function PipelineSteps({ steps, expandedStep, setExpandedStep, t, compact: _compact = false }: PipelineStepsProps) {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[15px] top-5 bottom-5 w-0.5 bg-border" />

      {steps.map((step, i) => {
        const config = stepStatusConfig[step.status] || stepStatusConfig.pending;

        return (
          <div key={step.id} className="relative mb-1 flex gap-3.5">
            {/* Step dot */}
            <div
              className={cn(
                'z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
                config.bg,
                config.color,
                step.status === 'started' && 'animate-pulse',
              )}
            >
              {config.icon}
            </div>

            {/* Step content */}
            <div
              className="flex-1 cursor-pointer py-0.5"
              onClick={() => setExpandedStep(expandedStep === i ? null : i)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-sm font-medium',
                    step.status === 'failed' ? 'text-red-400' : step.status === 'started' ? 'text-indigo-400' : step.status === 'completed' ? 'text-foreground' : 'text-muted-foreground',
                  )}>
                    {t(`traceSteps.${step.step_name}`, { defaultValue: step.step_name })}
                  </span>
                  {step.status === 'started' && (
                    <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] text-indigo-400">
                      in progress
                    </span>
                  )}
                </div>
                {step.duration_ms != null && (
                  <span className={cn('font-mono text-xs', step.duration_ms > 2000 ? 'text-amber-400' : 'text-muted-foreground')}>
                    {step.duration_ms}ms
                  </span>
                )}
              </div>

              {/* Progress bar for running/started steps */}
              {step.status === 'started' && (
                <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-border">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400" />
                </div>
              )}

              {/* Expanded detail */}
              {expandedStep === i && (
                <div className="mt-2 rounded-md border bg-muted/30 p-3 animate-in fade-in slide-in-from-top-1 duration-150">
                  <p className="font-mono text-xs text-muted-foreground leading-relaxed">{step.detail || '—'}</p>
                  {step.status === 'failed' && step.detail && (
                    <div className="mt-2 rounded border border-red-500/20 bg-red-500/5 px-3 py-2">
                      <p className="font-mono text-xs text-red-400 leading-relaxed">{step.detail}</p>
                    </div>
                  )}
                  {step.started_at && (
                    <p className="mt-2 font-mono text-xs text-muted-foreground/60">
                      {t('admin.started')}: {fmtTime(step.started_at)}
                      {step.completed_at ? ` → ${t('admin.ended')}: ${fmtTime(step.completed_at)}` : ' → In progress...'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {steps.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('admin.noTraces')}</p>
      )}
    </div>
  );
}

// ── STEP LOGS (worker-log style) ─────────────────────────────────────────────

const logLevelColorClass: Record<string, string> = {
  INFO: 'text-emerald-400',
  WARN: 'text-amber-300',
  ERROR: 'text-red-400',
  DEBUG: 'text-indigo-400',
};

interface StepLogsProps {
  taskId: string | undefined | null;
  levelFilter: string;
  setLevelFilter: (l: string) => void;
  t: ReturnType<typeof useTranslation>['t'];
  compact?: boolean;
}

function StepLogs({ taskId, levelFilter, setLevelFilter, t, compact = false }: StepLogsProps) {
  const apiLevelFilter = levelFilter === 'all' ? undefined : levelFilter;
  const { data: logs } = useWorkerLogs(taskId ?? undefined, apiLevelFilter);

  if (!logs || logs.length === 0) {
    if (!taskId) return null;
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold">{t('admin.workerLogs')}</h4>
          <div className="flex gap-1">
            {['all', 'INFO', 'DEBUG', 'WARN', 'ERROR'].map((l) => (
              <button
                key={l}
                onClick={() => setLevelFilter(l)}
                className={cn(
                  'rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
                  levelFilter === l
                    ? 'border border-indigo-500/50 bg-indigo-500/10 text-indigo-400'
                    : 'border border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className={cn(
          'overflow-auto rounded-lg border bg-background p-3 font-mono',
          compact ? 'max-h-64' : 'max-h-80',
        )}>
          <p className="py-4 text-center text-xs text-muted-foreground">{t('admin.noLogs')}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold">{t('admin.workerLogs')}</h4>
        <div className="flex gap-1">
          {['all', 'INFO', 'DEBUG', 'WARN', 'ERROR'].map((l) => (
            <button
              key={l}
              onClick={() => setLevelFilter(l)}
              className={cn(
                'rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
                levelFilter === l
                  ? 'border border-indigo-500/50 bg-indigo-500/10 text-indigo-400'
                  : 'border border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className={cn(
        'overflow-auto rounded-lg border bg-background p-3 font-mono',
        compact ? 'max-h-64' : 'max-h-80',
      )}>
        {logs.map((log) => (
          <div key={log.id} className="py-0.5 text-[11px] leading-relaxed">
            <span className="text-muted-foreground/50">{fmtTime(log.timestamp)}</span>
            {' '}
            <span className={cn('font-semibold', logLevelColorClass[log.level] || 'text-muted-foreground')}>
              [{log.level.padEnd(5)}]
            </span>
            {' '}
            <span className={cn(
              log.level === 'ERROR' ? 'text-red-400' : log.level === 'WARN' ? 'text-amber-300' : 'text-muted-foreground',
            )}>
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CORRELATION TAB ──────────────────────────────────────────────────────────

interface CorrelationTabProps {
  correlatedTaskId: string | null;
  correlatedTrace: ReturnType<typeof useTaskTrace>['data'];
  correlatedRequests: RequestLog[] | undefined;
  isLoading: boolean;
  selectedRequest: RequestLog | null;
  setSelectedRequest: (r: RequestLog | null) => void;
  expandedStep: number | null;
  setExpandedStep: (s: number | null) => void;
  clearCorrelation: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function CorrelationTab({
  correlatedTaskId,
  correlatedTrace,
  correlatedRequests,
  isLoading: _correlationLoading,
  selectedRequest,
  setSelectedRequest,
  expandedStep,
  setExpandedStep,
  clearCorrelation,
  t,
}: CorrelationTabProps) {
  const [logLevelFilter, setLogLevelFilter] = useState<string>('all');

  if (!correlatedTaskId || !correlatedTrace) {
    return (
      <div className="py-16 text-center text-muted-foreground animate-in fade-in duration-300">
        <Link2 className="mx-auto mb-3 h-10 w-10 opacity-30" />
        <p className="mb-2">{t('admin.correlationHint')}</p>
        <p className="text-xs text-muted-foreground/60">{t('admin.correlationDescription')}</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header bar */}
      <Card className="mb-4 rounded-xl">
        <CardContent className="flex items-center gap-3 p-4">
          <span className="text-sm font-semibold">{t('admin.correlationView')}:</span>
          <span className="font-mono text-sm text-indigo-400">{correlatedTaskId.slice(0, 8)}</span>
          <span className="text-muted-foreground">&middot;</span>
          <span className="text-sm text-muted-foreground">{correlatedTrace.original_filename}</span>
          <span className="text-muted-foreground">&middot;</span>
          <Badge variant={correlatedTrace.task_status === 'failed' ? 'destructive' : 'secondary'} className="text-xs">
            {t(`status.${correlatedTrace.task_status}`, { defaultValue: correlatedTrace.task_status })}
          </Badge>
          <Button onClick={clearCorrelation} variant="outline" size="sm" className="ml-auto">
            {t('admin.clearCorrelation')}
          </Button>
        </CardContent>
      </Card>

      {/* Side by side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: HTTP Requests */}
        <Card className="rounded-xl">
          <CardContent className="p-5">
            <h3 className="mb-4 text-sm font-semibold">
              {t('admin.httpRequestLogs')}{' '}
              <span className="font-normal text-muted-foreground">({correlatedRequests?.length || 0} requests)</span>
            </h3>
            {!correlatedRequests || correlatedRequests.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('admin.noLogs')}</p>
            ) : (
              <div className="space-y-1">
                {correlatedRequests.map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      'cursor-pointer rounded-md border-l-2 px-3 py-2.5 transition-colors hover:bg-muted/50',
                      log.status_code >= 400 ? 'border-l-red-500' : log.status_code >= 300 ? 'border-l-blue-500' : 'border-l-emerald-500',
                      selectedRequest?.id === log.id && 'bg-muted/50',
                    )}
                    onClick={() => setSelectedRequest(log)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn('font-mono text-xs font-semibold', methodColorClass[log.method])}>
                          {log.method}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">{log.path}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('font-mono text-xs', statusColorClass(log.status_code))}>{log.status_code}</span>
                        <span className="font-mono text-xs text-muted-foreground/60">{log.duration_ms}ms</span>
                      </div>
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground/60">{fmtTime(log.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Task Pipeline */}
        <Card className="rounded-xl">
          <CardContent className="p-5">
            <h3 className="mb-4 text-sm font-semibold">{t('admin.taskProcessingPipeline')}</h3>
            <PipelineSteps
              steps={correlatedTrace.steps}
              expandedStep={expandedStep}
              setExpandedStep={setExpandedStep}
              t={t}
              compact
            />
            <div className="mt-4">
              <StepLogs
                taskId={correlatedTaskId}
                levelFilter={logLevelFilter}
                setLevelFilter={setLogLevelFilter}
                t={t}
                compact
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

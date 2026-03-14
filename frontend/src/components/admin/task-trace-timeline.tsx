import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { cn, formatLocalTime } from '@/lib/utils';
import type { TaskProcessStep } from '@/types/trace';

interface TaskTraceTimelineProps {
  steps: TaskProcessStep[];
}

function StepIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  if (status === 'failed') return <XCircle className="h-5 w-5 text-red-500" />;
  if (status === 'started') return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
  return <Clock className="h-5 w-5 text-muted-foreground" />;
}

function stepStatusColor(status: string) {
  if (status === 'completed') return 'border-green-500 bg-green-500/10';
  if (status === 'failed') return 'border-red-500 bg-red-500/10';
  if (status === 'started') return 'border-blue-500 bg-blue-500/10';
  return 'border-muted bg-muted';
}

function lineColor(status: string) {
  if (status === 'completed') return 'bg-green-500';
  if (status === 'failed') return 'bg-red-500';
  return 'bg-muted';
}

export function TaskTraceTimeline({ steps }: TaskTraceTimelineProps) {
  const { t } = useTranslation();

  const apiSteps = steps.filter((s) => s.source === 'api');
  const workerSteps = steps.filter((s) => s.source === 'worker');

  const renderSteps = (phaseSteps: TaskProcessStep[]) =>
    phaseSteps.map((step, idx) => (
      <div key={step.id} className="flex gap-4">
        {/* Timeline line + circle */}
        <div className="flex flex-col items-center">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2', stepStatusColor(step.status))}>
            <StepIcon status={step.status} />
          </div>
          {idx < phaseSteps.length - 1 && (
            <div className={cn('w-0.5 flex-1 min-h-[24px]', lineColor(step.status))} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 pb-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {t(`traceSteps.${step.step_name}`, { defaultValue: step.step_name })}
            </span>
            {step.duration_ms !== null && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {step.duration_ms}ms
              </span>
            )}
            <span className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              step.status === 'completed' && 'bg-green-500/10 text-green-600 dark:text-green-400',
              step.status === 'failed' && 'bg-red-500/10 text-red-600 dark:text-red-400',
              step.status === 'started' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
            )}>
              {step.status}
            </span>
          </div>
          {step.detail && (
            <p className={cn(
              'mt-1 text-sm',
              step.status === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
            )}>
              {step.detail}
            </p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatLocalTime(step.started_at)}
          </p>
        </div>
      </div>
    ));

  return (
    <div className="space-y-6">
      {apiSteps.length > 0 && (
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase text-muted-foreground">
            {t('admin.apiPhase')}
          </h3>
          <div>{renderSteps(apiSteps)}</div>
        </div>
      )}

      {apiSteps.length > 0 && workerSteps.length > 0 && (
        <div className="border-t" />
      )}

      {workerSteps.length > 0 && (
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase text-muted-foreground">
            {t('admin.workerPhase')}
          </h3>
          <div>{renderSteps(workerSteps)}</div>
        </div>
      )}

      {steps.length === 0 && (
        <p className="py-4 text-center text-muted-foreground">{t('admin.noTraces')}</p>
      )}
    </div>
  );
}

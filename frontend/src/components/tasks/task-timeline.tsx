import { useTranslation } from 'react-i18next';
import { Check, Clock, Loader2, X } from 'lucide-react';
import { cn, formatLocalDateTime } from '@/lib/utils';
import type { TaskDetail } from '@/types';

interface TaskTimelineProps {
  task: TaskDetail;
}

interface TimelineStep {
  label: string;
  timestamp: string | null;
  reached: boolean;
  current: boolean;
  failed: boolean;
}

function getSteps(task: TaskDetail): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const statusOrder = ['pending', 'processing', 'completed', 'failed', 'cancelled'];
  const idx = statusOrder.indexOf(task.status);

  steps.push({
    label: 'taskDetail.created',
    timestamp: task.created_at,
    reached: true,
    current: task.status === 'pending',
    failed: false,
  });

  steps.push({
    label: 'taskDetail.processing',
    timestamp: idx >= 1 ? task.updated_at : null,
    reached: idx >= 1,
    current: task.status === 'processing',
    failed: false,
  });

  if (task.status === 'failed') {
    steps.push({
      label: 'taskDetail.failed',
      timestamp: task.completed_at || task.updated_at,
      reached: true,
      current: false,
      failed: true,
    });
  } else if (task.status === 'cancelled') {
    steps.push({
      label: 'taskDetail.cancelled',
      timestamp: task.updated_at,
      reached: true,
      current: false,
      failed: true,
    });
  } else {
    steps.push({
      label: 'taskDetail.completed',
      timestamp: task.completed_at,
      reached: task.status === 'completed',
      current: false,
      failed: false,
    });
  }

  return steps;
}

export default function TaskTimeline({ task }: TaskTimelineProps) {
  const { t } = useTranslation();
  const steps = getSteps(task);

  return (
    <div className="space-y-0">
      {steps.map((step, i) => (
        <div key={step.label} className="flex gap-3">
          {/* Indicator column */}
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border-2',
                step.failed && 'border-red-500 bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
                step.current && !step.failed && 'border-blue-500 bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400 animate-pulse',
                step.reached && !step.current && !step.failed && 'border-green-500 bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400',
                !step.reached && 'border-muted-foreground/30 bg-muted text-muted-foreground',
              )}
            >
              {step.failed ? (
                <X className="h-4 w-4" />
              ) : step.current ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : step.reached ? (
                <Check className="h-4 w-4" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'w-0.5 h-8',
                  steps[i + 1].reached ? 'bg-green-500' : 'bg-muted-foreground/20',
                )}
              />
            )}
          </div>

          {/* Content */}
          <div className="pb-4 pt-1">
            <p
              className={cn(
                'text-sm font-medium',
                step.failed && 'text-red-600 dark:text-red-400',
                step.current && 'text-blue-600 dark:text-blue-400',
              )}
            >
              {t(step.label)}
            </p>
            {step.timestamp && (
              <p className="text-xs text-muted-foreground">
                {formatLocalDateTime(step.timestamp)}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

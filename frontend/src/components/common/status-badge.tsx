import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { TaskStatus } from '@/types';

const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  pending: 'bg-yellow-500',
  processing: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  cancelled: 'bg-gray-500',
};

const STATUS_PILL_COLORS: Record<TaskStatus, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  processing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
  cancelled: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
};

interface StatusBadgeProps {
  status: TaskStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation();

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        STATUS_PILL_COLORS[status],
        status === 'processing' && 'animate-pulse',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          STATUS_DOT_COLORS[status],
          status === 'processing' && 'animate-pulse',
        )}
      />
      {t(`status.${status}`)}
    </span>
  );
}

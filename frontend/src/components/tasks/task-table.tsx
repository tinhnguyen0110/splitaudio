import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Eye, FileAudio } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/common/status-badge';
import { formatBytes, formatDuration, formatRelativeTime } from '@/lib/utils';
import { MODEL_DISPLAY_NAMES } from '@/lib/constants';
import type { TaskDetail } from '@/types';

interface TaskTableProps {
  tasks: TaskDetail[];
  isLoading: boolean;
}

function SkeletonRows() {
  return Array.from({ length: 5 }).map((_, i) => (
    <TableRow key={i}>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
    </TableRow>
  ));
}

function MobileCard({ task }: { task: TaskDetail }) {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FileAudio className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium text-sm truncate max-w-[200px]">
            {task.original_filename}
          </span>
        </div>
        <StatusBadge status={task.status} />
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{t(MODEL_DISPLAY_NAMES[task.model_used] ?? task.model_used)}</span>
        <span>{formatDuration(task.duration_seconds)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(task.created_at)}
        </span>
        <Button variant="ghost" size="sm" className="border border-border" asChild>
          <Link to={`/tasks/${task.id}`}>
            <Eye className="h-4 w-4 mr-1" />
            {t('common.view')}
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default function TaskTable({ tasks, isLoading }: TaskTableProps) {
  const { t } = useTranslation();

  if (!isLoading && tasks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t('history.noTasks')}
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('history.filename')}</TableHead>
              <TableHead>{t('history.model')}</TableHead>
              <TableHead>{t('history.status')}</TableHead>
              <TableHead>{t('history.duration')}</TableHead>
              <TableHead>{t('history.created')}</TableHead>
              <TableHead className="w-[60px]">{t('history.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <SkeletonRows />
            ) : (
              tasks.map((task) => (
                <TableRow key={task.id} className="hover:bg-muted/50">
                  <TableCell className="max-w-[250px]">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <FileAudio className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {task.original_filename}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes((task as TaskDetail & { file_size?: number }).file_size ?? 0)}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{t(MODEL_DISPLAY_NAMES[task.model_used] ?? task.model_used)}</TableCell>
                  <TableCell>
                    <StatusBadge status={task.status} />
                  </TableCell>
                  <TableCell className="text-sm">{formatDuration(task.duration_seconds)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatRelativeTime(task.created_at)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="border border-border" asChild>
                      <Link to={`/tasks/${task.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl border p-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))
          : tasks.map((task) => <MobileCard key={task.id} task={task} />)}
      </div>
    </>
  );
}

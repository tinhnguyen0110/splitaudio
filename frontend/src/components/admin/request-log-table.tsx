import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatLocalDateTime } from '@/lib/utils';
import type { RequestLog } from '@/types/trace';

interface RequestLogTableProps {
  logs: RequestLog[] | undefined;
  isLoading: boolean;
  onRowClick?: (log: RequestLog) => void;
}

const methodColors: Record<string, string> = {
  GET: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  POST: 'bg-green-500/10 text-green-600 dark:text-green-400',
  PUT: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  DELETE: 'bg-red-500/10 text-red-600 dark:text-red-400',
  PATCH: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
};

function statusColor(code: number) {
  if (code >= 500) return 'bg-red-500/10 text-red-600 dark:text-red-400';
  if (code >= 400) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  if (code >= 300) return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
  return 'bg-green-500/10 text-green-600 dark:text-green-400';
}

export function RequestLogTable({ logs, isLoading, onRowClick }: RequestLogTableProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('tasks.created')}</TableHead>
            <TableHead>{t('admin.method')}</TableHead>
            <TableHead>{t('admin.path')}</TableHead>
            <TableHead>{t('admin.statusCode')}</TableHead>
            <TableHead>{t('admin.durationMs')}</TableHead>
            <TableHead>{t('admin.clientIp')}</TableHead>
            <TableHead>{t('admin.requestId')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 7 }).map((_, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-5 w-20" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">{t('admin.noLogs')}</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('tasks.created')}</TableHead>
          <TableHead>{t('admin.method')}</TableHead>
          <TableHead>{t('admin.path')}</TableHead>
          <TableHead>{t('admin.statusCode')}</TableHead>
          <TableHead>{t('admin.durationMs')}</TableHead>
          <TableHead>{t('admin.clientIp')}</TableHead>
          <TableHead>{t('admin.requestId')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow
            key={log.id}
            className={cn('hover:bg-muted/50', onRowClick && 'cursor-pointer')}
            onClick={() => onRowClick?.(log)}
          >
            <TableCell className="text-sm text-muted-foreground">
              {formatLocalDateTime(log.created_at)}
            </TableCell>
            <TableCell>
              <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', methodColors[log.method] || 'bg-muted text-muted-foreground')}>
                {log.method}
              </span>
            </TableCell>
            <TableCell className="max-w-[300px] truncate text-sm font-mono">{log.path}</TableCell>
            <TableCell>
              <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', statusColor(log.status_code))}>
                {log.status_code}
              </span>
            </TableCell>
            <TableCell className="text-sm">{log.duration_ms}ms</TableCell>
            <TableCell className="text-sm text-muted-foreground">{log.client_ip}</TableCell>
            <TableCell className="max-w-[140px] truncate text-xs font-mono text-muted-foreground">
              {log.request_id.slice(0, 8)}...
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

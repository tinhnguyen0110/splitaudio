import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileAudio } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import StatusBadge from '@/components/common/status-badge';
import { useTaskHistory } from '@/hooks/use-tasks';
import { formatRelativeTime } from '@/lib/utils';

export default function RecentTasks() {
  const { t } = useTranslation();
  const { data, isLoading } = useTaskHistory({ page: 1, limit: 5 });

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">
          {t('dashboard.recentTasks')}
        </CardTitle>
        <Link
          to="/history"
          className="text-sm text-primary hover:underline"
        >
          {t('dashboard.viewAll')}
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('dashboard.noTasks')}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tasks.filename')}</TableHead>
                <TableHead>{t('tasks.status')}</TableHead>
                <TableHead>{t('tasks.created')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((task) => (
                <TableRow key={task.id} className="hover:bg-muted/50">
                  <TableCell className="max-w-[200px]">
                    <Link
                      to={`/tasks/${task.id}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <FileAudio className="h-4 w-4 text-primary" />
                      </div>
                      <span className="truncate text-sm font-medium">
                        {task.original_filename}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={task.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatRelativeTime(task.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

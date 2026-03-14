import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { History, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import TaskFilters from '@/components/tasks/task-filters';
import TaskTable from '@/components/tasks/task-table';
import Pagination from '@/components/common/pagination';
import { useTaskHistory } from '@/hooks/use-tasks';
import type { TaskHistoryParams, TaskStatus } from '@/types';

const LIMIT = 10;

export default function HistoryPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parseInt(searchParams.get('page') || '1', 10);
  const status = searchParams.get('status') as TaskStatus | undefined;
  const sortBy = searchParams.get('sort_by') || 'created_at';
  const order = (searchParams.get('order') || 'desc') as 'asc' | 'desc';

  const params: TaskHistoryParams = {
    page,
    limit: LIMIT,
    status: status || undefined,
    sort_by: sortBy,
    order,
  };

  const { data, isLoading } = useTaskHistory(params);

  const handleFilterChange = useCallback(
    (_params: TaskHistoryParams) => {
      // Filters already sync with URL search params via TaskFilters
    },
    [],
  );

  const handlePageChange = (newPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(newPage));
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <History className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{t('history.title')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t('history.subtitle', { defaultValue: '' })}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t('history.search', { defaultValue: 'Search...' })}
            aria-label="Search tasks"
          />
        </div>
        <TaskFilters onFilterChange={handleFilterChange} />
      </div>

      <TaskTable tasks={data?.items ?? []} isLoading={isLoading} />

      {data && data.pages > 1 && (
        <Pagination
          page={page}
          totalPages={data.pages}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TaskHistoryParams, TaskStatus } from '@/types';

const STATUSES: TaskStatus[] = ['pending', 'processing', 'completed', 'failed', 'cancelled'];

interface TaskFiltersProps {
  onFilterChange: (params: TaskHistoryParams) => void;
}

export default function TaskFilters({ onFilterChange }: TaskFiltersProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get('status') || '';
  const sortBy = searchParams.get('sort_by') || 'created_at';
  const order = (searchParams.get('order') || 'desc') as 'asc' | 'desc';

  const updateFilters = useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
      }
      next.set('page', '1');
      setSearchParams(next, { replace: true });

      const params: TaskHistoryParams = {
        page: 1,
        status: (next.get('status') as TaskStatus) || undefined,
        sort_by: next.get('sort_by') || 'created_at',
        order: (next.get('order') as 'asc' | 'desc') || 'desc',
      };
      onFilterChange(params);
    },
    [searchParams, setSearchParams, onFilterChange],
  );

  return (
    <div className="flex flex-wrap gap-3">
      <Select
        value={status}
        onValueChange={(v) => updateFilters({ status: v === 'all' ? '' : v })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t('history.allStatuses')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('history.allStatuses')}</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`status.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={sortBy}
        onValueChange={(v) => updateFilters({ sort_by: v })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="created_at">{t('history.sortCreated')}</SelectItem>
          <SelectItem value="updated_at">{t('history.sortUpdated')}</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={order}
        onValueChange={(v) => updateFilters({ order: v })}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="desc">{t('history.orderDesc')}</SelectItem>
          <SelectItem value="asc">{t('history.orderAsc')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

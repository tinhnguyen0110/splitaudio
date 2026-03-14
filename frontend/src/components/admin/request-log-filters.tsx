import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RequestLogFilters } from '@/types/trace';

interface RequestLogFiltersBarProps {
  filters: RequestLogFilters;
  onFiltersChange: (filters: RequestLogFilters) => void;
}

export function RequestLogFiltersBar({ filters, onFiltersChange }: RequestLogFiltersBarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={filters.method || 'all'}
        onValueChange={(v) => onFiltersChange({ ...filters, method: v === 'all' ? undefined : v, page: 1 })}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={t('admin.filterByMethod')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('admin.allMethods')}</SelectItem>
          <SelectItem value="GET">GET</SelectItem>
          <SelectItem value="POST">POST</SelectItem>
          <SelectItem value="PUT">PUT</SelectItem>
          <SelectItem value="DELETE">DELETE</SelectItem>
        </SelectContent>
      </Select>

      <Input
        placeholder={t('admin.filterByPath')}
        className="w-[200px]"
        value={filters.path_contains || ''}
        onChange={(e) => onFiltersChange({ ...filters, path_contains: e.target.value || undefined, page: 1 })}
      />

      <Input
        type="number"
        placeholder={t('admin.statusCode') + ' min'}
        className="w-[120px]"
        value={filters.status_code_min ?? ''}
        onChange={(e) =>
          onFiltersChange({
            ...filters,
            status_code_min: e.target.value ? Number(e.target.value) : undefined,
            page: 1,
          })
        }
      />

      <Input
        type="number"
        placeholder={t('admin.statusCode') + ' max'}
        className="w-[120px]"
        value={filters.status_code_max ?? ''}
        onChange={(e) =>
          onFiltersChange({
            ...filters,
            status_code_max: e.target.value ? Number(e.target.value) : undefined,
            page: 1,
          })
        }
      />

      <Input
        type="date"
        className="w-[160px]"
        value={filters.date_from || ''}
        onChange={(e) => onFiltersChange({ ...filters, date_from: e.target.value || undefined, page: 1 })}
      />

      <Input
        type="date"
        className="w-[160px]"
        value={filters.date_to || ''}
        onChange={(e) => onFiltersChange({ ...filters, date_to: e.target.value || undefined, page: 1 })}
      />
    </div>
  );
}

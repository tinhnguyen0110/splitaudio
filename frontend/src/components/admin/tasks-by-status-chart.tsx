import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { STATUS_CHART_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface TasksByStatusChartProps {
  tasksByStatus: Record<string, number> | undefined;
}

const BAR_COLORS: Record<string, string> = {
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  processing: 'bg-blue-500',
  pending: 'bg-amber-500',
  cancelled: 'bg-gray-500',
};

export function TasksByStatusChart({ tasksByStatus }: TasksByStatusChartProps) {
  const { t } = useTranslation();

  if (!tasksByStatus) return null;

  const entries = Object.entries(tasksByStatus).filter(([, value]) => value > 0);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  const data = entries.map(([name, value]) => ({
    name: t(`tasks.${name}`),
    key: name,
    value,
    color: STATUS_CHART_COLORS[name] ?? '#6b7280',
    pct: total > 0 ? ((value / total) * 100).toFixed(1) : '0',
  }));

  if (data.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Horizontal stacked bar */}
      <div className="space-y-3">
        <div className="flex h-4 w-full overflow-hidden rounded-full">
          {data.map((entry) => (
            <div
              key={entry.key}
              className={cn('h-full transition-all', BAR_COLORS[entry.key] ?? 'bg-gray-500')}
              style={{ width: `${entry.pct}%` }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          {data.map((entry) => (
            <div key={entry.key} className="flex items-center gap-2 text-sm">
              <span
                className={cn('h-2.5 w-2.5 rounded-full', BAR_COLORS[entry.key] ?? 'bg-gray-500')}
              />
              <span className="text-muted-foreground">{entry.name}</span>
              <span className="font-medium">{entry.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Donut chart */}
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }: { name?: string; percent?: number }) =>
              `${name ?? ''} ${((percent ?? 0) * 100).toFixed(1)}%`
            }
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { Users, ListTodo, Coins, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdminStats } from '@/types';

interface StatsCardsProps {
  stats: AdminStats | undefined;
  isLoading: boolean;
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  const { t } = useTranslation();

  const completionRate =
    stats && stats.total_tasks > 0
      ? ((stats.tasks_by_status.completed ?? 0) / stats.total_tasks * 100).toFixed(1) + '%'
      : '0%';

  const cards = [
    {
      icon: Users,
      label: t('admin.totalUsers'),
      value: stats?.total_users,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-500/10',
    },
    {
      icon: ListTodo,
      label: t('admin.totalTasks'),
      value: stats?.total_tasks,
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-500/10',
    },
    {
      icon: Coins,
      label: t('admin.creditsConsumed'),
      value: stats?.total_credits_consumed,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-500/10',
    },
    {
      icon: CheckCircle,
      label: t('admin.completionRate'),
      value: completionRate,
      iconColor: 'text-green-500',
      iconBg: 'bg-green-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="rounded-2xl">
          <CardContent className="flex items-center gap-4 p-6">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}>
              <card.icon className={`h-5 w-5 ${card.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground truncate">{card.label}</p>
              {isLoading ? (
                <Skeleton className="mt-1 h-7 w-16" />
              ) : (
                <p className="text-2xl font-bold">{card.value ?? 0}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

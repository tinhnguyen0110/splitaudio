import { useTranslation } from 'react-i18next';
import { ListTodo } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/hooks/use-user';
import { useTaskHistory } from '@/hooks/use-tasks';
import CreditsCard from '@/components/dashboard/credits-card';
import QuickUpload from '@/components/dashboard/quick-upload';
import RecentTasks from '@/components/dashboard/recent-tasks';

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();
  const { data: taskData, isLoading: tasksLoading } = useTaskHistory({ page: 1, limit: 5 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {t('dashboard.welcome', { name: user?.display_name || user?.email || '' })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.subtitle', { defaultValue: '' })}</p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-3">
        <CreditsCard />

        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
              <ListTodo className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.recentTasks', { defaultValue: 'Tasks' })}</p>
              {tasksLoading ? (
                <Skeleton className="mt-1 h-7 w-12" />
              ) : (
                <p className="text-2xl font-bold">{taskData?.total ?? 0}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <QuickUpload />
      </div>

      <RecentTasks />
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { Server, Database, Cpu, Wifi } from 'lucide-react';
import { useAdminStats } from '@/hooks/use-admin';
import { StatsCards } from '@/components/admin/stats-cards';
import { TasksByStatusChart } from '@/components/admin/tasks-by-status-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useAdminStats();

  const healthItems = [
    { icon: Server, label: 'API Server', status: 'online' },
    { icon: Database, label: 'Database', status: 'online' },
    { icon: Cpu, label: 'Worker', status: 'online' },
    { icon: Wifi, label: 'Redis', status: 'online' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('admin.dashboard')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('admin.dashboardSubtitle', { defaultValue: '' })}</p>
      </div>

      <StatsCards stats={stats} isLoading={isLoading} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Task status overview */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{t('admin.tasksByStatus')}</CardTitle>
          </CardHeader>
          <CardContent>
            <TasksByStatusChart tasksByStatus={stats?.tasks_by_status} />
          </CardContent>
        </Card>

        {/* System health */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{t('admin.systemHealth', { defaultValue: 'System Health' })}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {healthItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-2xl border p-4"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <item.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-xs text-green-600 dark:text-green-400">
                        {item.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

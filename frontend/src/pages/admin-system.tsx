import { useTranslation } from 'react-i18next';
import { Activity } from 'lucide-react';
import { useAdminStats } from '@/hooks/use-admin';
import { MODELS } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function SystemOverviewPage() {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useAdminStats();

  const pendingCount = stats?.tasks_by_status.pending ?? 0;
  const processingCount = stats?.tasks_by_status.processing ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('admin.system')}</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('admin.modelStatus')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODELS.map((model) => (
            <Card key={model.id}>
              <CardContent className="flex items-center justify-between p-5">
                <div className="min-w-0">
                  <p className="font-medium truncate">{t(model.nameKey)}</p>
                  <p className="text-xs text-muted-foreground">
                    {model.stems.join(', ')}
                  </p>
                </div>
                <Badge variant="default" className="bg-green-600 shrink-0">
                  {t('admin.online')}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('admin.queueDepth')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <Activity className="h-8 w-8 text-yellow-500 shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">{t('tasks.pending')}</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-7 w-12" />
                ) : (
                  <p className="text-2xl font-bold">{pendingCount}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <Activity className="h-8 w-8 text-blue-500 shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">{t('tasks.processing')}</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-7 w-12" />
                ) : (
                  <p className="text-2xl font-bold">{processingCount}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

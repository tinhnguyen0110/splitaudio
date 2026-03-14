import { useTranslation } from 'react-i18next';
import { Coins, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBalance } from '@/hooks/use-credits';

export default function BalanceCard() {
  const { t } = useTranslation();
  const { data, isLoading } = useBalance();

  const stats = [
    {
      label: t('credits.balance'),
      value: data?.balance,
      icon: Coins,
      primary: true,
    },
    {
      label: t('credits.totalConsumed'),
      value: data?.total_consumed,
      icon: TrendingDown,
      primary: false,
      iconColor: 'text-red-500',
      iconBg: 'bg-red-500/10',
    },
    {
      label: t('credits.totalPurchased'),
      value: data?.total_purchased,
      icon: TrendingUp,
      primary: false,
      iconColor: 'text-green-500',
      iconBg: 'bg-green-500/10',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className={
            stat.primary
              ? 'rounded-2xl bg-gradient-to-br from-purple-600 to-purple-800 text-white border-0'
              : 'rounded-2xl'
          }
        >
          <CardContent className="flex items-center gap-4 p-6">
            <div
              className={
                stat.primary
                  ? 'flex h-9 w-9 items-center justify-center rounded-lg bg-white/20'
                  : `flex h-9 w-9 items-center justify-center rounded-lg ${stat.iconBg ?? 'bg-muted'}`
              }
            >
              <stat.icon
                className={
                  stat.primary
                    ? 'h-5 w-5'
                    : `h-5 w-5 ${stat.iconColor ?? 'text-muted-foreground'}`
                }
              />
            </div>
            <div>
              <p className={stat.primary ? 'text-sm text-white/70' : 'text-sm text-muted-foreground'}>
                {stat.label}
              </p>
              {isLoading ? (
                <Skeleton className={`h-8 w-16 mt-1 ${stat.primary ? 'bg-white/20' : ''}`} />
              ) : (
                <>
                  <p className={`text-3xl font-bold ${stat.primary ? '' : ''}`}>
                    {stat.value}
                  </p>
                  {stat.primary && (
                    <p className="text-sm text-white/60">credits</p>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

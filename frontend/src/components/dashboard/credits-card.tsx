import { useTranslation } from 'react-i18next';
import { Coins } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBalance } from '@/hooks/use-credits';

export default function CreditsCard() {
  const { t } = useTranslation();
  const { data: balance, isLoading } = useBalance();

  return (
    <Card className="rounded-2xl bg-gradient-to-br from-purple-600 to-purple-800 text-white border-0">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
            <Coins className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium text-white/80">
            {t('dashboard.creditsBalance')}
          </span>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-24 bg-white/20" />
            <Skeleton className="h-4 w-40 bg-white/20" />
          </div>
        ) : (
          <>
            <div className="text-4xl font-bold">{balance?.balance ?? 0}</div>
            <p className="mt-1 text-sm text-white/60">credits</p>
            <div className="mt-4 flex gap-6 text-xs text-white/70">
              <span>
                {t('credits.totalConsumed')}: {balance?.total_consumed ?? 0}
              </span>
              <span>
                {t('credits.totalPurchased')}: {balance?.total_purchased ?? 0}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard } from 'lucide-react';
import BalanceCard from '@/components/credits/balance-card';
import PurchaseForm from '@/components/credits/purchase-form';
import RedeemForm from '@/components/credits/redeem-form';
import TransactionTable from '@/components/credits/transaction-table';

export default function CreditsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{t('credits.title')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t('credits.subtitle', { defaultValue: '' })}</p>
      </div>

      <BalanceCard />

      <div className="grid gap-6 md:grid-cols-2">
        <PurchaseForm />
        <RedeemForm />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">{t('credits.transactions')}</h2>
        <TransactionTable page={page} limit={20} onPageChange={setPage} />
      </div>
    </div>
  );
}

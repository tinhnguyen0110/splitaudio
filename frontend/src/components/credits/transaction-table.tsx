import { useTranslation } from 'react-i18next';
import { ArrowUpCircle, ArrowDownCircle, Gift, RefreshCw, ShieldCheck, Plus } from 'lucide-react';
import { formatLocalDate } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import Pagination from '@/components/common/pagination';
import { useTransactions } from '@/hooks/use-credits';
import { cn } from '@/lib/utils';

interface TransactionTableProps {
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export default function TransactionTable({ page, limit, onPageChange }: TransactionTableProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useTransactions(page, limit);

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('credits.type')}</TableHead>
            <TableHead>{t('credits.description')}</TableHead>
            <TableHead>{t('credits.date')}</TableHead>
            <TableHead className="text-right">{t('credits.amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                </TableRow>
              ))
            : data?.items.map((tx) => (
                <TableRow key={tx.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          tx.amount > 0
                            ? 'bg-green-500/10'
                            : 'bg-orange-500/10',
                        )}
                      >
                        {tx.type === 'deduction' ? (
                          <ArrowDownCircle className="h-4 w-4 text-orange-500" />
                        ) : tx.type === 'refund' ? (
                          <RefreshCw className="h-4 w-4 text-blue-500" />
                        ) : tx.type === 'purchase' ? (
                          <ArrowUpCircle className="h-4 w-4 text-green-500" />
                        ) : tx.type === 'redeem' ? (
                          <Gift className="h-4 w-4 text-purple-500" />
                        ) : tx.type === 'admin_adjustment' ? (
                          <ShieldCheck className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Plus className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <span className="text-sm font-medium">
                        {t(`credits.txType.${tx.type}`)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tx.description}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatLocalDate(tx.created_at)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right text-sm font-semibold',
                      tx.amount > 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400',
                    )}
                  >
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>

      {!isLoading && data && data.pages > 1 && (
        <Pagination
          page={page}
          totalPages={data.pages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

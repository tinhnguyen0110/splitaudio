import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdjustCredits } from '@/hooks/use-admin';
import type { AdminUser } from '@/types';

interface CreditAdjustModalProps {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreditAdjustModal({ user, open, onOpenChange }: CreditAdjustModalProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const adjustCredits = useAdjustCredits();

  const handleSubmit = () => {
    if (!user || !amount) return;
    adjustCredits.mutate(
      { userId: user.id, amount: Number(amount), description: description || undefined },
      {
        onSuccess: () => {
          onOpenChange(false);
          setAmount('');
          setDescription('');
        },
      },
    );
  };

  const displayName = user?.display_name || user?.email || '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.adjustForUser', { name: displayName })}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            {t('credits.balance')}: <span className="font-medium text-foreground">{user?.credits ?? 0}</span>
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('admin.adjustAmount')}</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 10 or -5"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('admin.adjustDescription')}</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('admin.adjustDescriptionPlaceholder')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!amount || adjustCredits.isPending}>
            {t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

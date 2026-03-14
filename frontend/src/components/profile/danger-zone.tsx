import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useDeleteAccount } from '@/hooks/use-user';

export default function DangerZone() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const deleteAccount = useDeleteAccount();

  const handleDelete = () => {
    deleteAccount.mutate(undefined, {
      onSuccess: () => navigate('/'),
    });
  };

  return (
    <Card className="rounded-2xl border-red-300 dark:border-red-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10">
            <Trash2 className="h-5 w-5 text-red-500" />
          </div>
          {t('profile.dangerZone')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          {t('profile.dangerZoneDesc', { defaultValue: '' })}
        </p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive">
              {t('profile.deleteAccount')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('profile.deleteConfirmTitle')}</DialogTitle>
              <DialogDescription>
                {t('profile.deleteConfirmDesc')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost" className="border border-border">{t('common.cancel')}</Button>
              </DialogClose>
              <Button
                variant="destructive"
                disabled={deleteAccount.isPending}
                onClick={handleDelete}
              >
                {deleteAccount.isPending ? t('common.loading') : t('profile.confirmDelete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

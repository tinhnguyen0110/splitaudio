import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { AdminUser } from '@/types';

interface UserTableProps {
  users: AdminUser[] | undefined;
  isLoading: boolean;
  onAdjustCredits: (user: AdminUser) => void;
}

export function UserTable({ users, isLoading, onAdjustCredits }: UserTableProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('auth.email')}</TableHead>
            <TableHead>{t('auth.displayName')}</TableHead>
            <TableHead>{t('tasks.status')}</TableHead>
            <TableHead>{t('credits.balance')}</TableHead>
            <TableHead>Files</TableHead>
            <TableHead>{t('tasks.status')}</TableHead>
            <TableHead>{t('tasks.created')}</TableHead>
            <TableHead>{t('tasks.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 8 }).map((_, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-5 w-20" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (!users || users.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">{t('common.noResults')}</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('auth.email')}</TableHead>
          <TableHead>{t('auth.displayName')}</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>{t('credits.balance')}</TableHead>
          <TableHead>Active</TableHead>
          <TableHead>{t('tasks.created')}</TableHead>
          <TableHead>{t('tasks.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const initial = (user.display_name?.[0] || user.email[0] || '?').toUpperCase();
          return (
            <TableRow key={user.id} className="hover:bg-muted/50">
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {initial}
                  </div>
                  <span className="text-sm font-medium">{user.email}</span>
                </div>
              </TableCell>
              <TableCell className="text-sm">{user.display_name || '--'}</TableCell>
              <TableCell>
                <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                  {user.role}
                </Badge>
              </TableCell>
              <TableCell className="text-sm font-medium">{user.credits}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{user.total_files}</TableCell>
              <TableCell>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                    user.is_active
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400',
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      user.is_active ? 'bg-green-500' : 'bg-red-500',
                    )}
                  />
                  {user.is_active ? 'Active' : 'Banned'}
                </span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatRelativeTime(user.created_at)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="border border-border" onClick={() => onAdjustCredits(user)}>
                    {t('admin.adjustCredits')}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

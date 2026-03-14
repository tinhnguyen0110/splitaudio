import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAdminUsers } from '@/hooks/use-admin';
import { UserTable } from '@/components/admin/user-table';
import { CreditAdjustModal } from '@/components/admin/credit-adjust-modal';
import Pagination from '@/components/common/pagination';
import type { AdminUser } from '@/types';

export default function UserManagementPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const { data, isLoading } = useAdminUsers(page, 20);

  const filteredUsers = useMemo(() => {
    if (!data?.items || !searchQuery) return data?.items;
    const q = searchQuery.toLowerCase();
    return data.items.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.display_name && u.display_name.toLowerCase().includes(q)),
    );
  }, [data?.items, searchQuery]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{t('admin.users')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t('admin.usersSubtitle', { defaultValue: '' })}</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={t('admin.search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search users"
        />
      </div>

      <UserTable
        users={filteredUsers}
        isLoading={isLoading}
        onAdjustCredits={(user) => setSelectedUser(user)}
      />

      {data && data.pages > 1 && (
        <Pagination page={page} totalPages={data.pages} onPageChange={setPage} />
      )}

      <CreditAdjustModal
        user={selectedUser}
        open={selectedUser !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedUser(null);
        }}
      />
    </div>
  );
}

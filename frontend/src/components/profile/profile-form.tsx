import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrentUser, useUpdateProfile } from '@/hooks/use-user';

export default function ProfileForm() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();
  const updateProfile = useUpdateProfile();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name);
      setEmail(user.email);
    }
  }, [user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({ display_name: displayName, email });
  };

  const initial = (user?.display_name?.[0] || user?.email?.[0] || '?').toUpperCase();

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>{t('profile.info')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-pink-500 text-2xl font-bold text-white">
            {initial}
          </div>
          <div>
            <p className="font-medium">{user?.display_name || user?.email}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {/* Account info key-value rows */}
        <div className="divide-y">
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-muted-foreground">{t('profile.displayName')}</span>
            <span className="text-sm font-medium">{user?.display_name || '--'}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-muted-foreground">{t('profile.email')}</span>
            <span className="text-sm font-medium">{user?.email || '--'}</span>
          </div>
        </div>

        {/* Edit form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">{t('profile.displayName')}</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('profile.email')}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={updateProfile.isPending}>
            {updateProfile.isPending ? t('common.loading') : t('profile.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

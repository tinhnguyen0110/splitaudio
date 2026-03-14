import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import ProfileForm from '@/components/profile/profile-form';
import PasswordForm from '@/components/profile/password-form';
import LanguageSwitcher from '@/components/profile/language-switcher';
import DangerZone from '@/components/profile/danger-zone';

export default function ProfilePage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{t('profile.title')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t('profile.subtitle', { defaultValue: '' })}</p>
      </div>

      <ProfileForm />
      <PasswordForm />
      <LanguageSwitcher />
      <DangerZone />
    </div>
  );
}

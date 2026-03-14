import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRegister } from '@/hooks/use-auth';

export default function RegisterForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const register = useRegister();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    register.mutate(
      { email, password, display_name: displayName || undefined },
      { onSuccess: () => navigate('/dashboard') },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="register-name">{t('auth.displayName')}</Label>
        <Input
          id="register-name"
          type="text"
          placeholder={t('auth.displayNamePlaceholder')}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-email">{t('auth.email')}</Label>
        <Input
          id="register-email"
          type="email"
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-password">{t('auth.password')}</Label>
        <Input
          id="register-password"
          type="password"
          placeholder={t('auth.passwordPlaceholder')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <Button type="submit" className="w-full" disabled={register.isPending}>
        {register.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('auth.registerButton')}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t('auth.hasAccount')}{' '}
        <Link to="/?tab=login" className="text-primary hover:underline">
          {t('auth.login')}
        </Link>
      </p>
    </form>
  );
}

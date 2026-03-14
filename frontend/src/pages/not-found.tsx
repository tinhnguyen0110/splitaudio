import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-6xl font-bold">404</h1>
      <h2 className="text-2xl font-semibold">{t('notFound.title')}</h2>
      <p className="text-muted-foreground">{t('notFound.description')}</p>
      <Button asChild>
        <Link to="/dashboard">{t('notFound.backHome')}</Link>
      </Button>
    </div>
  );
}

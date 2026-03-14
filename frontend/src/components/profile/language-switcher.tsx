import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'vi', label: 'Tiếng Việt' },
];

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Languages className="h-5 w-5 text-primary" />
          </div>
          {t('profile.language')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {LANGUAGES.map((lang) => (
            <Button
              key={lang.code}
              variant="ghost"
              className={cn(
                'border',
                i18n.language === lang.code
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border',
              )}
              onClick={() => i18n.changeLanguage(lang.code)}
            >
              {lang.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

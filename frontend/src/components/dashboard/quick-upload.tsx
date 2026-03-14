import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Upload } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ALLOWED_FILE_TYPES } from '@/lib/constants';

export default function QuickUpload() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Card
      className="cursor-pointer rounded-2xl transition-colors hover:border-primary"
      onClick={() => navigate('/separate')}
    >
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <Upload className="h-6 w-6 text-primary" />
        </div>
        <p className="font-medium">{t('dashboard.dropFiles')}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {ALLOWED_FILE_TYPES.join(', ')}
        </p>
      </CardContent>
    </Card>
  );
}

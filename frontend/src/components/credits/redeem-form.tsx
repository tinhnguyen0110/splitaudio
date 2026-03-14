import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Gift } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRedeem } from '@/hooks/use-credits';

export default function RedeemForm() {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const redeem = useRedeem();

  const handleSubmit = () => {
    if (!code.trim()) return;
    redeem.mutate({ code: code.trim() }, {
      onSuccess: () => setCode(''),
    });
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
            <Gift className="h-5 w-5 text-green-500" />
          </div>
          {t('credits.redeem')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="promo-code">{t('credits.promoCode')}</Label>
          <div className="flex gap-2">
            <Input
              id="promo-code"
              placeholder={t('credits.enterCode')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <Button
              disabled={!code.trim() || redeem.isPending}
              onClick={handleSubmit}
            >
              {redeem.isPending ? t('common.loading') : t('credits.redeemButton')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

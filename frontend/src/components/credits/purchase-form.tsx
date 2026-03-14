import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePurchase } from '@/hooks/use-credits';
import { CREDIT_PRESETS } from '@/lib/constants';
import { cn } from '@/lib/utils';

const POPULAR_PRESET = 25;

export default function PurchaseForm() {
  const { t } = useTranslation();
  const [amount, setAmount] = useState<number | ''>('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const purchase = usePurchase();

  const handlePresetClick = (preset: number) => {
    setSelectedPreset(preset);
    setAmount(preset);
  };

  const handleCustomChange = (value: string) => {
    const num = parseInt(value, 10);
    setSelectedPreset(null);
    setAmount(isNaN(num) ? '' : num);
  };

  const handleSubmit = () => {
    if (!amount || amount <= 0) return;
    purchase.mutate({ amount }, {
      onSuccess: () => {
        setAmount('');
        setSelectedPreset(null);
      },
    });
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <ShoppingCart className="h-5 w-5 text-primary" />
          </div>
          {t('credits.purchase')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {CREDIT_PRESETS.map((preset) => (
            <div key={preset} className="relative">
              {preset === POPULAR_PRESET && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground z-10">
                  Popular
                </span>
              )}
              <Button
                variant="ghost"
                className={cn(
                  'w-full border',
                  selectedPreset === preset
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border',
                )}
                onClick={() => handlePresetClick(preset)}
              >
                {preset}
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="credit-amount">{t('credits.customAmount')}</Label>
          <Input
            id="credit-amount"
            type="number"
            min={1}
            placeholder={t('credits.enterAmount')}
            value={amount}
            onChange={(e) => handleCustomChange(e.target.value)}
          />
        </div>

        <Button
          className="w-full"
          disabled={!amount || amount <= 0 || purchase.isPending}
          onClick={handleSubmit}
        >
          {purchase.isPending ? t('common.loading') : t('credits.purchaseButton')}
        </Button>
      </CardContent>
    </Card>
  );
}

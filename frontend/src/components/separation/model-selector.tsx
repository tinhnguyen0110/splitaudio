import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { MODELS } from '@/lib/constants';

interface ModelSelectorProps {
  selectedModel: string;
  onSelect: (model: string) => void;
}

export default function ModelSelector({ selectedModel, onSelect }: ModelSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2">
      {MODELS.map((model) => {
        const isSelected = selectedModel === model.id;
        return (
          <div
            key={model.id}
            className={cn(
              'cursor-pointer rounded-xl border-2 px-4 py-3.5 transition-all',
              isSelected
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50',
            )}
            onClick={() => onSelect(model.id)}
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold">{t(model.nameKey)}</span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium',
                  isSelected
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {model.sdr}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(model.descKey)} &bull; {model.speed}
            </p>
          </div>
        );
      })}
    </div>
  );
}

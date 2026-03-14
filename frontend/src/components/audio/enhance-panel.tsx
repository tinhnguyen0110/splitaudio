import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  ChevronDown,
  Loader2,
  Download,
  Zap,
  Play,
  Pause,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useEnhanceStem } from '@/hooks/use-enhance';
import {
  createInitialSteps,
  applyPreset,
  type StepState,
  type StepParamDef,
} from './enhance-steps';
import { cn } from '@/lib/utils';

// ─── Step Toggle with expandable config ──────────────────────────────────────

function StepToggle({
  step,
  onToggle,
  onParamChange,
}: {
  step: StepState;
  onToggle: () => void;
  onParamChange: (key: string, value: number | string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasParams = step.params.length > 0;

  return (
    <div
      className={cn(
        'rounded-xl border transition-all',
        step.disabled ? 'border-border bg-background opacity-50' :
        step.enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-background',
      )}
    >
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
        onClick={() => !step.disabled && hasParams && setExpanded(!expanded)}
      >
        {/* Toggle */}
        <button
          type="button"
          disabled={step.disabled}
          onClick={(e) => { e.stopPropagation(); if (!step.disabled) onToggle(); }}
          className={cn(
            'relative w-9 h-5 rounded-full transition-colors flex-shrink-0',
            step.disabled ? 'bg-muted cursor-not-allowed' :
            step.enabled ? 'bg-primary' : 'bg-muted',
          )}
        >
          <div
            className={cn(
              'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
              step.enabled ? 'left-[18px]' : 'left-0.5',
            )}
          />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm">{step.icon}</span>
            <span className={cn('text-xs font-semibold', step.enabled ? 'text-foreground' : 'text-muted-foreground')}>
              {step.name}
            </span>
            {step.tag && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {step.tag}
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{step.desc}</p>
        </div>

        {hasParams && (
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform flex-shrink-0',
              expanded && 'rotate-180',
            )}
          />
        )}
      </div>

      {/* Config panel */}
      {expanded && step.enabled && hasParams && (
        <div className="px-3 pb-3 pt-2 border-t border-border/50 space-y-3">
          {step.params.map((p) => (
            <ParamControl key={p.key} param={p} onChange={(v) => onParamChange(p.key, v)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Parameter Control (slider or select) ────────────────────────────────────

function ParamControl({
  param,
  onChange,
}: {
  param: StepParamDef;
  onChange: (value: number | string) => void;
}) {
  const displayValue =
    param.type === 'select'
      ? param.options?.find((o) => o.value === String(param.value))?.label || param.value
      : typeof param.value === 'number'
        ? (param.step && param.step < 1 ? (param.value as number).toFixed(2) : param.value)
        : param.value;

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-[10px] text-muted-foreground font-medium">{param.label}</label>
        <span className="text-[10px] font-semibold text-primary font-mono">
          {displayValue}{param.unit || ''}
        </span>
      </div>

      {param.type === 'slider' && (
        <input
          type="range"
          min={param.min}
          max={param.max}
          step={param.step}
          value={param.value as number}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1 rounded-full appearance-none cursor-pointer accent-primary bg-muted"
        />
      )}

      {param.type === 'select' && param.options && (
        <div className="flex gap-1.5 flex-wrap">
          {param.options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={cn(
                'px-2 py-1 rounded-md border text-[10px] font-medium transition-all',
                String(param.value) === o.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {param.hint && (
        <p className="text-[9px] text-muted-foreground/60 mt-1 italic">{param.hint}</p>
      )}
    </div>
  );
}

// ─── Enhanced Result Player (exported for use in parent) ─────────────────────

export function EnhancedPlayer({ blobUrl, stemType }: { blobUrl: string; stemType: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio(blobUrl);
      audioRef.current = audio;
      audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
      audio.addEventListener('timeupdate', () => setProgress(audio.currentTime / audio.duration));
      audio.addEventListener('ended', () => setPlaying(false));
    }
    const audio = audioRef.current;
    if (audio.paused) {
      audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, [blobUrl]);

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-primary flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary" />
          Enhanced Result
        </h4>
        <a
          href={blobUrl}
          download={`enhanced_${stemType}.wav`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
        >
          <Download className="h-3 w-3" />
          Download
        </a>
      </div>

      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">enhanced_{stemType}.wav</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0"
          >
            {playing ? (
              <Pause className="h-3.5 w-3.5 text-primary-foreground" />
            ) : (
              <Play className="h-3.5 w-3.5 text-primary-foreground ml-0.5" />
            )}
          </button>
          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-100"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground font-mono min-w-[60px] text-right">
            {fmtTime(progress * duration)} / {fmtTime(duration)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 p-2.5">
        <Info className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <span className="text-[10px] text-muted-foreground">
          Play both the original stem above and the enhanced version to compare A/B quality.
        </span>
      </div>
    </div>
  );
}

// ─── Main EnhancePanel ───────────────────────────────────────────────────────

export default function EnhancePanel({
  taskId,
  stems,
  onEnhanced,
}: {
  taskId: string;
  stems: Record<string, string> | null | undefined;
  onEnhanced?: (url: string | null, stemType: string) => void;
}) {
  const { t: _t } = useTranslation();
  const [selectedStem, setSelectedStem] = useState<string>('vocals');
  const [steps, setSteps] = useState<StepState[]>(createInitialSteps);
  const [_enhancedUrl, setEnhancedUrl] = useState<string | null>(null);

  const { mutate, isPending } = useEnhanceStem();

  const availableStems = stems ? Object.keys(stems) : [];

  const clearEnhanced = useCallback(() => {
    setEnhancedUrl(null);
    onEnhanced?.(null, selectedStem);
  }, [onEnhanced, selectedStem]);

  const toggleStep = useCallback((id: string) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
    clearEnhanced();
  }, [clearEnhanced]);

  const updateParam = useCallback((stepId: string, key: string, value: number | string) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === stepId
          ? { ...s, params: s.params.map((p) => (p.key === key ? { ...p, value } : p)) }
          : s,
      ),
    );
    clearEnhanced();
  }, [clearEnhanced]);

  const handlePreset = useCallback((preset: string) => {
    setSteps((prev) => applyPreset(prev, preset));
    clearEnhanced();
  }, [clearEnhanced]);

  const enabledSteps = steps.filter((s) => s.enabled);

  const estimatedTime = enabledSteps.reduce((acc, s) => {
    const match = s.tag?.match(/([\d.]+)/);
    return acc + (match ? parseFloat(match[1]) : 0);
  }, 0);

  const handleEnhance = useCallback(() => {
    if (enabledSteps.length === 0) {
      toast.warning('Enable at least one step');
      return;
    }

    const stepsConfig = enabledSteps.map((s) => {
      const params: Record<string, unknown> = {};
      for (const p of s.params) {
        // Convert string numbers to actual numbers for certain params
        if (p.type === 'select' && !isNaN(Number(p.value))) {
          params[p.key] = Number(p.value);
        } else {
          params[p.key] = p.value;
        }
      }
      return { step_id: s.id, params };
    });

    mutate(
      { taskId, stemType: selectedStem, steps: stepsConfig },
      {
        onSuccess: (url) => {
          setEnhancedUrl(url);
          onEnhanced?.(url, selectedStem);
          toast.success(`Enhanced ${selectedStem} successfully!`);
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.detail || 'Enhancement failed');
        },
      },
    );
  }, [enabledSteps, taskId, selectedStem, mutate]);

  return (
    <div className="space-y-4 lg:sticky lg:top-6">
      <Card className="rounded-2xl">
        <CardContent className="pt-6 pb-6 space-y-5">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Audio Enhance</h3>
              <p className="text-[10px] text-muted-foreground">Post-processing pipeline</p>
            </div>
          </div>

          {/* Stem selector */}
          <div>
            <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-2">
              Input stem
            </label>
            <div className="flex gap-2">
              {['vocals', 'instrumental'].map((stem) => (
                <button
                  key={stem}
                  type="button"
                  disabled={!availableStems.includes(stem)}
                  onClick={() => { setSelectedStem(stem); clearEnhanced(); }}
                  className={cn(
                    'flex-1 px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all',
                    selectedStem === stem
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                    !availableStems.includes(stem) && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  {stem === 'vocals' ? '🎤' : '🎸'} {stem}
                </button>
              ))}
            </div>
          </div>

          {/* Presets */}
          <div>
            <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-2">
              Preset
            </label>
            <div className="flex gap-2">
              {[
                { id: 'light', label: 'Light', desc: '3 steps' },
                { id: 'medium', label: 'Medium', desc: '5 steps' },
                { id: 'aggressive', label: 'Max', desc: '6 steps' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePreset(p.id)}
                  className="flex-1 px-2 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground transition-all"
                >
                  <div>{p.label}</div>
                  <div className="text-[9px] text-muted-foreground/60 mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                Pipeline steps
              </label>
              <span className="text-[10px] text-muted-foreground">
                {enabledSteps.length}/{steps.length} active
              </span>
            </div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {steps.map((s) => (
                <StepToggle
                  key={s.id}
                  step={s}
                  onToggle={() => toggleStep(s.id)}
                  onParamChange={(key, val) => updateParam(s.id, key, val)}
                />
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-xl bg-secondary p-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Input</span>
              <span className="font-semibold">{selectedStem}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Steps enabled</span>
              <span className="font-semibold">{enabledSteps.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Estimated time</span>
              <span className="font-semibold font-mono">~{estimatedTime.toFixed(1)}s</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Credit cost</span>
              <span className="font-semibold text-green-500">Free</span>
            </div>
          </div>

          {/* Progress */}
          {isPending && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Processing...</span>
              </div>
              <Progress value={undefined} className="h-1" />
            </div>
          )}

          {/* Enhance button */}
          <Button
            onClick={handleEnhance}
            disabled={isPending || enabledSteps.length === 0}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Enhance {selectedStem}
              </>
            )}
          </Button>

          {enabledSteps.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center">
              Enable at least 1 step to start
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

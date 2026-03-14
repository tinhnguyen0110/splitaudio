export interface StepParamDef {
  key: string;
  label: string;
  type: 'slider' | 'select';
  min?: number;
  max?: number;
  step?: number;
  value: number | string;
  unit?: string;
  options?: Array<{ value: string; label: string }>;
  hint?: string;
}

export interface StepDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  tag?: string;
  defaultEnabled: boolean;
  disabled?: boolean;
  params: StepParamDef[];
}

export interface StepState extends StepDef {
  enabled: boolean;
}

export const ENHANCE_STEPS: StepDef[] = [
  {
    id: 'silence_gate',
    name: 'Silence Gate',
    desc: 'Reduce noise in silent sections using energy threshold',
    icon: '🔇',
    tag: '~0.5s',
    defaultEnabled: true,
    params: [
      { key: 'threshold_db', label: 'Threshold', type: 'slider', min: -70, max: -25, step: 1, value: -50, unit: ' dB', hint: 'Lower = less gating, preserves more reverb tail' },
      { key: 'attack_ms', label: 'Attack time', type: 'slider', min: 1, max: 50, step: 1, value: 5, unit: ' ms' },
      { key: 'release_ms', label: 'Release time', type: 'slider', min: 10, max: 500, step: 10, value: 50, unit: ' ms' },
      { key: 'floor_gain', label: 'Floor gain', type: 'slider', min: 0, max: 0.2, step: 0.01, value: 0.05, hint: 'Minimum volume when gate is closed (0 = silence)' },
    ],
  },
  {
    id: 'spectral_denoise',
    name: 'Spectral Denoise',
    desc: 'Spectral gating to remove musical noise & artifacts',
    icon: '🧹',
    tag: '~1-2s',
    defaultEnabled: true,
    params: [
      { key: 'stationary', label: 'Mode', type: 'select', value: 'auto', options: [{ value: 'auto', label: 'Auto' }, { value: 'stationary', label: 'Stationary' }, { value: 'nonstationary', label: 'Non-stationary' }], hint: 'Vocal → non-stationary, Instrumental → stationary' },
      { key: 'prop_decrease', label: 'Noise reduction strength', type: 'slider', min: 0.0, max: 1.0, step: 0.05, value: 0.3, hint: '0.0 = none, 1.0 = maximum (may lose detail)' },
      { key: 'n_fft', label: 'FFT size', type: 'select', value: '2048', options: [{ value: '1024', label: '1024 (fast)' }, { value: '2048', label: '2048 (balanced)' }, { value: '4096', label: '4096 (precise)' }] },
    ],
  },
  {
    id: 'highfreq_restore',
    name: 'High-Freq Restore',
    desc: 'Restore lost high frequencies (sibilance, air)',
    icon: '📡',
    tag: '~0.5s',
    defaultEnabled: true,
    params: [
      { key: 'cutoff_detect_threshold_db', label: 'Detection threshold', type: 'slider', min: -60, max: -20, step: 5, value: -40, unit: ' dB' },
      { key: 'mirror_gain_db', label: 'Restore gain', type: 'slider', min: -24, max: 0, step: 1, value: -12, unit: ' dB', hint: '-12dB = natural, 0dB = maximum' },
      { key: 'filter_order', label: 'Filter order', type: 'select', value: '4', options: [{ value: '2', label: '2nd (gentle)' }, { value: '4', label: '4th (default)' }, { value: '6', label: '6th (sharp)' }] },
    ],
  },
  {
    id: 'artifact_smooth',
    name: 'Artifact Smoothing',
    desc: 'Smooth spectrogram to remove residual musical noise',
    icon: '✨',
    tag: '~1s',
    defaultEnabled: false,
    params: [
      { key: 'filter_size', label: 'Median filter size', type: 'select', value: '3', options: [{ value: '3', label: '3×3 (light)' }, { value: '5', label: '5×5 (medium)' }, { value: '7', label: '7×7 (strong)' }] },
      { key: 'mask_min', label: 'Mask floor', type: 'slider', min: 0.0, max: 0.8, step: 0.05, value: 0.5, hint: 'Min mask value, higher = gentler (0.5 recommended)' },
      { key: 'n_fft', label: 'STFT window', type: 'select', value: '2048', options: [{ value: '1024', label: '1024' }, { value: '2048', label: '2048' }, { value: '4096', label: '4096' }] },
    ],
  },
  {
    id: 'mixture_consistency',
    name: 'Mixture Consistency',
    desc: 'Ensure vocal + instrumental ≈ original after processing',
    icon: '⚖️',
    tag: '~0.5s',
    defaultEnabled: true,
    params: [
      { key: 'method', label: 'Residual method', type: 'select', value: 'energy_ratio', options: [{ value: 'energy_ratio', label: 'Energy ratio' }, { value: 'equal', label: 'Equal split' }, { value: 'target_only', label: 'Target only' }] },
      { key: 'max_correction_db', label: 'Max correction', type: 'slider', min: 0.5, max: 6.0, step: 0.5, value: 3.0, unit: ' dB', hint: 'Limit correction to avoid distortion' },
    ],
  },
  {
    id: 'loudness_norm',
    name: 'Loudness Normalize',
    desc: 'Normalize loudness per ITU-R BS.1770 (LUFS)',
    icon: '📊',
    tag: '~0.3s',
    defaultEnabled: true,
    params: [
      { key: 'target_lufs', label: 'Target loudness', type: 'slider', min: -24, max: -6, step: 1, value: -14, unit: ' LUFS', hint: 'Spotify/YouTube: -14, Apple: -16, CD: -9' },
      { key: 'peak_limit_db', label: 'True peak limit', type: 'slider', min: -3.0, max: 0.0, step: 0.1, value: -1.0, unit: ' dBTP' },
    ],
  },
  {
    id: 'ai_denoise',
    name: 'AI Denoise',
    desc: 'Deep neural network denoising (coming soon)',
    icon: '🧠',
    tag: 'Coming soon',
    defaultEnabled: false,
    disabled: true,
    params: [],
  },
];

export const PRESETS: Record<string, string[]> = {
  light: ['silence_gate', 'spectral_denoise', 'loudness_norm'],
  medium: ['silence_gate', 'spectral_denoise', 'highfreq_restore', 'mixture_consistency', 'loudness_norm'],
  aggressive: ['silence_gate', 'spectral_denoise', 'highfreq_restore', 'artifact_smooth', 'mixture_consistency', 'loudness_norm'],
};

export function createInitialSteps(): StepState[] {
  const lightIds = PRESETS.light;
  return ENHANCE_STEPS.map((s) => ({ ...s, enabled: lightIds.includes(s.id) }));
}

export function applyPreset(steps: StepState[], preset: string): StepState[] {
  const activeIds = PRESETS[preset] || [];
  return steps.map((s) => ({ ...s, enabled: activeIds.includes(s.id) }));
}

import type { ModelType } from '@/types';

export interface ModelConfig {
  id: ModelType;
  nameKey: string;
  descKey: string;
  stems: string[];
  sdr: string;
  speed: string;
  credit: string;
  cpuSupported: boolean;
}

export const MODELS: ModelConfig[] = [
  {
    id: 'demucs',
    nameKey: 'separation.modelDemucs',
    descKey: 'separation.modelDescDemucs',
    stems: ['vocals', 'drums', 'bass', 'other'],
    sdr: '7.33 dB SDR',
    speed: '11.6x RT',
    credit: '1-2',
    cpuSupported: true,
  },
  {
    id: 'demucs_ft',
    nameKey: 'separation.modelDemucsFt',
    descKey: 'separation.modelDescDemucsFt',
    stems: ['vocals', 'drums', 'bass', 'other'],
    sdr: '8.52 dB SDR',
    speed: '11.6x RT',
    credit: '1-2',
    cpuSupported: true,
  },
  {
    id: 'bs_roformer',
    nameKey: 'separation.modelBsRoformer',
    descKey: 'separation.modelDescBsRoformer',
    stems: ['vocals', 'instrumental'],
    sdr: '12.39 dB SDR',
    speed: '3.4x RT',
    credit: '1-2',
    cpuSupported: false,
  },
  {
    id: 'melband_roformer',
    nameKey: 'separation.modelMelbandRoformer',
    descKey: 'separation.modelDescMelbandRoformer',
    stems: ['vocals', 'instrumental'],
    sdr: '11.87 dB SDR',
    speed: '5.2x RT',
    credit: '1-2',
    cpuSupported: false,
  },
];

export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export const ALLOWED_FILE_TYPES = ['.wav', '.mp3', '.flac', '.ogg'];
export const ALLOWED_MIME_TYPES = [
  'audio/wav', 'audio/x-wav', 'audio/wave',
  'audio/mpeg', 'audio/mp3',
  'audio/flac', 'audio/x-flac',
  'audio/ogg', 'audio/vorbis',
];
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const CREDIT_PRESETS = [5, 10, 25, 50, 100];

export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  demucs: 'separation.modelDemucs',
  demucs_ft: 'separation.modelDemucsFt',
  bs_roformer: 'separation.modelBsRoformer',
  melband_roformer: 'separation.modelMelbandRoformer',
};

export const STATUS_CHART_COLORS: Record<string, string> = {
  pending: '#eab308',
  processing: '#3b82f6',
  completed: '#22c55e',
  failed: '#ef4444',
  cancelled: '#6b7280',
};

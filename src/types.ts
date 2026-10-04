export interface Settings {
  dpi: number;
  quality: number;
}

export const PRESETS = {
  low:      { label: 'Low',      hint: 'High quality',                dpi: 150, quality: 0.8 },
  balanced: { label: 'Balanced', hint: 'Recommended',                 dpi: 110, quality: 0.6 },
  strong:   { label: 'Strong',   hint: 'Smallest, for upload limits', dpi: 72,  quality: 0.4 },
} as const;

export type PresetKey = keyof typeof PRESETS;

export type WorkerIn =
  | { type: 'compress'; buffer: ArrayBuffer; settings: Settings; password?: string };

export type ResultMode = 'raster' | 'optimized' | 'original';

export type WorkerOut =
  | { type: 'progress'; page: number; total: number }
  | { type: 'done'; buffer: ArrayBuffer; mode: ResultMode; fellBack?: boolean }
  | { type: 'error'; code: 'PASSWORD_REQUIRED' | 'PASSWORD_INCORRECT' | 'INVALID' | 'OOM' | 'UNKNOWN'; message: string };

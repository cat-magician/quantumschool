import type { StageStatus } from '../lib/types';

export const STAGE_LABELS: Record<StageStatus, string> = {
  pending: 'Не начат',
  submitted: 'Отправлено',
  passed: 'Пройден',
  failed: 'Не пройден',
};

export const STAGE_OPTIONS: StageStatus[] = ['pending', 'submitted', 'passed', 'failed'];

export function studentInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';
}

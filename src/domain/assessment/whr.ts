import { DEFAULT_THRESHOLDS, type Gender, type Thresholds } from '@/infra/storage/schema';

export function computeWHR(waist_cm: number, hip_cm: number): number {
  if (!Number.isFinite(waist_cm) || !Number.isFinite(hip_cm) || hip_cm <= 0) {
    return Number.NaN;
  }
  return waist_cm / hip_cm;
}

export function classifyWHR(
  whr: number,
  gender: Gender,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): 'normal' | 'abnormal' {
  if (!Number.isFinite(whr)) return 'normal';
  const t = gender === 'female' ? thresholds.whr_female : thresholds.whr_male;
  return whr > t ? 'abnormal' : 'normal';
}

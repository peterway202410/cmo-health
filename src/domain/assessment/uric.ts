import { DEFAULT_THRESHOLDS, type Gender, type Thresholds } from '@/infra/storage/schema';

export function classifyUric(
  uric_umol: number,
  gender: Gender,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): 'normal' | 'abnormal' {
  if (!Number.isFinite(uric_umol)) return 'normal';
  const t = gender === 'female' ? thresholds.uric_female : thresholds.uric_male;
  return uric_umol > t ? 'abnormal' : 'normal';
}

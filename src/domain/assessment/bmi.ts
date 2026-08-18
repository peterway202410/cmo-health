import { DEFAULT_THRESHOLDS, type Thresholds } from '@/infra/storage/schema';

/**
 * BMI = 体重(kg) / (身高(cm)/100)²
 * 阈值默认为中国成人标准（24 / 28），可由 thresholds 覆盖。
 */
export function computeBMI(weight_kg: number, height_cm: number): number {
  if (!Number.isFinite(weight_kg) || !Number.isFinite(height_cm) || height_cm <= 0) {
    return Number.NaN;
  }
  const m = height_cm / 100;
  return weight_kg / (m * m);
}

export function classifyBMI(
  bmi: number,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): 'normal' | 'overweight' | 'obese' {
  if (!Number.isFinite(bmi)) return 'normal';
  if (bmi >= thresholds.bmi_obese) return 'obese';
  if (bmi >= thresholds.bmi_overweight) return 'overweight';
  return 'normal';
}

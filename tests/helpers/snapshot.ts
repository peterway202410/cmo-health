import { DEFAULT_THRESHOLDS, type Questionnaire } from '@/infra/storage/schema';
import type { AssessmentSnapshot } from '@/domain/assessment/types';

export function healthyQuestionnaire(
  overrides: Partial<Questionnaire> = {},
): Questionnaire {
  return {
    sleep_hours: 7.5,
    sleep_quality: 4,
    late_night_per_week: 0,
    sugary_drink_per_week: 0,
    midnight_snack_per_week: 0,
    takeout_per_week: 1,
    exercise_per_week: 3,
    sedentary_hours_per_day: 5,
    alcohol_per_week: 0,
    smoking: false,
    stress_level: 2,
    created_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

export function healthySnapshot(
  overrides: Partial<AssessmentSnapshot> = {},
): AssessmentSnapshot {
  return {
    birth_date: '1990-01-01',
    gender: 'male',
    height_cm: 175,
    has_hypertension: false,
    has_diabetes: false,
    now: '2026-08-18T00:00:00.000Z',
    latest: {
      weight: {
        weight_kg: 65,
        waist_cm: 80,
        hip_cm: 95,
        created_at: '2026-08-10T00:00:00.000Z',
      },
      bp: { systolic_mmHg: 118, diastolic_mmHg: 76, created_at: '2026-08-10T00:00:00.000Z' },
      glucose: { fpg_mmol_per_l: 5.2, created_at: '2026-08-10T00:00:00.000Z' },
      lipid: {
        tg_mmol_per_l: 1.1,
        hdl_mmol_per_l: 1.3,
        created_at: '2026-08-10T00:00:00.000Z',
      },
      uric: { uric_umol_per_l: 340, created_at: '2026-08-10T00:00:00.000Z' },
    },
    bpHistory: [],
    questionnaire: healthyQuestionnaire(),
    thresholds: { ...DEFAULT_THRESHOLDS },
    ...overrides,
  };
}

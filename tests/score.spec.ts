import { describe, expect, it } from 'vitest';
import { computeScore } from '@/domain/assessment/score';
import { healthySnapshot } from './helpers/snapshot';

describe('computeScore', () => {
  it('gives 100 when measurements and lifestyle are in range', () => {
    const { score, deductions } = computeScore(healthySnapshot());
    expect(deductions).toEqual([]);
    expect(score).toBe(100);
  });

  it('deducts 12 for diagnosed hypertension (metabolic syndrome item)', () => {
    const { score, deductions } = computeScore(
      healthySnapshot({ has_hypertension: true }),
    );
    expect(deductions.some((d) => d.factor === 'hypertension' && d.points === 12)).toBe(
      true,
    );
    expect(score).toBe(88);
  });

  it('deducts 6 for high BMI', () => {
    const base = healthySnapshot();
    const { score, deductions } = computeScore({
      ...base,
      latest: {
        ...base.latest,
        weight: { ...base.latest.weight!, weight_kg: 90 },
      },
    });
    expect(deductions.some((d) => d.factor === 'bmi' && d.points === 6)).toBe(true);
    expect(score).toBe(94);
  });

  it('caps lifestyle deductions at 20', () => {
    const { score, deductions } = computeScore(
      healthySnapshot({
        questionnaire: {
          sleep_hours: 5,
          sleep_quality: 1,
          late_night_per_week: 6,
          sugary_drink_per_week: 8,
          midnight_snack_per_week: 5,
          takeout_per_week: 8,
          exercise_per_week: 0,
          sedentary_hours_per_day: 10,
          alcohol_per_week: 5,
          smoking: true,
          stress_level: 5,
          created_at: '2026-08-01T00:00:00.000Z',
        },
      }),
    );
    const lifestyle = deductions.filter((d) => d.module === 'lifestyle');
    const lifestylePoints = lifestyle.reduce((sum, d) => sum + d.points, 0);
    expect(lifestylePoints).toBe(20);
    expect(score).toBe(80);
  });
});

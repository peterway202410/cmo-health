import { describe, expect, it } from 'vitest';
import { classifyBMI, computeBMI } from '@/domain/assessment/bmi';
import { DEFAULT_THRESHOLDS } from '@/infra/storage/schema';

describe('computeBMI', () => {
  it('uses kg and height in cm', () => {
    expect(computeBMI(70, 175)).toBeCloseTo(22.857, 3);
  });

  it('returns NaN when height is not positive', () => {
    expect(Number.isNaN(computeBMI(70, 0))).toBe(true);
    expect(Number.isNaN(computeBMI(70, -1))).toBe(true);
  });
});

describe('classifyBMI', () => {
  it('uses Chinese adult cutoffs by default (24 / 28)', () => {
    expect(classifyBMI(23.9)).toBe('normal');
    expect(classifyBMI(24)).toBe('overweight');
    expect(classifyBMI(27.9)).toBe('overweight');
    expect(classifyBMI(28)).toBe('obese');
  });

  it('treats underweight as normal in the current two-threshold model', () => {
    expect(classifyBMI(17)).toBe('normal');
  });

  it('honors custom thresholds', () => {
    const who = { ...DEFAULT_THRESHOLDS, bmi_overweight: 25, bmi_obese: 30 };
    expect(classifyBMI(24.5, who)).toBe('normal');
    expect(classifyBMI(25, who)).toBe('overweight');
    expect(classifyBMI(30, who)).toBe('obese');
  });
});

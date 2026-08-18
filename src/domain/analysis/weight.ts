// 体重评估算法（纯函数）。

import type { Gender, WeightRecord } from '@/infra/storage/schema';
import { ageFromBirth } from '@/utils/date';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active'
  | 'unknown';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
  unknown: 1.2,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: '久坐少动',
  light: '轻度活动',
  moderate: '中度活动',
  active: '高强度活动',
  very_active: '极高强度活动',
  unknown: '未知',
};

// —— 数据补全：每个字段独立从最新记录往前找 ——
export interface BackfilledFields {
  weight_kg?: number;
  waist_cm?: number;
  hip_cm?: number;
  weight_at?: string;
  waist_at?: string;
  hip_at?: string;
}

export function backfillFields(records: WeightRecord[]): BackfilledFields {
  const desc = [...records].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const find = <K extends 'weight_kg' | 'waist_cm' | 'hip_cm'>(
    key: K,
  ): { val?: number; at?: string } => {
    for (const r of desc) {
      const v = r[key];
      if (typeof v === 'number' && Number.isFinite(v)) return { val: v, at: r.created_at };
    }
    return {};
  };
  const w = find('weight_kg');
  const wa = find('waist_cm');
  const h = find('hip_cm');
  return {
    weight_kg: w.val,
    waist_cm: wa.val,
    hip_cm: h.val,
    weight_at: w.at,
    waist_at: wa.at,
    hip_at: h.at,
  };
}

// —— BMI ——
export function computeBMI(weight_kg: number, height_cm: number): number {
  if (!Number.isFinite(weight_kg) || !Number.isFinite(height_cm) || height_cm <= 0) {
    return Number.NaN;
  }
  const m = height_cm / 100;
  return +(weight_kg / (m * m)).toFixed(1);
}

export type BMILevel = 'thin' | 'normal' | 'overweight' | 'obese';

export function classifyBMI(bmi: number): { level: BMILevel; label: string } {
  if (!Number.isFinite(bmi)) return { level: 'normal', label: '—' };
  if (bmi < 18.5) return { level: 'thin', label: '偏瘦' };
  if (bmi < 24.0) return { level: 'normal', label: '正常' };
  if (bmi < 28.0) return { level: 'overweight', label: '超重' };
  return { level: 'obese', label: '肥胖' };
}

// —— BMR (Mifflin-St Jeor) ——
export function computeBMR(
  weight_kg: number,
  height_cm: number,
  age: number,
  gender: Gender | undefined,
): number {
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  if (gender === 'male') return Math.round(base + 5);
  if (gender === 'female') return Math.round(base - 161);
  return Math.round(base - 78);
}

// —— WHR ——
export function computeWHR(waist_cm: number, hip_cm: number): number {
  if (!Number.isFinite(waist_cm) || !Number.isFinite(hip_cm) || hip_cm <= 0) {
    return Number.NaN;
  }
  return +(waist_cm / hip_cm).toFixed(2);
}

export type WHRLevel = 'normal' | 'central';
export function classifyWHR(whr: number, gender: Gender): { level: WHRLevel; label: string } {
  if (!Number.isFinite(whr)) return { level: 'normal', label: '—' };
  const t = gender === 'female' ? 0.85 : 0.9;
  return whr >= t
    ? { level: 'central', label: '中心性肥胖' }
    : { level: 'normal', label: '正常' };
}

// —— WHtR ——
export function computeWHtR(waist_cm: number, height_cm: number): number {
  if (!Number.isFinite(waist_cm) || !Number.isFinite(height_cm) || height_cm <= 0) {
    return Number.NaN;
  }
  return +(waist_cm / height_cm).toFixed(2);
}

export type WHtRLevel = 'normal' | 'elevated' | 'high';
export function classifyWHtR(v: number): { level: WHtRLevel; label: string } {
  if (!Number.isFinite(v)) return { level: 'normal', label: '—' };
  if (v < 0.5) return { level: 'normal', label: '正常' };
  if (v < 0.6) return { level: 'elevated', label: '风险升高' };
  return { level: 'high', label: '高风险' };
}

// —— TDEE ——
export function computeTDEE(bmr: number, activity: ActivityLevel = 'unknown'): number {
  return Math.round(bmr * ACTIVITY_FACTORS[activity]);
}

export function idealWeightRange(height_cm: number): { lo: number; hi: number } | null {
  if (!Number.isFinite(height_cm) || height_cm <= 0) return null;
  const m = height_cm / 100;
  return { lo: +(18.5 * m * m).toFixed(1), hi: +(23.9 * m * m).toFixed(1) };
}

// —— 夜间体重回落率 ——
export interface NightDropPair {
  bedtime: { weight_kg: number; created_at: string };
  morning: { weight_kg: number; created_at: string };
  hours: number; // 间隔小时
  ratePct: number; // (bed - morning) / bed * 100
}

export function computeNightDrops(records: WeightRecord[]): NightDropPair[] {
  const filtered = records
    .filter(
      (r) =>
        typeof r.weight_kg === 'number' &&
        Number.isFinite(r.weight_kg) &&
        (r.period === 'bedtime' || r.period === 'morning'),
    )
    .sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

  const pairs: NightDropPair[] = [];
  let i = 0;
  while (i < filtered.length) {
    const cur = filtered[i];
    if (cur.period === 'bedtime') {
      // 顺序找下一条 morning
      let j = i + 1;
      while (j < filtered.length && filtered[j].period !== 'morning') j++;
      if (j < filtered.length) {
        const next = filtered[j];
        const hours =
          (new Date(next.created_at).getTime() - new Date(cur.created_at).getTime()) /
          3600000;
        if (hours > 0 && hours <= 14) {
          const bw = cur.weight_kg!;
          const mw = next.weight_kg!;
          pairs.push({
            bedtime: { weight_kg: bw, created_at: cur.created_at },
            morning: { weight_kg: mw, created_at: next.created_at },
            hours: +hours.toFixed(1),
            ratePct: +(((bw - mw) / bw) * 100).toFixed(2),
          });
          i = j + 1;
          continue;
        }
      }
    }
    i++;
  }
  return pairs;
}

export type NightDropLevel = 'no' | 'low' | 'normal' | 'fast';

export function classifyNightDrop(rate: number): { level: NightDropLevel; label: string } {
  if (rate <= 0) return { level: 'no', label: '体重未回落' };
  if (rate < 0.5) return { level: 'low', label: '低速节能 / 锁水状态' };
  if (rate <= 1.2) return { level: 'normal', label: '正常范围' };
  return { level: 'fast', label: '快速排水阶段' };
}

export function nightDropAlert(pairs: NightDropPair[]): string | null {
  if (pairs.length < 3) return null;
  const avg = pairs.reduce((s, p) => s + p.ratePct, 0) / pairs.length;
  if (avg < 0.4) return '多组平均回落率偏低，需警惕代谢受损';
  if (avg > 1.2) return '多组平均回落率偏高，需警惕肌肉流失与脱水';
  return null;
}

// —— 综合风险等级 ——
export type RiskLevel = 'low' | 'medium' | 'high';

export function comprehensiveRisk(input: {
  bmi?: number;
  waist_cm?: number;
  whtr?: number;
  gender: Gender;
}): { level: RiskLevel; reasons: string[] } {
  const reasons: string[] = [];
  let high = false;
  let medium = false;

  if (input.bmi != null) {
    if (input.bmi >= 28) {
      high = true;
      reasons.push('BMI ≥ 28（肥胖）');
    } else if (input.bmi >= 24) {
      medium = true;
      reasons.push('BMI 24-27.9（超重）');
    }
  }

  if (input.waist_cm != null) {
    if (input.gender === 'male' && input.waist_cm >= 90) {
      high = true;
      reasons.push(`男性腰围 ${input.waist_cm} ≥ 90 cm`);
    }
    if (input.gender === 'female' && input.waist_cm >= 85) {
      high = true;
      reasons.push(`女性腰围 ${input.waist_cm} ≥ 85 cm`);
    }
  }

  if (input.whtr != null) {
    if (input.whtr >= 0.6) {
      high = true;
      reasons.push('WHtR ≥ 0.60');
    } else if (input.whtr >= 0.5) {
      if (!high && !medium) {
        medium = true;
        reasons.push('WHtR 0.50-0.59');
      }
    }
  }

  if (high) return { level: 'high', reasons };
  if (medium) return { level: 'medium', reasons };
  return { level: 'low', reasons: ['各项指标在合理范围'] };
}

// —— 综合意见 ——
export function comprehensiveOpinion(bmiLevel: BMILevel, whrLevel: WHRLevel | null): string {
  if (bmiLevel === 'thin') {
    return '建议排查消瘦原因，结合营养评估制定增肌增重方案。';
  }
  if (bmiLevel === 'normal') {
    if (whrLevel === 'central') {
      return '虽然 BMI 正常，但腰臀比偏高提示隐性肥胖。建议针对腹部做减脂训练 + 力量训练。';
    }
    return '体型与脂肪分布良好，继续保持目前的饮食与运动习惯。';
  }
  if (bmiLevel === 'overweight' || bmiLevel === 'obese') {
    if (whrLevel === 'central') {
      return '体重与腹部脂肪都偏高，建议系统性减重：饮食控制 + 有氧 + 力量训练。';
    }
    return '体重偏高但脂肪分布尚可，建议科学减重，避免过度节食导致肌肉流失。';
  }
  return '建议关注体重趋势，结合多项指标综合评估。';
}

// —— 顶层组合 ——
export interface WeightAssessmentInput {
  birth_date: string;
  gender: Gender;
  height_cm: number;
  records: WeightRecord[];
  activity?: ActivityLevel;
  now: string;
}

export interface WeightAssessmentResult {
  age: number;
  height_cm: number;
  weight_kg?: number;
  waist_cm?: number;
  hip_cm?: number;
  weight_at?: string;
  waist_at?: string;
  hip_at?: string;
  bmi?: { value: number; level: BMILevel; label: string };
  bmr?: number;
  whr?: { value: number; level: WHRLevel; label: string };
  whtr?: { value: number; level: WHtRLevel; label: string };
  tdee?: number;
  ideal?: { lo: number; hi: number };
  nightDrops: NightDropPair[];
  latestNightDrop?: { rate: number; level: NightDropLevel; label: string; pair: NightDropPair };
  nightAlert: string | null;
  risk: { level: RiskLevel; reasons: string[] };
  opinion: string;
}

export function assessWeight(input: WeightAssessmentInput): WeightAssessmentResult {
  const age = ageFromBirth(input.birth_date, input.now);
  const filled = backfillFields(input.records);

  let bmi: WeightAssessmentResult['bmi'];
  if (filled.weight_kg != null && input.height_cm > 0) {
    const v = computeBMI(filled.weight_kg, input.height_cm);
    if (Number.isFinite(v)) {
      const c = classifyBMI(v);
      bmi = { value: v, level: c.level, label: c.label };
    }
  }

  let bmr: number | undefined;
  if (filled.weight_kg != null && input.height_cm > 0) {
    bmr = computeBMR(filled.weight_kg, input.height_cm, age, input.gender);
  }

  let whr: WeightAssessmentResult['whr'];
  if (filled.waist_cm != null && filled.hip_cm != null) {
    const v = computeWHR(filled.waist_cm, filled.hip_cm);
    if (Number.isFinite(v)) {
      const c = classifyWHR(v, input.gender);
      whr = { value: v, level: c.level, label: c.label };
    }
  }

  let whtr: WeightAssessmentResult['whtr'];
  if (filled.waist_cm != null && input.height_cm > 0) {
    const v = computeWHtR(filled.waist_cm, input.height_cm);
    if (Number.isFinite(v)) {
      const c = classifyWHtR(v);
      whtr = { value: v, level: c.level, label: c.label };
    }
  }

  const tdee = bmr != null ? computeTDEE(bmr, input.activity ?? 'unknown') : undefined;
  const ideal = idealWeightRange(input.height_cm) ?? undefined;

  const nightDrops = computeNightDrops(input.records);
  const latestPair = nightDrops.length ? nightDrops[nightDrops.length - 1] : undefined;
  const latestNightDrop = latestPair
    ? (() => {
        const c = classifyNightDrop(latestPair.ratePct);
        return { rate: latestPair.ratePct, level: c.level, label: c.label, pair: latestPair };
      })()
    : undefined;

  const risk = comprehensiveRisk({
    bmi: bmi?.value,
    waist_cm: filled.waist_cm,
    whtr: whtr?.value,
    gender: input.gender,
  });

  const opinion = comprehensiveOpinion(bmi?.level ?? 'normal', whr?.level ?? null);

  return {
    age,
    height_cm: input.height_cm,
    weight_kg: filled.weight_kg,
    waist_cm: filled.waist_cm,
    hip_cm: filled.hip_cm,
    weight_at: filled.weight_at,
    waist_at: filled.waist_at,
    hip_at: filled.hip_at,
    bmi,
    bmr,
    whr,
    whtr,
    tdee,
    ideal,
    nightDrops,
    latestNightDrop,
    nightAlert: nightDropAlert(nightDrops),
    risk,
    opinion,
  };
}

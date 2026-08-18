// 代谢评分（扣分制）。详见 design.md「评分算法（落地公式）」。
import type { AssessmentSnapshot, ScoreDeduction } from './types';
import { evaluateMetS } from './metabolicSyndrome';
import { computeBMI, classifyBMI } from './bmi';
import { computeWHR, classifyWHR } from './whr';
import { classifyUric } from './uric';

const MOD_CAP = {
  mets: 60,
  bmi_whr: 12,
  uric: 8,
  lifestyle: 20,
} as const;

function safeNum(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function applyCap(items: ScoreDeduction[], cap: number): ScoreDeduction[] {
  let used = 0;
  const out: ScoreDeduction[] = [];
  for (const it of items) {
    if (used >= cap) break;
    const remaining = cap - used;
    if (it.points <= remaining) {
      out.push(it);
      used += it.points;
    } else {
      out.push({ ...it, points: remaining });
      used = cap;
    }
  }
  return out;
}

export function computeScore(s: AssessmentSnapshot): {
  score: number;
  deductions: ScoreDeduction[];
} {
  const deductions: ScoreDeduction[] = [];

  // —— 代谢综合征 5 项，每项 12 分 ——
  const mets = evaluateMetS(s);
  const metsDeductions: ScoreDeduction[] = mets.items
    .filter((it) => it.matched)
    .map((it) => ({
      module: 'mets' as const,
      factor: it.key,
      points: 12,
      reason: it.label + (it.source === 'diagnosed' ? '（已确诊）' : ''),
    }));
  deductions.push(...applyCap(metsDeductions, MOD_CAP.mets));

  // —— BMI / WHR ——
  const bmiWhrDeductions: ScoreDeduction[] = [];
  const weight = safeNum(s.latest.weight?.weight_kg);
  if (weight !== undefined && Number.isFinite(s.height_cm) && s.height_cm > 0) {
    const bmi = computeBMI(weight, s.height_cm);
    if (Number.isFinite(bmi) && classifyBMI(bmi, s.thresholds) !== 'normal') {
      bmiWhrDeductions.push({
        module: 'bmi_whr',
        factor: 'bmi',
        points: 6,
        reason: `BMI ${bmi.toFixed(1)} 偏高`,
      });
    }
  }
  const waist = safeNum(s.latest.weight?.waist_cm);
  const hip = safeNum(s.latest.weight?.hip_cm);
  if (waist !== undefined && hip !== undefined) {
    const whr = computeWHR(waist, hip);
    if (Number.isFinite(whr) && classifyWHR(whr, s.gender, s.thresholds) === 'abnormal') {
      bmiWhrDeductions.push({
        module: 'bmi_whr',
        factor: 'whr',
        points: 6,
        reason: `腰臀比 ${whr.toFixed(2)} 偏高`,
      });
    }
  }
  deductions.push(...applyCap(bmiWhrDeductions, MOD_CAP.bmi_whr));

  // —— 尿酸 ——
  const uric = safeNum(s.latest.uric?.uric_umol_per_l);
  if (uric !== undefined && classifyUric(uric, s.gender, s.thresholds) === 'abnormal') {
    deductions.push({
      module: 'uric',
      factor: 'uric',
      points: MOD_CAP.uric,
      reason: `血尿酸 ${uric} μmol/L 偏高`,
    });
  }

  // —— 生活方式 ——
  const q = s.questionnaire;
  const lifestyleDeductions: ScoreDeduction[] = [];
  if (q) {
    if (q.late_night_per_week >= 5) {
      lifestyleDeductions.push({
        module: 'lifestyle',
        factor: 'late_night',
        points: 4,
        reason: '熬夜频繁',
      });
    } else if (q.late_night_per_week >= 3) {
      lifestyleDeductions.push({
        module: 'lifestyle',
        factor: 'late_night',
        points: 3,
        reason: '熬夜偏多',
      });
    }
    if (q.takeout_per_week >= 7) {
      lifestyleDeductions.push({
        module: 'lifestyle',
        factor: 'takeout',
        points: 3,
        reason: '外卖频次过高',
      });
    }
    if (q.sugary_drink_per_week >= 7) {
      lifestyleDeductions.push({
        module: 'lifestyle',
        factor: 'sugary_drink',
        points: 3,
        reason: '含糖饮料摄入过多',
      });
    }
    if (q.sedentary_hours_per_day >= 8) {
      lifestyleDeductions.push({
        module: 'lifestyle',
        factor: 'sedentary',
        points: 3,
        reason: '久坐时间过长',
      });
    }
    if (q.exercise_per_week < 2) {
      lifestyleDeductions.push({
        module: 'lifestyle',
        factor: 'exercise',
        points: 3,
        reason: '运动严重不足',
      });
    }
    if (q.alcohol_per_week >= 4) {
      lifestyleDeductions.push({
        module: 'lifestyle',
        factor: 'alcohol',
        points: 2,
        reason: '饮酒频次偏高',
      });
    }
    if (q.smoking) {
      lifestyleDeductions.push({
        module: 'lifestyle',
        factor: 'smoking',
        points: 4,
        reason: '吸烟',
      });
    }
    if (q.stress_level >= 4) {
      lifestyleDeductions.push({
        module: 'lifestyle',
        factor: 'stress',
        points: 2,
        reason: '压力水平偏高',
      });
    }
    if (q.midnight_snack_per_week >= 3) {
      lifestyleDeductions.push({
        module: 'lifestyle',
        factor: 'midnight_snack',
        points: 2,
        reason: '夜宵频率偏高',
      });
    }
    if (q.sleep_quality <= 2) {
      lifestyleDeductions.push({
        module: 'lifestyle',
        factor: 'sleep_quality',
        points: 2,
        reason: '睡眠质量较差',
      });
    }
  }
  deductions.push(...applyCap(lifestyleDeductions, MOD_CAP.lifestyle));

  const total = deductions.reduce((sum, d) => sum + d.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - total)));

  return { score, deductions };
}

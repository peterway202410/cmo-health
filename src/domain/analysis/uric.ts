// 尿酸评估算法（纯函数）。

import type { Gender, UricRecord } from '@/infra/storage/schema';

export type UricLevel =
  | 'too_low'
  | 'treatment_lower'
  | 'goal_gout'
  | 'goal_normal'
  | 'normal_high'
  | 'suspected'
  | 'suspected_treat'
  | 'severe';

export type UricRisk = 'good' | 'medium' | 'high';

export interface UricClassify {
  level: UricLevel;
  label: string;
  risk: UricRisk;
}

export function classifyUricMale(v: number): UricClassify {
  if (v < 120) return { level: 'too_low', label: '过低', risk: 'high' };
  if (v < 180) return { level: 'treatment_lower', label: '降尿酸治疗下限', risk: 'medium' };
  if (v < 300) return { level: 'goal_gout', label: '痛风达标值（溶石点）', risk: 'good' };
  if (v < 360) return { level: 'goal_normal', label: '普通达标值（溶晶点）', risk: 'good' };
  if (v < 420) return { level: 'normal_high', label: '正常高值', risk: 'medium' };
  if (v < 540) return { level: 'suspected', label: '疑似高尿酸血症', risk: 'medium' };
  if (v < 700) return { level: 'suspected_treat', label: '疑似高尿酸血症（需治疗）', risk: 'high' };
  return { level: 'severe', label: '重度高尿酸血症', risk: 'high' };
}

export function classifyUricFemale(v: number): UricClassify {
  if (v < 120) return { level: 'too_low', label: '过低', risk: 'high' };
  if (v < 180) return { level: 'treatment_lower', label: '降尿酸治疗下限', risk: 'medium' };
  if (v < 300) return { level: 'goal_normal', label: '普通达标值（溶晶点）', risk: 'good' };
  if (v < 360) return { level: 'normal_high', label: '正常高值', risk: 'medium' };
  if (v < 420) return { level: 'suspected', label: '疑似高尿酸血症', risk: 'medium' };
  if (v < 700) return { level: 'suspected_treat', label: '疑似高尿酸血症（需治疗）', risk: 'high' };
  return { level: 'severe', label: '重度高尿酸血症', risk: 'high' };
}

export function classifyUric(v: number, gender: Gender): UricClassify {
  return gender === 'female' ? classifyUricFemale(v) : classifyUricMale(v);
}

// —— 趋势 ——

export type TrendDir = 'up' | 'down' | 'stable' | 'insufficient';

export function uricTrend(records: UricRecord[]): {
  dir: TrendDir;
  diff: number | null;
} {
  const sortedAsc = [...records].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  if (sortedAsc.length < 2) return { dir: 'insufficient', diff: null };
  const head = sortedAsc.slice(0, Math.min(3, sortedAsc.length)).map((r) => r.uric_umol_per_l);
  const tail = sortedAsc.slice(-Math.min(3, sortedAsc.length)).map((r) => r.uric_umol_per_l);
  const headAvg = head.reduce((s, v) => s + v, 0) / head.length;
  const tailAvg = tail.reduce((s, v) => s + v, 0) / tail.length;
  const diff = +(tailAvg - headAvg).toFixed(1);
  let dir: TrendDir;
  if (diff > 20) dir = 'up';
  else if (diff < -20) dir = 'down';
  else dir = 'stable';
  return { dir, diff };
}

// —— 顶层组合 ——

export interface UricAssessmentInput {
  records: UricRecord[];
  gender: Gender;
}

export interface UricAssessmentResult {
  hasData: boolean;
  count: number;
  latest: UricRecord | null;
  classify: UricClassify | null;
  trend: { dir: TrendDir; diff: number | null };
  stats: {
    avg: number | null;
    min: number | null;
    max: number | null;
  };
}

export function assessUric(input: UricAssessmentInput): UricAssessmentResult {
  const records = [...input.records].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const latest = records.length ? records[records.length - 1] : null;
  const classify = latest ? classifyUric(latest.uric_umol_per_l, input.gender) : null;
  const trend = uricTrend(records);

  const xs = records.map((r) => r.uric_umol_per_l);
  const stats = xs.length
    ? {
        avg: +(xs.reduce((s, v) => s + v, 0) / xs.length).toFixed(0),
        min: Math.min(...xs),
        max: Math.max(...xs),
      }
    : { avg: null, min: null, max: null };

  return {
    hasData: records.length > 0,
    count: records.length,
    latest,
    classify,
    trend,
    stats,
  };
}

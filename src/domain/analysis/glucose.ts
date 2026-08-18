// 血糖评估算法（纯函数）。详见「评估算法文档.md 三、血糖评估」。

import type { GlucoseRecord } from '@/infra/storage/schema';

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** 同日合并：取最新一条（直接覆盖） */
export function mergeGlucoseByDay(records: GlucoseRecord[]): GlucoseRecord[] {
  const sortedAsc = [...records].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const map = new Map<string, GlucoseRecord>();
  for (const r of sortedAsc) {
    map.set(dayKey(r.created_at), r); // 同日后写覆盖前
  }
  return [...map.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

// —— 综合状态判定 ——

export type GlucoseStatus =
  | 'low'
  | 'diabetes'
  | 'ifg'
  | 'igt'
  | 'normal'
  | 'unavailable';

export const GLUCOSE_STATUS_INFO: Record<
  GlucoseStatus,
  { label: string; risk: 'good' | 'warn' | 'bad' | 'muted'; sub: string }
> = {
  low: { label: '疑似低血糖', risk: 'bad', sub: '空腹血糖 ≤ 3.9 mmol/L' },
  diabetes: {
    label: '达到糖尿病诊断标准',
    risk: 'bad',
    sub: '空腹 ≥ 7.0 或 餐后 ≥ 11.1 或 HbA1c ≥ 6.5%',
  },
  ifg: { label: '空腹血糖受损 (IFG)', risk: 'warn', sub: '空腹 6.1-6.9 mmol/L' },
  igt: { label: '糖耐量减低 (IGT)', risk: 'warn', sub: '餐后 7.8-11.0 mmol/L' },
  normal: { label: '血糖正常', risk: 'good', sub: '所有指标在正常范围' },
  unavailable: { label: '数据不足', risk: 'muted', sub: '请先录入血糖' },
};

export function classifyOverall(rec: GlucoseRecord | null): GlucoseStatus {
  if (!rec) return 'unavailable';
  const fpg = num(rec.fpg_mmol_per_l);
  const pp = num(rec.pp2h_mmol_per_l);
  const hb = num(rec.hba1c_pct);

  // 1. 低血糖
  if (fpg !== null && fpg <= 3.9) return 'low';
  // 2. 糖尿病
  if (
    (fpg !== null && fpg >= 7.0) ||
    (pp !== null && pp >= 11.1) ||
    (hb !== null && hb >= 6.5)
  ) {
    return 'diabetes';
  }
  // 3. IFG
  if (fpg !== null && fpg >= 6.1 && fpg < 7.0 && (pp === null || pp < 7.8)) {
    return 'ifg';
  }
  // 4. IGT
  if ((fpg === null || fpg < 7.0) && pp !== null && pp >= 7.8 && pp < 11.1) {
    return 'igt';
  }
  // 5. 正常
  if (
    (fpg === null || fpg < 6.1) &&
    (pp === null || pp < 7.8) &&
    (fpg !== null || pp !== null || hb !== null)
  ) {
    return 'normal';
  }
  return 'unavailable';
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// —— 单项分级 ——

export type FieldRisk = 'good' | 'warn' | 'bad';

export function classifyFPG(v: number): { label: string; risk: FieldRisk } {
  if (v <= 3.9) return { label: '低血糖', risk: 'bad' };
  if (v < 6.1) return { label: '正常', risk: 'good' };
  if (v < 7.0) return { label: '空腹血糖受损', risk: 'warn' };
  return { label: '糖尿病', risk: 'bad' };
}

export function classifyPP(v: number): { label: string; risk: FieldRisk } {
  if (v < 7.8) return { label: '正常', risk: 'good' };
  if (v < 11.1) return { label: '糖耐量减低', risk: 'warn' };
  return { label: '糖尿病', risk: 'bad' };
}

export function classifyHbA1c(v: number): { label: string; risk: FieldRisk } {
  if (v < 5.7) return { label: '正常', risk: 'good' };
  if (v < 6.5) return { label: '糖尿病前期', risk: 'warn' };
  return { label: '糖尿病', risk: 'bad' };
}

// —— 趋势：基于非同日合并后的空腹血糖序列 ——

export type TrendDir = 'up' | 'down' | 'stable' | 'insufficient';

export function fpgTrend(merged: GlucoseRecord[]): {
  dir: TrendDir;
  diff: number | null;
} {
  const fpgs = merged
    .filter((r) => typeof r.fpg_mmol_per_l === 'number' && Number.isFinite(r.fpg_mmol_per_l))
    .map((r) => r.fpg_mmol_per_l!);
  if (fpgs.length < 2) return { dir: 'insufficient', diff: null };
  const head = fpgs.slice(0, Math.min(3, fpgs.length));
  const tail = fpgs.slice(-Math.min(3, fpgs.length));
  const headAvg = head.reduce((s, v) => s + v, 0) / head.length;
  const tailAvg = tail.reduce((s, v) => s + v, 0) / tail.length;
  const diff = +(tailAvg - headAvg).toFixed(2);
  let dir: TrendDir;
  if (diff > 0.5) dir = 'up';
  else if (diff < -0.5) dir = 'down';
  else dir = 'stable';
  return { dir, diff };
}

// —— 顶层组合 ——

export interface GlucoseAssessmentInput {
  records: GlucoseRecord[];
}

export interface GlucoseAssessmentResult {
  hasData: boolean;
  count: number;
  latest: GlucoseRecord | null;
  status: GlucoseStatus;
  statusInfo: (typeof GLUCOSE_STATUS_INFO)[GlucoseStatus];
  fields: {
    fpg: { value: number | null; label?: string; risk?: FieldRisk };
    pp2h: { value: number | null; label?: string; risk?: FieldRisk };
    hba1c: { value: number | null; label?: string; risk?: FieldRisk };
  };
  trend: { dir: TrendDir; diff: number | null };
  merged: GlucoseRecord[];
}

export function assessGlucose(input: GlucoseAssessmentInput): GlucoseAssessmentResult {
  const records = [...input.records].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const merged = mergeGlucoseByDay(records);
  const latest = records.length ? records[records.length - 1] : null;
  const status = classifyOverall(latest);

  const fpgVal = num(latest?.fpg_mmol_per_l);
  const ppVal = num(latest?.pp2h_mmol_per_l);
  const hbVal = num(latest?.hba1c_pct);

  return {
    hasData: records.length > 0,
    count: records.length,
    latest,
    status,
    statusInfo: GLUCOSE_STATUS_INFO[status],
    fields: {
      fpg: fpgVal !== null
        ? { value: fpgVal, ...classifyFPG(fpgVal) }
        : { value: null },
      pp2h: ppVal !== null
        ? { value: ppVal, ...classifyPP(ppVal) }
        : { value: null },
      hba1c: hbVal !== null
        ? { value: hbVal, ...classifyHbA1c(hbVal) }
        : { value: null },
    },
    trend: fpgTrend(merged),
    merged,
  };
}

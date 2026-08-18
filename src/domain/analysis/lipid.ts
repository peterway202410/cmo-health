// 血脂评估算法（纯函数）。详见「评估算法文档.md 四、血脂评估」。

import type { LipidRecord } from '@/infra/storage/schema';

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** 同日合并：取最新一条（直接覆盖） */
export function mergeLipidByDay(records: LipidRecord[]): LipidRecord[] {
  const sortedAsc = [...records].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const map = new Map<string, LipidRecord>();
  for (const r of sortedAsc) map.set(dayKey(r.created_at), r);
  return [...map.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// —— 单项分级 ——

export type FieldLevel = 'good' | 'borderline' | 'bad';

export interface FieldClassify {
  label: string;
  level: FieldLevel;
}

export function classifyTC(v: number): FieldClassify {
  if (v < 5.2) return { label: '合适水平', level: 'good' };
  if (v < 6.2) return { label: '边缘升高', level: 'borderline' };
  return { label: '升高', level: 'bad' };
}

export function classifyTG(v: number): FieldClassify {
  if (v < 1.7) return { label: '合适水平', level: 'good' };
  if (v < 2.3) return { label: '边缘升高', level: 'borderline' };
  return { label: '升高', level: 'bad' };
}

export function classifyLDL(v: number): FieldClassify {
  if (v < 3.4) return { label: '合适水平', level: 'good' };
  if (v < 4.1) return { label: '边缘升高', level: 'borderline' };
  return { label: '升高', level: 'bad' };
}

/** HDL 越高越好 */
export function classifyHDL(v: number): FieldClassify {
  if (v >= 1.0) return { label: '正常', level: 'good' };
  return { label: '降低', level: 'bad' };
}

// —— 综合状态判定 ——

export type LipidStatus =
  | 'normal'
  | 'mixed_with_low_hdl'
  | 'high_chol_with_low_hdl'
  | 'high_tg_with_low_hdl'
  | 'low_hdl_only'
  | 'mixed'
  | 'high_chol'
  | 'high_tg'
  | 'borderline'
  | 'unavailable';

export const LIPID_STATUS_INFO: Record<
  LipidStatus,
  { label: string; risk: 'good' | 'warn' | 'bad' | 'muted'; sub: string }
> = {
  normal: { label: '血脂正常', risk: 'good', sub: '所有指标在合适/正常范围内' },
  mixed_with_low_hdl: {
    label: '疑似混合型高脂血症合并低 HDL',
    risk: 'bad',
    sub: 'TC 或 LDL 升高 + TG 升高 + HDL 降低',
  },
  high_chol_with_low_hdl: {
    label: '疑似高胆固醇血症合并低 HDL',
    risk: 'bad',
    sub: 'TC 或 LDL 升高 + HDL 降低',
  },
  high_tg_with_low_hdl: {
    label: '疑似高甘油三酯血症合并低 HDL',
    risk: 'bad',
    sub: 'TG 升高 + HDL 降低',
  },
  low_hdl_only: { label: '疑似低 HDL 血症', risk: 'warn', sub: 'HDL < 1.0 mmol/L' },
  mixed: {
    label: '疑似混合型高脂血症',
    risk: 'bad',
    sub: '(TC 或 LDL) 升高 + TG 升高',
  },
  high_chol: {
    label: '疑似高胆固醇血症',
    risk: 'bad',
    sub: 'TC 或 LDL 升高',
  },
  high_tg: { label: '疑似高甘油三酯血症', risk: 'bad', sub: 'TG 升高' },
  borderline: { label: '疑似血脂异常', risk: 'warn', sub: '存在边缘升高指标' },
  unavailable: { label: '数据不足', risk: 'muted', sub: '请先录入血脂数据' },
};

interface ClassifiedRecord {
  tc?: { val: number; level: FieldLevel };
  tg?: { val: number; level: FieldLevel };
  ldl?: { val: number; level: FieldLevel };
  hdl?: { val: number; level: FieldLevel };
}

function buildClassified(rec: LipidRecord | null): ClassifiedRecord {
  if (!rec) return {};
  const out: ClassifiedRecord = {};
  const tc = num(rec.tc_mmol_per_l);
  const tg = num(rec.tg_mmol_per_l);
  const ldl = num(rec.ldl_mmol_per_l);
  const hdl = num(rec.hdl_mmol_per_l);
  if (tc !== null) out.tc = { val: tc, level: classifyTC(tc).level };
  if (tg !== null) out.tg = { val: tg, level: classifyTG(tg).level };
  if (ldl !== null) out.ldl = { val: ldl, level: classifyLDL(ldl).level };
  if (hdl !== null) out.hdl = { val: hdl, level: classifyHDL(hdl).level };
  return out;
}

export function classifyOverall(rec: LipidRecord | null): LipidStatus {
  if (!rec) return 'unavailable';
  const c = buildClassified(rec);
  const hasAny = c.tc || c.tg || c.ldl || c.hdl;
  if (!hasAny) return 'unavailable';

  const tcUp = c.tc?.level === 'bad';
  const tgUp = c.tg?.level === 'bad';
  const ldlUp = c.ldl?.level === 'bad';
  const hdlLow = c.hdl?.level === 'bad';
  const cholUp = tcUp || ldlUp; // 高胆固醇

  // 1. HDL 降低 + 组合
  if (hdlLow) {
    if (cholUp && tgUp) return 'mixed_with_low_hdl';
    if (cholUp) return 'high_chol_with_low_hdl';
    if (tgUp) return 'high_tg_with_low_hdl';
    return 'low_hdl_only';
  }

  // 2. 全部正常（每个有值的指标都为 good）
  const values = [c.tc, c.tg, c.ldl, c.hdl].filter(Boolean) as { level: FieldLevel }[];
  if (values.every((x) => x.level === 'good')) return 'normal';

  // 3. 混合型
  if (cholUp && tgUp) return 'mixed';
  // 4. 高胆固醇
  if (cholUp && !tgUp) return 'high_chol';
  // 5. 高甘油三酯
  if (tgUp && !cholUp) return 'high_tg';

  // 6. 边缘升高
  if (values.some((x) => x.level === 'borderline')) return 'borderline';

  return 'unavailable';
}

// —— 趋势：基于非同日合并 TC 序列 ——

export type TrendDir = 'up' | 'down' | 'stable' | 'insufficient';

export function tcTrend(merged: LipidRecord[]): {
  dir: TrendDir;
  diff: number | null;
} {
  const tcs = merged
    .filter((r) => typeof r.tc_mmol_per_l === 'number' && Number.isFinite(r.tc_mmol_per_l))
    .map((r) => r.tc_mmol_per_l!);
  if (tcs.length < 2) return { dir: 'insufficient', diff: null };
  const head = tcs.slice(0, Math.min(3, tcs.length));
  const tail = tcs.slice(-Math.min(3, tcs.length));
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

export interface LipidAssessmentInput {
  records: LipidRecord[];
}

export interface LipidAssessmentResult {
  hasData: boolean;
  count: number;
  latest: LipidRecord | null;
  status: LipidStatus;
  statusInfo: (typeof LIPID_STATUS_INFO)[LipidStatus];
  fields: {
    tc: { value: number | null; label?: string; level?: FieldLevel };
    tg: { value: number | null; label?: string; level?: FieldLevel };
    ldl: { value: number | null; label?: string; level?: FieldLevel };
    hdl: { value: number | null; label?: string; level?: FieldLevel };
  };
  trend: { dir: TrendDir; diff: number | null };
  merged: LipidRecord[];
}

export function assessLipid(input: LipidAssessmentInput): LipidAssessmentResult {
  const records = [...input.records].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const merged = mergeLipidByDay(records);
  const latest = records.length ? records[records.length - 1] : null;
  const status = classifyOverall(latest);

  const tc = num(latest?.tc_mmol_per_l);
  const tg = num(latest?.tg_mmol_per_l);
  const ldl = num(latest?.ldl_mmol_per_l);
  const hdl = num(latest?.hdl_mmol_per_l);

  return {
    hasData: records.length > 0,
    count: records.length,
    latest,
    status,
    statusInfo: LIPID_STATUS_INFO[status],
    fields: {
      tc: tc !== null ? { value: tc, ...classifyTC(tc) } : { value: null },
      tg: tg !== null ? { value: tg, ...classifyTG(tg) } : { value: null },
      ldl: ldl !== null ? { value: ldl, ...classifyLDL(ldl) } : { value: null },
      hdl: hdl !== null ? { value: hdl, ...classifyHDL(hdl) } : { value: null },
    },
    trend: tcTrend(merged),
    merged,
  };
}

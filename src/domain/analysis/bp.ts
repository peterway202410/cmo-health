// 血压评估算法（纯函数）。详见「评估算法文档.md 二、血压评估」。

import type { BPRecord } from '@/infra/storage/schema';

// —— 同日合并：分别取平均 ——

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

interface MergedDay {
  date: string; // 用同日的某个 ISO 时间表示（取首条）
  systolic: number;
  diastolic: number;
  hr: number | null;
  count: number;
}

export function mergeBPByDay(records: BPRecord[]): MergedDay[] {
  const map = new Map<string, BPRecord[]>();
  for (const r of records) {
    const k = dayKey(r.created_at);
    const arr = map.get(k);
    if (arr) arr.push(r);
    else map.set(k, [r]);
  }
  const out: MergedDay[] = [];
  for (const arr of map.values()) {
    const sortedAsc = [...arr].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const sysAvg =
      sortedAsc.reduce((s, r) => s + r.systolic_mmHg, 0) / sortedAsc.length;
    const diaAvg =
      sortedAsc.reduce((s, r) => s + r.diastolic_mmHg, 0) / sortedAsc.length;
    const hrSum = sortedAsc.reduce<{ s: number; n: number }>(
      (acc, r) => {
        if (typeof r.heart_rate_bpm === 'number' && Number.isFinite(r.heart_rate_bpm)) {
          return { s: acc.s + r.heart_rate_bpm, n: acc.n + 1 };
        }
        return acc;
      },
      { s: 0, n: 0 },
    );
    out.push({
      date: sortedAsc[0].created_at,
      systolic: +sysAvg.toFixed(1),
      diastolic: +diaAvg.toFixed(1),
      hr: hrSum.n ? +(hrSum.s / hrSum.n).toFixed(0) : null,
      count: sortedAsc.length,
    });
  }
  return out.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// —— 分级 ——

export type BPLevel =
  | 'normal'
  | 'high_normal'
  | 'isolated_systolic'
  | 'stage1'
  | 'stage2'
  | 'stage3';

const BP_LEVELS: Record<BPLevel, { label: string; risk: 'good' | 'warn' | 'bad' }> = {
  normal: { label: '正常血压', risk: 'good' },
  high_normal: { label: '正常高值', risk: 'warn' },
  isolated_systolic: { label: '单纯收缩期高血压', risk: 'bad' },
  stage1: { label: '高血压 1 级', risk: 'bad' },
  stage2: { label: '高血压 2 级', risk: 'bad' },
  stage3: { label: '高血压 3 级', risk: 'bad' },
};

export function classifyBP(sys: number, dia: number): {
  level: BPLevel;
  label: string;
  risk: 'good' | 'warn' | 'bad';
} {
  // 优先级从高到低
  let level: BPLevel;
  if (sys >= 180 || dia >= 110) level = 'stage3';
  else if (sys >= 160 || dia >= 100) level = 'stage2';
  else if (sys >= 140 || dia >= 90) level = 'stage1';
  else if (sys >= 140 && dia < 90) level = 'isolated_systolic'; // 不会触达，因前面 stage1 已覆盖；保留以严格对齐文档
  else if (sys >= 120 || dia >= 80) level = 'high_normal';
  else level = 'normal';

  return { level, ...BP_LEVELS[level] };
}

// 注：上面的 isolated_systolic 在前面的 stage1 已覆盖到 sys≥140 的情况。
// 但严格按文档优先级，stage1 是「sys≥140 或 dia≥90」，
// 已包含「sys≥140 且 dia<90」。文档中 isolated_systolic 列出来主要是描述性。
// 这里保留 stage1 即可；UI 可以在 detail 中提示「单纯收缩期升高」。

export function isolatedSystolicNote(sys: number, dia: number): boolean {
  return sys >= 140 && dia < 90;
}

// —— 心率 ——

export type HRStatus = 'normal' | 'tachy' | 'brady';

export function classifyHR(hr: number): { status: HRStatus; label: string } {
  if (!Number.isFinite(hr)) return { status: 'normal', label: '—' };
  if (hr > 100) return { status: 'tachy', label: '心动过速' };
  if (hr < 60) return { status: 'brady', label: '心动过缓' };
  return { status: 'normal', label: '正常' };
}

// —— 趋势 ——

export type TrendDir = 'up' | 'down' | 'stable' | 'insufficient';

export function bpTrend(merged: MergedDay[]): {
  dir: TrendDir;
  diff: number | null;
  fluctuating?: boolean;
} {
  if (merged.length < 2) return { dir: 'insufficient', diff: null };
  const recent = merged.slice(-3);
  const first = recent[0].systolic;
  const last = recent[recent.length - 1].systolic;
  const diff = +(last - first).toFixed(1);
  let dir: TrendDir;
  if (diff > 10) dir = 'up';
  else if (diff < -10) dir = 'down';
  else dir = 'stable';

  // 全部记录标准差判定波动
  let fluctuating = false;
  if (merged.length >= 3) {
    const xs = merged.map((m) => m.systolic);
    const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
    const variance = xs.reduce((s, v) => s + (v - mean) ** 2, 0) / xs.length;
    const std = Math.sqrt(variance);
    fluctuating = std > 15;
  }
  return { dir, diff, fluctuating };
}

// —— 达标率 ——

export function bpControlRate(merged: MergedDay[]): {
  pct: number;
  achieved: number;
  total: number;
  level: 'good' | 'partial' | 'poor';
} | null {
  if (merged.length < 3) return null;
  const achieved = merged.filter((m) => m.systolic < 140 && m.diastolic < 90).length;
  const pct = +((achieved / merged.length) * 100).toFixed(1);
  let level: 'good' | 'partial' | 'poor';
  if (pct >= 80) level = 'good';
  else if (pct >= 50) level = 'partial';
  else level = 'poor';
  return { pct, achieved, total: merged.length, level };
}

// —— 统计 ——

export function bpStats(records: BPRecord[]): {
  count: number;
  uniqueDays: number;
  sysAvg: number | null;
  diaAvg: number | null;
  sysMin: number | null;
  sysMax: number | null;
  diaMin: number | null;
  diaMax: number | null;
} {
  if (records.length === 0) {
    return {
      count: 0,
      uniqueDays: 0,
      sysAvg: null,
      diaAvg: null,
      sysMin: null,
      sysMax: null,
      diaMin: null,
      diaMax: null,
    };
  }
  const sys = records.map((r) => r.systolic_mmHg);
  const dia = records.map((r) => r.diastolic_mmHg);
  const days = new Set(records.map((r) => dayKey(r.created_at))).size;
  return {
    count: records.length,
    uniqueDays: days,
    sysAvg: +(sys.reduce((s, v) => s + v, 0) / sys.length).toFixed(1),
    diaAvg: +(dia.reduce((s, v) => s + v, 0) / dia.length).toFixed(1),
    sysMin: Math.min(...sys),
    sysMax: Math.max(...sys),
    diaMin: Math.min(...dia),
    diaMax: Math.max(...dia),
  };
}

// —— 顶层组合 ——

export interface BPAssessmentInput {
  records: BPRecord[];
}

export interface BPAssessmentResult {
  count: number;
  hasData: boolean;
  // 最新一次原始测量
  latest: { sys: number; dia: number; hr: number | null; date: string } | null;
  // 基于非同日合并平均的分级
  classify: { level: BPLevel; label: string; risk: 'good' | 'warn' | 'bad' } | null;
  isolatedSystolic: boolean;
  // 基于合并均值
  meanSys: number | null;
  meanDia: number | null;
  hr: { value: number | null; status: HRStatus; label: string };
  trend: { dir: TrendDir; diff: number | null; fluctuating?: boolean };
  control: ReturnType<typeof bpControlRate>;
  stats: ReturnType<typeof bpStats>;
  merged: MergedDay[];
}

export function assessBP(input: BPAssessmentInput): BPAssessmentResult {
  const records = [...input.records].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const merged = mergeBPByDay(records);

  // 最新一次（原始）
  const last = records.length ? records[records.length - 1] : null;
  const latest = last
    ? {
        sys: last.systolic_mmHg,
        dia: last.diastolic_mmHg,
        hr: typeof last.heart_rate_bpm === 'number' ? last.heart_rate_bpm : null,
        date: last.created_at,
      }
    : null;

  // 分级（基于合并均值）
  let classify: BPAssessmentResult['classify'] = null;
  let meanSys: number | null = null;
  let meanDia: number | null = null;
  let isolated = false;
  if (merged.length > 0) {
    const sysAvg =
      merged.reduce((s, m) => s + m.systolic, 0) / merged.length;
    const diaAvg =
      merged.reduce((s, m) => s + m.diastolic, 0) / merged.length;
    meanSys = +sysAvg.toFixed(1);
    meanDia = +diaAvg.toFixed(1);
    classify = classifyBP(meanSys, meanDia);
    isolated = isolatedSystolicNote(meanSys, meanDia);
  }

  // 心率：取最新一次
  const hrInfo = latest && latest.hr != null
    ? classifyHR(latest.hr)
    : { status: 'normal' as HRStatus, label: '—' };

  return {
    count: records.length,
    hasData: records.length > 0,
    latest,
    classify,
    isolatedSystolic: isolated,
    meanSys,
    meanDia,
    hr: { value: latest?.hr ?? null, status: hrInfo.status, label: hrInfo.label },
    trend: bpTrend(merged),
    control: bpControlRate(merged),
    stats: bpStats(records),
    merged,
  };
}

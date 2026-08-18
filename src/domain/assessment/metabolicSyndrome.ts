// 代谢综合征 5 项判定（CDS 中国标准为默认阈值，用户可在设置中调整）
import type { AssessmentSnapshot, MetSItem } from './types';

function safeNum(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export function evaluateMetS(s: AssessmentSnapshot): {
  matched: number;
  items: MetSItem[];
  diagnosed: boolean;
} {
  const items: MetSItem[] = [];
  const t = s.thresholds;

  // 1) 腹型肥胖
  const waist = safeNum(s.latest.weight?.waist_cm);
  const obesityThreshold = s.gender === 'female' ? t.waist_female_cm : t.waist_male_cm;
  if (waist !== undefined) {
    items.push({
      key: 'central_obesity',
      label: '腹型肥胖',
      matched: waist >= obesityThreshold,
      source: 'measurement',
      value: `${waist.toFixed(1)} cm`,
    });
  } else {
    items.push({
      key: 'central_obesity',
      label: '腹型肥胖',
      matched: false,
      source: 'unknown',
    });
  }

  // 2) 血压偏高：已确诊 OR 窗口内反复偏高
  const sys = safeNum(s.latest.bp?.systolic_mmHg);
  const dia = safeNum(s.latest.bp?.diastolic_mmHg);
  if (s.has_hypertension) {
    items.push({
      key: 'hypertension',
      label: '血压偏高',
      matched: true,
      source: 'diagnosed',
      value: '已确诊',
    });
  } else if (s.bpHistory.length > 0) {
    // 计算窗口内"≥阈值"的次数
    const windowStart = new Date(s.now).getTime() - t.bp_window_days * 24 * 3600 * 1000;
    const inWindow = s.bpHistory.filter(
      (b) => new Date(b.created_at).getTime() >= windowStart,
    );
    const highCount = inWindow.filter(
      (b) => b.systolic_mmHg >= t.bp_sys_mmHg || b.diastolic_mmHg >= t.bp_dia_mmHg,
    ).length;
    const matched = highCount >= t.bp_repeated_count;
    const latestBP = sys !== undefined && dia !== undefined ? `最近 ${sys}/${dia} mmHg` : '';
    const countDesc = `近${t.bp_window_days}天偏高 ${highCount}/${inWindow.length} 次`;
    items.push({
      key: 'hypertension',
      label: '血压偏高',
      matched,
      source: 'measurement',
      value: [latestBP, countDesc].filter(Boolean).join(' · '),
    });
  } else {
    items.push({
      key: 'hypertension',
      label: '血压偏高',
      matched: false,
      source: 'unknown',
    });
  }

  // 3) 高血糖：已确诊 OR 空腹 ≥6.1 OR 餐后2h ≥7.8
  const fpg = safeNum(s.latest.glucose?.fpg_mmol_per_l);
  const pp2h = safeNum(s.latest.glucose?.pp2h_mmol_per_l);
  if (s.has_diabetes) {
    items.push({
      key: 'hyperglycemia',
      label: '高血糖',
      matched: true,
      source: 'diagnosed',
      value: '已确诊',
    });
  } else if (fpg !== undefined || pp2h !== undefined) {
    const matched =
      (fpg !== undefined && fpg >= t.fpg_mmol) ||
      (pp2h !== undefined && pp2h >= t.pp2h_mmol);
    const display = [
      fpg !== undefined ? `空腹 ${fpg.toFixed(1)}` : null,
      pp2h !== undefined ? `餐后 ${pp2h.toFixed(1)}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    items.push({
      key: 'hyperglycemia',
      label: '高血糖',
      matched,
      source: 'measurement',
      value: display,
    });
  } else {
    items.push({
      key: 'hyperglycemia',
      label: '高血糖',
      matched: false,
      source: 'unknown',
    });
  }

  // 4) 高甘油三酯
  const tg = safeNum(s.latest.lipid?.tg_mmol_per_l);
  if (tg !== undefined) {
    items.push({
      key: 'high_tg',
      label: '高甘油三酯',
      matched: tg >= t.tg_mmol,
      source: 'measurement',
      value: `${tg.toFixed(2)} mmol/L`,
    });
  } else {
    items.push({
      key: 'high_tg',
      label: '高甘油三酯',
      matched: false,
      source: 'unknown',
    });
  }

  // 5) 低 HDL-C
  const hdl = safeNum(s.latest.lipid?.hdl_mmol_per_l);
  if (hdl !== undefined) {
    items.push({
      key: 'low_hdl',
      label: '低 HDL',
      matched: hdl < t.hdl_mmol,
      source: 'measurement',
      value: `${hdl.toFixed(2)} mmol/L`,
    });
  } else {
    items.push({
      key: 'low_hdl',
      label: '低 HDL',
      matched: false,
      source: 'unknown',
    });
  }

  const matched = items.filter((it) => it.matched).length;
  return { matched, items, diagnosed: matched >= 3 };
}

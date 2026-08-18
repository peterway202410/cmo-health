// 8 个维度的独立打分。每个维度返回 [0-100] 或 null（无数据）。

import type { ComprehensiveInput, DimensionScore } from './types';
import { DIMENSION_WEIGHT, DIMENSION_LABEL } from './types';

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * 按字段维度找最近一次有值的记录（数组按 created_at 升序）
 */
function findLatest<T extends { created_at: string }>(
  arr: T[],
  has: (r: T) => boolean,
): T | undefined {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (has(arr[i])) return arr[i];
  }
  return undefined;
}

// ========== 1. 代谢综合征核心维度 ==========
// 5 项命中数：waist / BP / FPG / TG / HDL
export function dimMetsCore(input: ComprehensiveInput): DimensionScore {
  const t = input.thresholds;
  const isMale = input.profile.gender !== 'female';
  let availableItems = 0;
  let matchedItems = 0;
  const reasons: string[] = [];

  // 腹型肥胖
  const waistRec = findLatest(input.weight, (r) => r.waist_cm != null);
  if (waistRec?.waist_cm != null) {
    availableItems++;
    const threshold = isMale ? t.waist_male_cm : t.waist_female_cm;
    if (waistRec.waist_cm >= threshold) {
      matchedItems++;
      reasons.push(`腰围 ${waistRec.waist_cm.toFixed(0)} ≥ ${threshold}`);
    }
  }

  // 血压
  if (input.profile.has_hypertension) {
    availableItems++;
    matchedItems++;
    reasons.push('已确诊高血压');
  } else if (input.bp.length > 0) {
    availableItems++;
    // 用窗口判定
    const windowStart = new Date(input.now).getTime() - t.bp_window_days * 24 * 3600 * 1000;
    const inWin = input.bp.filter((r) => new Date(r.created_at).getTime() >= windowStart);
    const high = inWin.filter(
      (r) => r.systolic_mmHg >= t.bp_sys_mmHg || r.diastolic_mmHg >= t.bp_dia_mmHg,
    );
    if (high.length >= t.bp_repeated_count) {
      matchedItems++;
      reasons.push(`近${t.bp_window_days}天血压偏高 ${high.length} 次`);
    }
  }

  // 血糖
  if (input.profile.has_diabetes) {
    availableItems++;
    matchedItems++;
    reasons.push('已确诊糖尿病');
  } else {
    const fpgRec = findLatest(input.glucose, (r) => r.fpg_mmol_per_l != null);
    const ppRec = findLatest(input.glucose, (r) => r.pp2h_mmol_per_l != null);
    if (fpgRec || ppRec) {
      availableItems++;
      const fpg = fpgRec?.fpg_mmol_per_l ?? 0;
      const pp = ppRec?.pp2h_mmol_per_l ?? 0;
      if (fpg >= t.fpg_mmol || pp >= t.pp2h_mmol) {
        matchedItems++;
        reasons.push('血糖偏高');
      }
    }
  }

  // TG
  const tgRec = findLatest(input.lipid, (r) => r.tg_mmol_per_l != null);
  if (tgRec?.tg_mmol_per_l != null) {
    availableItems++;
    if (tgRec.tg_mmol_per_l >= t.tg_mmol) {
      matchedItems++;
      reasons.push(`TG ${tgRec.tg_mmol_per_l.toFixed(1)} ≥ ${t.tg_mmol}`);
    }
  }

  // HDL
  const hdlRec = findLatest(input.lipid, (r) => r.hdl_mmol_per_l != null);
  if (hdlRec?.hdl_mmol_per_l != null) {
    availableItems++;
    if (hdlRec.hdl_mmol_per_l < t.hdl_mmol) {
      matchedItems++;
      reasons.push(`HDL ${hdlRec.hdl_mmol_per_l.toFixed(2)} < ${t.hdl_mmol}`);
    }
  }

  // 至少 3 项数据才有意义
  if (availableItems < 3) {
    return {
      key: 'mets_core',
      label: DIMENSION_LABEL.mets_core,
      weight: DIMENSION_WEIGHT.mets_core,
      score: null,
      reasons: ['必要指标不足（至少 3 项）'],
      coverage: availableItems / 5,
    };
  }

  // 评分：按命中比例非线性递减；并区分"是否构成代谢综合征"
  // 0/5 → 100；1/5 → 85；2/5 → 65；3/5 → 35；4/5 → 15；5/5 → 0
  const matchedRatio = matchedItems / availableItems;
  let score: number;
  if (matchedItems === 0) score = 100;
  else if (matchedRatio < 0.4) score = 85 - matchedRatio * 50;
  else if (matchedRatio < 0.6) score = 65 - (matchedRatio - 0.4) * 150;
  else score = Math.max(0, 35 - (matchedRatio - 0.6) * 87.5);

  // 已构成代谢综合征（≥3 项）→ 总评额外乘 0.7
  if (matchedItems >= 3) {
    score *= 0.7;
    reasons.unshift(`已构成代谢综合征（${matchedItems}/${availableItems}）`);
  }

  return {
    key: 'mets_core',
    label: DIMENSION_LABEL.mets_core,
    weight: DIMENSION_WEIGHT.mets_core,
    score: Math.round(clamp(score)),
    reasons: reasons.slice(0, 3),
    coverage: availableItems / 5,
  };
}

// ========== 2. 血压 ==========
export function dimBP(input: ComprehensiveInput): DimensionScore {
  const reasons: string[] = [];
  if (input.bp.length === 0 && !input.profile.has_hypertension) {
    return {
      key: 'bp',
      label: DIMENSION_LABEL.bp,
      weight: DIMENSION_WEIGHT.bp,
      score: null,
      reasons: ['无血压数据'],
      coverage: 0,
    };
  }

  let score = 100;

  if (input.bp.length > 0) {
    // 取最新一次
    const last = input.bp[input.bp.length - 1];
    const sys = last.systolic_mmHg;
    const dia = last.diastolic_mmHg;
    if (sys >= 180 || dia >= 110) { score = 0; reasons.push(`本次 ${sys}/${dia}（3 级）`); }
    else if (sys >= 160 || dia >= 100) { score = 15; reasons.push(`本次 ${sys}/${dia}（2 级）`); }
    else if (sys >= 140 || dia >= 90) { score = 35; reasons.push(`本次 ${sys}/${dia}（1 级）`); }
    else if (sys >= 130 || dia >= 85) { score = 65; reasons.push(`本次 ${sys}/${dia}（正常高值）`); }
    else if (sys >= 120) { score = 85; }

    // 反复偏高（近 7 天 ≥ 5 次）
    const t = input.thresholds;
    const windowStart = new Date(input.now).getTime() - t.bp_window_days * 24 * 3600 * 1000;
    const inWin = input.bp.filter((r) => new Date(r.created_at).getTime() >= windowStart);
    const high = inWin.filter(
      (r) => r.systolic_mmHg >= t.bp_sys_mmHg || r.diastolic_mmHg >= t.bp_dia_mmHg,
    );
    if (high.length >= t.bp_repeated_count) {
      score *= 0.7;
      reasons.push(`近${t.bp_window_days}天反复偏高 ${high.length} 次`);
    }
  }

  if (input.profile.has_hypertension) {
    score = Math.min(score, 50);
    reasons.unshift('已确诊高血压');
  }

  return {
    key: 'bp',
    label: DIMENSION_LABEL.bp,
    weight: DIMENSION_WEIGHT.bp,
    score: Math.round(clamp(score)),
    reasons: reasons.slice(0, 3),
    coverage: 1,
  };
}

// ========== 3. 血糖 ==========
export function dimGlucose(input: ComprehensiveInput): DimensionScore {
  const reasons: string[] = [];
  const fpgRec = findLatest(input.glucose, (r) => r.fpg_mmol_per_l != null);
  const ppRec = findLatest(input.glucose, (r) => r.pp2h_mmol_per_l != null);
  const hbRec = findLatest(input.glucose, (r) => r.hba1c_pct != null);
  const hasData = fpgRec || ppRec || hbRec || input.profile.has_diabetes;

  if (!hasData) {
    return {
      key: 'glucose',
      label: DIMENSION_LABEL.glucose,
      weight: DIMENSION_WEIGHT.glucose,
      score: null,
      reasons: ['无血糖数据'],
      coverage: 0,
    };
  }

  let score = 100;

  if (fpgRec?.fpg_mmol_per_l != null) {
    const fpg = fpgRec.fpg_mmol_per_l;
    if (fpg <= 3.9) { score = Math.min(score, 30); reasons.push(`空腹 ${fpg}（疑似低血糖）`); }
    else if (fpg >= 7.0) { score = Math.min(score, 25); reasons.push(`空腹 ${fpg}（糖尿病线）`); }
    else if (fpg >= 6.1) { score = Math.min(score, 60); reasons.push(`空腹 ${fpg}（IFG）`); }
    else if (fpg >= 5.6) { score = Math.min(score, 80); reasons.push(`空腹 ${fpg}（偏高）`); }
  }

  if (ppRec?.pp2h_mmol_per_l != null) {
    const pp = ppRec.pp2h_mmol_per_l;
    if (pp >= 11.1) { score = Math.min(score, 25); reasons.push(`餐后 ${pp}（糖尿病线）`); }
    else if (pp >= 7.8) { score = Math.min(score, 60); reasons.push(`餐后 ${pp}（IGT）`); }
  }

  if (hbRec?.hba1c_pct != null) {
    const hb = hbRec.hba1c_pct;
    if (hb >= 6.5) { score = Math.min(score, 25); reasons.push(`HbA1c ${hb}%（糖尿病）`); }
    else if (hb >= 5.7) { score = Math.min(score, 65); reasons.push(`HbA1c ${hb}%（前期）`); }
  }

  if (input.profile.has_diabetes) {
    score = Math.min(score, 40);
    reasons.unshift('已确诊糖尿病');
  }

  let coverage = 0;
  if (fpgRec) coverage += 0.4;
  if (ppRec) coverage += 0.3;
  if (hbRec) coverage += 0.3;
  coverage = Math.max(coverage, input.profile.has_diabetes ? 0.5 : 0);

  return {
    key: 'glucose',
    label: DIMENSION_LABEL.glucose,
    weight: DIMENSION_WEIGHT.glucose,
    score: Math.round(clamp(score)),
    reasons: reasons.slice(0, 3),
    coverage,
  };
}

// ========== 4. 血脂 ==========
export function dimLipid(input: ComprehensiveInput): DimensionScore {
  const reasons: string[] = [];
  const tg = findLatest(input.lipid, (r) => r.tg_mmol_per_l != null);
  const hdl = findLatest(input.lipid, (r) => r.hdl_mmol_per_l != null);
  const ldl = findLatest(input.lipid, (r) => r.ldl_mmol_per_l != null);
  const tc = findLatest(input.lipid, (r) => r.tc_mmol_per_l != null);
  const hasData = tg || hdl || ldl || tc || input.profile.has_hypercholesterolemia;

  if (!hasData) {
    return {
      key: 'lipid',
      label: DIMENSION_LABEL.lipid,
      weight: DIMENSION_WEIGHT.lipid,
      score: null,
      reasons: ['无血脂数据'],
      coverage: 0,
    };
  }

  let score = 100;
  let coverage = 0;

  if (tg?.tg_mmol_per_l != null) {
    coverage += 0.25;
    const v = tg.tg_mmol_per_l;
    if (v >= 5.6) { score = Math.min(score, 20); reasons.push(`TG ${v}（极高）`); }
    else if (v >= 2.3) { score = Math.min(score, 50); reasons.push(`TG ${v}（升高）`); }
    else if (v >= 1.7) { score = Math.min(score, 75); reasons.push(`TG ${v}（边缘）`); }
  }

  const isMale = input.profile.gender !== 'female';
  if (hdl?.hdl_mmol_per_l != null) {
    coverage += 0.25;
    const v = hdl.hdl_mmol_per_l;
    const lo = isMale ? 1.0 : 1.3;
    if (v < 0.9) { score = Math.min(score, 40); reasons.push(`HDL ${v}（明显偏低）`); }
    else if (v < lo) { score = Math.min(score, 65); reasons.push(`HDL ${v}（偏低）`); }
  }

  if (ldl?.ldl_mmol_per_l != null) {
    coverage += 0.25;
    const v = ldl.ldl_mmol_per_l;
    if (v >= 4.1) { score = Math.min(score, 35); reasons.push(`LDL ${v}（升高）`); }
    else if (v >= 3.4) { score = Math.min(score, 65); reasons.push(`LDL ${v}（边缘）`); }
  }

  if (tc?.tc_mmol_per_l != null) {
    coverage += 0.25;
    const v = tc.tc_mmol_per_l;
    if (v >= 6.2) { score = Math.min(score, 50); reasons.push(`TC ${v}（升高）`); }
    else if (v >= 5.2) { score = Math.min(score, 75); reasons.push(`TC ${v}（边缘）`); }
  }

  if (input.profile.has_hypercholesterolemia) {
    score = Math.min(score, 50);
    coverage = Math.max(coverage, 0.5);
    reasons.unshift('已确诊高胆固醇血症');
  }

  return {
    key: 'lipid',
    label: DIMENSION_LABEL.lipid,
    weight: DIMENSION_WEIGHT.lipid,
    score: Math.round(clamp(score)),
    reasons: reasons.slice(0, 3),
    coverage,
  };
}

// ========== 5. 体型（BMI / WHR / WHtR） ==========
export function dimBody(input: ComprehensiveInput): DimensionScore {
  const reasons: string[] = [];
  const t = input.thresholds;
  const isMale = input.profile.gender !== 'female';
  const height = input.profile.height_cm;

  const wRec = findLatest(input.weight, (r) => r.weight_kg != null);
  const waistRec = findLatest(input.weight, (r) => r.waist_cm != null);
  const hipRec = findLatest(input.weight, (r) => r.hip_cm != null);

  if (!wRec && !waistRec) {
    return {
      key: 'body',
      label: DIMENSION_LABEL.body,
      weight: DIMENSION_WEIGHT.body,
      score: null,
      reasons: ['无体型数据'],
      coverage: 0,
    };
  }

  let score = 100;
  let coverage = 0;

  // BMI
  if (wRec?.weight_kg != null && height > 0) {
    coverage += 0.4;
    const bmi = wRec.weight_kg / Math.pow(height / 100, 2);
    if (bmi < 18.5) { score = Math.min(score, 75); reasons.push(`BMI ${bmi.toFixed(1)}（偏瘦）`); }
    else if (bmi >= t.bmi_obese) { score = Math.min(score, 30); reasons.push(`BMI ${bmi.toFixed(1)}（肥胖）`); }
    else if (bmi >= t.bmi_overweight) { score = Math.min(score, 65); reasons.push(`BMI ${bmi.toFixed(1)}（超重）`); }
  }

  // WHR
  if (waistRec?.waist_cm != null && hipRec?.hip_cm != null) {
    coverage += 0.3;
    const whr = waistRec.waist_cm / hipRec.hip_cm;
    const whrT = isMale ? t.whr_male : t.whr_female;
    if (whr > whrT + 0.1) { score = Math.min(score, 30); reasons.push(`WHR ${whr.toFixed(2)}（明显异常）`); }
    else if (whr > whrT) { score = Math.min(score, 60); reasons.push(`WHR ${whr.toFixed(2)}（异常）`); }
  }

  // WHtR
  if (waistRec?.waist_cm != null && height > 0) {
    coverage += 0.3;
    const whtr = waistRec.waist_cm / height;
    if (whtr >= 0.6) { score = Math.min(score, 35); reasons.push(`WHtR ${whtr.toFixed(2)}（高风险）`); }
    else if (whtr >= 0.5) { score = Math.min(score, 70); reasons.push(`WHtR ${whtr.toFixed(2)}（升高）`); }
  }

  return {
    key: 'body',
    label: DIMENSION_LABEL.body,
    weight: DIMENSION_WEIGHT.body,
    score: Math.round(clamp(score)),
    reasons: reasons.slice(0, 3),
    coverage,
  };
}

// ========== 6. 尿酸 ==========
export function dimUric(input: ComprehensiveInput): DimensionScore {
  const reasons: string[] = [];
  if (input.uric.length === 0 && !input.profile.has_hyperuricemia) {
    return {
      key: 'uric',
      label: DIMENSION_LABEL.uric,
      weight: DIMENSION_WEIGHT.uric,
      score: null,
      reasons: ['无尿酸数据'],
      coverage: 0,
    };
  }

  let score = 100;
  const isMale = input.profile.gender !== 'female';

  if (input.uric.length > 0) {
    const last = input.uric[input.uric.length - 1];
    const v = last.uric_umol_per_l;
    const baseT = isMale ? input.thresholds.uric_male : input.thresholds.uric_female;
    if (v >= 700) { score = 10; reasons.push(`尿酸 ${v}（重度）`); }
    else if (v > baseT + 120) { score = 30; reasons.push(`尿酸 ${v}（需治疗）`); }
    else if (v > baseT) { score = 55; reasons.push(`尿酸 ${v}（升高）`); }
    else if (v < 120) { score = 50; reasons.push(`尿酸 ${v}（过低）`); }
    else if (v >= baseT - 60) { score = 80; reasons.push(`尿酸 ${v}（正常高值）`); }
  }

  if (input.profile.has_hyperuricemia) {
    score = Math.min(score, 50);
    reasons.unshift('已确诊高尿酸血症');
  }

  return {
    key: 'uric',
    label: DIMENSION_LABEL.uric,
    weight: DIMENSION_WEIGHT.uric,
    score: Math.round(clamp(score)),
    reasons: reasons.slice(0, 3),
    coverage: 1,
  };
}

// ========== 7. 既往与家族史 ==========
export function dimHistory(input: ComprehensiveInput): DimensionScore {
  const p = input.profile;
  const reasons: string[] = [];
  let score = 100;

  // 中风：权重最高
  if (p.has_stroke_history) {
    score -= 50;
    reasons.push('有中风/TIA 病史');
  }

  // 颈动脉斑块
  if (p.has_carotid_plaque) {
    score -= 25;
    reasons.push('颈动脉斑块');
  }

  // 脂肪肝
  if (p.has_fatty_liver) {
    score -= 12;
    reasons.push('脂肪肝');
  }

  // 家族代谢综合征史
  if (p.has_family_metabolic_history) {
    score -= 10;
    reasons.push('家族代谢病史');
  }

  return {
    key: 'history',
    label: DIMENSION_LABEL.history,
    weight: DIMENSION_WEIGHT.history,
    score: Math.round(clamp(score)),
    reasons: reasons.length > 0 ? reasons.slice(0, 3) : ['无相关病史'],
    coverage: 1, // 病史维度永远参与
  };
}

// ========== 8. 生活方式 ==========
export function dimLifestyle(input: ComprehensiveInput): DimensionScore {
  const q = input.questionnaire;
  if (!q) {
    return {
      key: 'lifestyle',
      label: DIMENSION_LABEL.lifestyle,
      weight: DIMENSION_WEIGHT.lifestyle,
      score: null,
      reasons: ['未填写问卷'],
      coverage: 0,
    };
  }

  const reasons: string[] = [];
  let score = 100;

  // 吸烟
  if (q.smoking) { score -= 20; reasons.push('吸烟'); }
  // 饮酒
  if (q.alcohol_per_week >= 4) { score -= 12; reasons.push('饮酒频次过高'); }
  else if (q.alcohol_per_week >= 2) { score -= 5; reasons.push('饮酒偏多'); }
  // 睡眠
  if (q.sleep_hours < 6) { score -= 10; reasons.push('睡眠不足'); }
  else if (q.sleep_hours > 9) { score -= 5; reasons.push('睡眠过长'); }
  // 熬夜
  if (q.late_night_per_week >= 5) { score -= 10; reasons.push('频繁熬夜'); }
  else if (q.late_night_per_week >= 3) { score -= 5; reasons.push('熬夜偏多'); }
  // 运动
  if (q.exercise_per_week < 1) { score -= 12; reasons.push('严重缺乏运动'); }
  else if (q.exercise_per_week < 3) { score -= 6; reasons.push('运动不足'); }
  // 久坐
  if (q.sedentary_hours_per_day >= 8) { score -= 8; reasons.push('久坐时间过长'); }
  else if (q.sedentary_hours_per_day >= 6) { score -= 4; reasons.push('久坐偏多'); }
  // 饮食
  if (q.takeout_per_week >= 7) { score -= 6; reasons.push('外卖频率过高'); }
  if (q.sugary_drink_per_week >= 7) { score -= 6; reasons.push('含糖饮料过多'); }
  if (q.midnight_snack_per_week >= 3) { score -= 4; reasons.push('夜宵频繁'); }
  // 压力
  if (q.stress_level >= 4) { score -= 5; reasons.push('压力较大'); }
  // 睡眠质量
  if (q.sleep_quality <= 2) { score -= 5; reasons.push('睡眠质量较差'); }

  return {
    key: 'lifestyle',
    label: DIMENSION_LABEL.lifestyle,
    weight: DIMENSION_WEIGHT.lifestyle,
    score: Math.round(clamp(score)),
    reasons: reasons.length > 0 ? reasons.slice(0, 3) : ['生活方式良好'],
    coverage: 1,
  };
}

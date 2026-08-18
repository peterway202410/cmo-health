import type { AssessmentSnapshot, CoverageResult, RequiredItemKey } from './types';

function isFiniteNum(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * 必要指标共 6 项：体重 / 腰围 / 血压 / 空腹血糖 / HDL / TG
 * 全部缺失 → unavailable；部分缺失 → reference + 置信度；齐全 → full
 */
export function evaluateCoverage(s: AssessmentSnapshot): CoverageResult {
  const missing: RequiredItemKey[] = [];

  if (!isFiniteNum(s.latest.weight?.weight_kg)) missing.push('weight');
  if (!isFiniteNum(s.latest.weight?.waist_cm)) missing.push('waist');
  // 血压必须收缩压、舒张压都有
  const sys = s.latest.bp?.systolic_mmHg;
  const dia = s.latest.bp?.diastolic_mmHg;
  if (!(isFiniteNum(sys) && isFiniteNum(dia))) missing.push('bp');
  if (!isFiniteNum(s.latest.glucose?.fpg_mmol_per_l)) missing.push('fpg');
  if (!isFiniteNum(s.latest.lipid?.hdl_mmol_per_l)) missing.push('hdl');
  if (!isFiniteNum(s.latest.lipid?.tg_mmol_per_l)) missing.push('tg');

  const totalRequired = 6 as const;
  const coveredCount = totalRequired - missing.length;
  let mode: CoverageResult['mode'];
  if (coveredCount === 0) mode = 'unavailable';
  else if (missing.length === 0) mode = 'full';
  else mode = 'reference';

  return {
    mode,
    coveredCount,
    totalRequired,
    confidence: coveredCount / totalRequired,
    missingItems: missing,
  };
}

// 综合评估顶层组合
import {
  dimMetsCore,
  dimBP,
  dimGlucose,
  dimLipid,
  dimBody,
  dimUric,
  dimHistory,
  dimLifestyle,
} from './dimensions';
import { ageFromBirth } from '@/utils/date';
import {
  RISK_LEVEL_INFO,
  type ComprehensiveInput,
  type ComprehensiveResult,
  type DimensionScore,
  type RiskLevel,
} from './types';

function mapLevel(score: number): RiskLevel {
  if (score >= 90) return 'excellent';
  if (score >= 80) return 'good';
  if (score >= 70) return 'mild';
  if (score >= 60) return 'moderate';
  if (score >= 40) return 'high';
  return 'severe';
}

/** 风险年龄偏移：基于评分 + 关键事件 */
function computeRiskOffset(
  score: number,
  dimensions: DimensionScore[],
  hasDiabetes: boolean,
  hasStroke: boolean,
  hasCarotid: boolean,
): number {
  // 基础：评分 75 = 0 偏移；每低 5 分 +1 岁
  let offset = (75 - score) * 0.2;

  // 关键事件加成
  if (hasDiabetes) offset += 5;
  if (hasStroke) offset += 5;
  if (hasCarotid) offset += 3;

  // 高血压 2-3 级（血压维度 ≤ 30）
  const bpDim = dimensions.find((d) => d.key === 'bp');
  if (bpDim && bpDim.score !== null && bpDim.score <= 30) offset += 3;

  // 钳制 [-10, 20]
  return Math.round(Math.max(-10, Math.min(20, offset)));
}

export function computeComprehensive(input: ComprehensiveInput): ComprehensiveResult {
  const dimensions: DimensionScore[] = [
    dimMetsCore(input),
    dimBP(input),
    dimGlucose(input),
    dimLipid(input),
    dimBody(input),
    dimUric(input),
    dimHistory(input),
    dimLifestyle(input),
  ];

  // 计算总分（仅参与有数据的维度）
  let weightedSum = 0;
  let weightTotal = 0;
  let availableWeight = 0;
  let totalWeight = 0;
  for (const d of dimensions) {
    totalWeight += d.weight;
    if (d.score !== null) {
      weightedSum += d.weight * d.score;
      weightTotal += d.weight;
      availableWeight += d.weight;
    }
  }

  let score = 0;
  let mode: ComprehensiveResult['mode'] = 'unavailable';
  if (weightTotal > 0) {
    score = Math.round(weightedSum / weightTotal);
    mode = availableWeight / totalWeight >= 0.6 ? 'full' : 'reference';
  }

  const level = mapLevel(score);

  const realAge = ageFromBirth(input.profile.birth_date, input.now);
  const riskOffsetYears =
    mode === 'unavailable'
      ? 0
      : computeRiskOffset(
          score,
          dimensions,
          input.profile.has_diabetes,
          input.profile.has_stroke_history,
          input.profile.has_carotid_plaque,
        );

  return {
    score,
    level,
    levelInfo: RISK_LEVEL_INFO[level],
    coverage: totalWeight > 0 ? availableWeight / totalWeight : 0,
    mode,
    dimensions,
    riskOffsetYears,
    realAge,
  };
}

export type {
  ComprehensiveResult,
  ComprehensiveInput,
  DimensionScore,
  RiskLevel,
} from './types';
export { DIMENSION_LABEL, DIMENSION_WEIGHT, RISK_LEVEL_INFO } from './types';

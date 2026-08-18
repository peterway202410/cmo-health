// 顶层评估组合
import { ageFromBirth, daysBetween } from '@/utils/date';
import type {
  AssessmentResult,
  AssessmentSnapshot,
  ScoreDeduction,
} from './types';
import { computeBMI, classifyBMI } from './bmi';
import { computeWHR, classifyWHR } from './whr';
import { classifyUric } from './uric';
import { evaluateMetS } from './metabolicSyndrome';
import { evaluateCoverage } from './missingData';
import { computeScore } from './score';
import { computeMetabolicAge } from './metabolicAge';

function mapScoreLevel(score: number): '优' | '良' | '中' | '差' {
  if (score >= 90) return '优';
  if (score >= 75) return '良';
  if (score >= 60) return '中';
  return '差';
}

function mapRiskLevel(score: number): '低' | '中' | '高' {
  if (score >= 75) return '低';
  if (score >= 60) return '中';
  return '高';
}

function safeNum(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export function computeAssessment(s: AssessmentSnapshot): AssessmentResult {
  const realAge = ageFromBirth(s.birth_date, s.now);
  const coverage = evaluateCoverage(s);
  const metsResult = evaluateMetS(s);

  // 收集每项指标的最新采集时间 + 过期标记
  const usedTimestamps: AssessmentResult['usedTimestamps'] = {};
  const staleFlags: AssessmentResult['staleFlags'] = {};
  const trackStale = (
    key: keyof AssessmentResult['staleFlags'],
    iso: string | undefined,
  ) => {
    if (!iso) return;
    usedTimestamps[key] = iso;
    if (daysBetween(iso, s.now) >= 91) staleFlags[key] = true;
  };
  trackStale('weight', s.latest.weight?.created_at);
  trackStale('bp', s.latest.bp?.created_at);
  trackStale('glucose', s.latest.glucose?.created_at);
  trackStale('lipid', s.latest.lipid?.created_at);
  trackStale('uric', s.latest.uric?.created_at);

  // 全部缺失 → 不出评分
  if (coverage.mode === 'unavailable') {
    return {
      score: null,
      scoreLevel: null,
      riskLevel: null,
      metabolicAge: null,
      realAge,
      bmi: null,
      whr: null,
      uric: null,
      metsResult,
      deductions: [] as ScoreDeduction[],
      mode: 'unavailable',
      confidence: 0,
      coveredCount: 0,
      totalRequired: 6,
      staleFlags,
      usedTimestamps,
    };
  }

  const { score, deductions } = computeScore(s);
  const metabolicAge = computeMetabolicAge(realAge, score, s.gender);

  // BMI
  const weight_kg = safeNum(s.latest.weight?.weight_kg);
  let bmi: AssessmentResult['bmi'] = null;
  if (weight_kg !== undefined && Number.isFinite(s.height_cm) && s.height_cm > 0) {
    const v = computeBMI(weight_kg, s.height_cm);
    if (Number.isFinite(v)) bmi = { value: +v.toFixed(1), level: classifyBMI(v, s.thresholds) };
  }

  // WHR
  const waist = safeNum(s.latest.weight?.waist_cm);
  const hip = safeNum(s.latest.weight?.hip_cm);
  let whr: AssessmentResult['whr'] = null;
  if (waist !== undefined && hip !== undefined) {
    const v = computeWHR(waist, hip);
    if (Number.isFinite(v))
      whr = { value: +v.toFixed(2), level: classifyWHR(v, s.gender, s.thresholds) };
  }

  // Uric
  const uricVal = safeNum(s.latest.uric?.uric_umol_per_l);
  const uric: AssessmentResult['uric'] =
    uricVal !== undefined
      ? { value: uricVal, level: classifyUric(uricVal, s.gender, s.thresholds) }
      : null;

  return {
    score,
    scoreLevel: mapScoreLevel(score),
    riskLevel: mapRiskLevel(score),
    metabolicAge,
    realAge,
    bmi,
    whr,
    uric,
    metsResult,
    deductions,
    mode: coverage.mode,
    confidence: coverage.confidence,
    coveredCount: coverage.coveredCount,
    totalRequired: 6,
    staleFlags,
    usedTimestamps,
  };
}

export type {
  AssessmentResult,
  AssessmentSnapshot,
  ScoreDeduction,
  MetSItem,
  ScoreMode,
} from './types';

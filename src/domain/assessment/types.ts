// 评估引擎核心类型。详见 design.md 的「Components and Interfaces — Domain 层」。

import type { Gender, Questionnaire, Thresholds } from '@/infra/storage/schema';

export type DeductionModule = 'mets' | 'bmi_whr' | 'uric' | 'lifestyle';

export interface ScoreDeduction {
  module: DeductionModule;
  factor: string;
  points: number;
  reason: string;
}

export type MetSKey =
  | 'central_obesity'
  | 'hypertension'
  | 'hyperglycemia'
  | 'high_tg'
  | 'low_hdl';

export interface MetSItem {
  key: MetSKey;
  label: string;
  matched: boolean;
  source: 'measurement' | 'diagnosed' | 'unknown';
  value?: string;
}

/** 评估输入：所有数据由调用方组装好（保证 computeAssessment 为纯函数）。 */
export interface AssessmentSnapshot {
  birth_date: string;
  gender: Gender;
  height_cm: number;
  has_hypertension: boolean;
  has_diabetes: boolean;
  /** 评估时间（ISO 字符串），由调用方注入 */
  now: string;
  /** 每项指标取历史最近一条 */
  latest: {
    weight?: { weight_kg?: number; waist_cm?: number; hip_cm?: number; created_at: string };
    bp?: { systolic_mmHg: number; diastolic_mmHg: number; created_at: string };
    glucose?: {
      fpg_mmol_per_l?: number;
      pp2h_mmol_per_l?: number;
      hba1c_pct?: number;
      created_at: string;
    };
    lipid?: {
      tg_mmol_per_l?: number;
      hdl_mmol_per_l?: number;
      ldl_mmol_per_l?: number;
      tc_mmol_per_l?: number;
      created_at: string;
    };
    uric?: { uric_umol_per_l: number; created_at: string };
  };
  /** 窗口内血压全部记录，用于"反复偏高"判定 */
  bpHistory: Array<{
    systolic_mmHg: number;
    diastolic_mmHg: number;
    created_at: string;
  }>;
  questionnaire: Questionnaire | null;
  /** 用户可调的判定阈值；为保持纯函数性，由调用方注入 */
  thresholds: Thresholds;
}

export type ScoreMode = 'full' | 'reference' | 'unavailable';

export type RequiredItemKey = 'weight' | 'waist' | 'bp' | 'fpg' | 'hdl' | 'tg';

export interface CoverageResult {
  mode: ScoreMode;
  confidence: number;
  coveredCount: number;
  totalRequired: 6;
  missingItems: RequiredItemKey[];
}

export interface AssessmentResult {
  score: number | null;
  scoreLevel: '优' | '良' | '中' | '差' | null;
  riskLevel: '低' | '中' | '高' | null;
  metabolicAge: number | null;
  realAge: number;
  bmi: { value: number; level: 'normal' | 'overweight' | 'obese' } | null;
  whr: { value: number; level: 'normal' | 'abnormal' } | null;
  uric: { value: number; level: 'normal' | 'abnormal' } | null;
  metsResult: { matched: number; items: MetSItem[]; diagnosed: boolean };
  deductions: ScoreDeduction[];
  mode: ScoreMode;
  confidence: number;
  coveredCount: number;
  totalRequired: 6;
  /** 各项指标"距今天数 ≥91 天"标记 */
  staleFlags: Partial<Record<'weight' | 'bp' | 'glucose' | 'lipid' | 'uric', boolean>>;
  /** 各项指标使用的 created_at（用于报告页展示采集时间） */
  usedTimestamps: Partial<
    Record<'weight' | 'bp' | 'glucose' | 'lipid' | 'uric', string>
  >;
}

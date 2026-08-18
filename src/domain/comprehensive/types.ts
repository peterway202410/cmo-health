// 代谢综合健康评估 - 类型定义
// 设计原则：
//   - 维度评分制（每维 0-100，自带归一化）
//   - 总分 = Σ(weight × score) / Σ(weight with data)
//   - 仅使用当前数据库可采集到的字段

import type { Profile, BPRecord, GlucoseRecord, LipidRecord, UricRecord, WeightRecord, Questionnaire, Thresholds } from '@/infra/storage/schema';

export type DimensionKey =
  | 'mets_core'
  | 'bp'
  | 'glucose'
  | 'lipid'
  | 'body'
  | 'uric'
  | 'history'
  | 'lifestyle';

export const DIMENSION_LABEL: Record<DimensionKey, string> = {
  mets_core: '代谢综合征核心',
  bp: '血压',
  glucose: '血糖',
  lipid: '血脂',
  body: '体型',
  uric: '尿酸',
  history: '既往与家族史',
  lifestyle: '生活方式',
};

export const DIMENSION_WEIGHT: Record<DimensionKey, number> = {
  mets_core: 25,
  bp: 15,
  glucose: 15,
  lipid: 12,
  body: 10,
  uric: 8,
  history: 10,
  lifestyle: 5,
};

export interface DimensionScore {
  key: DimensionKey;
  label: string;
  weight: number;
  /** 0-100 评分，null 表示该维度无数据，不参与总分 */
  score: number | null;
  /** 主要扣分原因（最多 3 条） */
  reasons: string[];
  /** 子项数据完整度（0-1） */
  coverage: number;
}

export type RiskLevel = 'excellent' | 'good' | 'mild' | 'moderate' | 'high' | 'severe';

export const RISK_LEVEL_INFO: Record<
  RiskLevel,
  { label: string; minScore: number; color: 'good' | 'warn' | 'bad' }
> = {
  excellent: { label: '优秀', minScore: 90, color: 'good' },
  good: { label: '良好', minScore: 80, color: 'good' },
  mild: { label: '轻度风险', minScore: 70, color: 'warn' },
  moderate: { label: '中度风险', minScore: 60, color: 'warn' },
  high: { label: '高风险', minScore: 40, color: 'bad' },
  severe: { label: '极高风险', minScore: 0, color: 'bad' },
};

export interface ComprehensiveResult {
  /** 0-100 总分；至少有效维度权重和 ≥ 60 时才输出完整评分；否则按已有维度归一化的参考评分 */
  score: number;
  level: RiskLevel;
  levelInfo: (typeof RISK_LEVEL_INFO)[RiskLevel];
  /** 数据完整度：已采集维度权重 / 总权重 */
  coverage: number;
  /** 评分模式 */
  mode: 'full' | 'reference' | 'unavailable';
  /** 各维度结果 */
  dimensions: DimensionScore[];
  /** 风险偏移（年）：相对于实际年龄的代谢风险年龄偏移 */
  riskOffsetYears: number;
  /** 真实年龄（用于显示） */
  realAge: number;
}

export interface ComprehensiveInput {
  profile: Profile;
  bp: BPRecord[];
  glucose: GlucoseRecord[];
  lipid: LipidRecord[];
  uric: UricRecord[];
  weight: WeightRecord[];
  questionnaire: Questionnaire | null;
  thresholds: Thresholds;
  now: string;
}

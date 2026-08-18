// 趋势"稳定"判定阈值（绝对值小于阈值视为稳定）
export const TREND_STABLE_THRESHOLD = {
  weight: 0.05, // kg/天
  glucose: 0.02, // mmol/L/天
  score: 0.2, // 分/天
  waist: 0.05, // cm/天
} as const;

export type TrendMetric = keyof typeof TREND_STABLE_THRESHOLD;

import { TREND_STABLE_THRESHOLD, type TrendMetric } from './thresholds';
import { daysBetween } from '@/utils/date';

export type TrendKind = 'rising' | 'falling' | 'stable' | 'insufficient_data';

export function classifyTrend(metric: TrendMetric, slope: number | null): TrendKind {
  if (slope === null || !Number.isFinite(slope)) return 'insufficient_data';
  const t = TREND_STABLE_THRESHOLD[metric];
  if (Math.abs(slope) < t) return 'stable';
  return slope > 0 ? 'rising' : 'falling';
}

/** 时间窗筛选：仅保留 created_at 距 now 不超过 days 天的记录 */
export function filterByWindow<T extends { created_at: string }>(
  items: T[],
  days: 7 | 30 | 90,
  now: string,
): T[] {
  return items.filter((item) => {
    const d = daysBetween(item.created_at, now);
    return d >= 0 && d <= days;
  });
}

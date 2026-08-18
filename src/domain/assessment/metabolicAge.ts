import type { Gender } from '@/infra/storage/schema';

/**
 * 代谢年龄 = clamp(round(realAge + (100-score)*0.3) ± 性别微调, 0, realAge+15)
 * 男性 +1，女性 -1（在合理生理差异区间内）
 */
export function computeMetabolicAge(realAge: number, score: number, gender: Gender): number {
  if (!Number.isFinite(realAge) || !Number.isFinite(score)) return Math.max(0, realAge);
  const base = realAge + (100 - score) * 0.3;
  const adj = gender === 'female' ? -1 : 1;
  const raw = Math.round(base + adj);
  return Math.max(0, Math.min(realAge + 15, raw));
}

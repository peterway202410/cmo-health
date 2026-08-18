/**
 * 最小二乘线性回归 slope。
 * 数据点 < 3 时返回 null（不足以判断趋势）。
 * x 通常为"距首条记录的天数"，y 为指标值。
 */
export function linearRegressionSlope(points: Array<{ x: number; y: number }>): number | null {
  if (!Array.isArray(points) || points.length < 3) return null;

  const valid = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (valid.length < 3) return null;

  const n = valid.length;
  const sumX = valid.reduce((s, p) => s + p.x, 0);
  const sumY = valid.reduce((s, p) => s + p.y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let den = 0;
  for (const p of valid) {
    const dx = p.x - meanX;
    num += dx * (p.y - meanY);
    den += dx * dx;
  }
  if (den === 0) return null;
  return num / den;
}

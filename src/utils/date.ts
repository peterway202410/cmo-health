// ISO 8601 时间工具。

export function nowIso(): string {
  return new Date().toISOString();
}

/** 计算实际年龄；输入 birth_date 'YYYY-MM-DD'，now 为 ISO 字符串 */
export function ageFromBirth(birth_date: string, now: string = nowIso()): number {
  const b = new Date(birth_date);
  const n = new Date(now);
  if (Number.isNaN(b.getTime()) || Number.isNaN(n.getTime())) return 0;
  let age = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) {
    age -= 1;
  }
  return Math.max(0, age);
}

/** 两个日期相差天数（向下取整） */
export function daysBetween(a: string, b: string): number {
  const aMs = new Date(a).getTime();
  const bMs = new Date(b).getTime();
  if (Number.isNaN(aMs) || Number.isNaN(bMs)) return 0;
  return Math.floor((bMs - aMs) / (1000 * 60 * 60 * 24));
}

/** 'YYYY-MM-DD HH:mm' 格式化（用于 UI） */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

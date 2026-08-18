// 字段校验工具：与 requirements.md 第 3.8 物理合法区间一致

export interface RangeRule {
  field: string;
  label: string;
  min: number;
  max: number;
  optional?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * 校验数值是否在 [min, max] 之间。
 * - 若 optional=true 且值为 undefined/null/'' → 视为通过
 * - 否则空值不通过
 */
export function checkRange(
  value: number | undefined | null,
  rule: RangeRule,
): ValidationError | null {
  if (value === undefined || value === null || (value as unknown) === '') {
    if (rule.optional) return null;
    return { field: rule.field, message: `请填写${rule.label}` };
  }
  if (!Number.isFinite(value)) {
    return { field: rule.field, message: `${rule.label}必须为数字` };
  }
  if (value < rule.min || value > rule.max) {
    return {
      field: rule.field,
      message: `${rule.label}应在 ${rule.min} ~ ${rule.max} 之间`,
    };
  }
  return null;
}

/**
 * 把字符串安全转 number；空串/无法解析返回 undefined。
 */
export function toNum(v: string | number | undefined | null): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const trimmed = String(v).trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

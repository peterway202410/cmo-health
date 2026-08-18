// 数据导入：合并去重 / 完全覆盖
// 详见 design.md「Backup Manager」与 requirements R15。

import { storage } from '@/infra/storage/StorageAdapter';
import { KEYS } from '@/infra/storage/keys';
import {
  DEFAULT_THRESHOLDS,
  SCHEMA_VERSION,
  type BackupFile,
  type BPRecord,
  type GlucoseRecord,
  type LipidRecord,
  type Profile,
  type Questionnaire,
  type Settings,
  type Thresholds,
  type UricRecord,
  type WeightRecord,
} from '@/infra/storage/schema';

export type ImportStrategy = 'merge' | 'overwrite';

export interface ImportResult {
  ok: boolean;
  errors: string[];
  applied?: {
    profile: boolean;
    questionnaire: boolean;
    metricsCount: Record<string, number>;
    settings: boolean;
    thresholds: boolean;
  };
}

const SUPPORTED_VERSIONS = new Set<number>([SCHEMA_VERSION]);

/** 解析 JSON 文本，进行结构校验并返回解析后的数据。 */
function parseAndValidate(text: string): { ok: true; file: BackupFile } | { ok: false; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`JSON 解析失败：${(e as Error).message}`] };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, errors: ['备份文件不是合法对象'] };
  }
  const obj = parsed as Record<string, unknown>;

  if (typeof obj.schemaVersion !== 'number') {
    return { ok: false, errors: ['缺少 schemaVersion 字段'] };
  }
  if (!SUPPORTED_VERSIONS.has(obj.schemaVersion)) {
    return {
      ok: false,
      errors: [`不支持的版本：${obj.schemaVersion}（当前应用版本 ${SCHEMA_VERSION}）`],
    };
  }
  if (typeof obj.metrics !== 'object' || obj.metrics === null) {
    return { ok: false, errors: ['缺少 metrics 字段或格式错误'] };
  }
  // 通过基本校验
  return { ok: true, file: parsed as BackupFile };
}

/** 按 created_at 合并两个数组：相同时间戳新覆盖旧；不同时间戳全部保留。 */
function mergeByCreatedAt<T extends { created_at: string }>(local: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  for (const r of local) map.set(r.created_at, r);
  for (const r of incoming) map.set(r.created_at, r);
  return [...map.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export function importFromText(text: string, strategy: ImportStrategy): ImportResult {
  const errors: string[] = [];
  const parsed = parseAndValidate(text);
  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }
  const file = parsed.file as BackupFile & { thresholds?: Thresholds };

  const applied = {
    profile: false,
    questionnaire: false,
    metricsCount: {} as Record<string, number>,
    settings: false,
    thresholds: false,
  };

  try {
    if (strategy === 'overwrite') {
      // 完全覆盖：先清空 cmo:* 全部 keys
      storage.clearAllByPrefix('cmo:');
    }

    // —— Profile ——（覆盖即用文件值，合并时仅在本地无 profile 才写）
    if (file.profile) {
      const local = strategy === 'overwrite' ? null : storage.get<Profile>(KEYS.PROFILE);
      if (strategy === 'overwrite' || !local) {
        storage.set(KEYS.PROFILE, file.profile);
        applied.profile = true;
      }
    }

    // —— Questionnaire ——
    // 覆盖：直接写入文件值
    // 合并：取 created_at 较晚的那个
    if (file.questionnaire) {
      if (strategy === 'overwrite') {
        storage.set(KEYS.QUESTIONNAIRE, file.questionnaire);
        applied.questionnaire = true;
      } else {
        const local = storage.get<Questionnaire>(KEYS.QUESTIONNAIRE);
        const localTs = local ? new Date(local.created_at).getTime() : 0;
        const fileTs = new Date(file.questionnaire.created_at).getTime();
        if (fileTs > localTs) {
          // 把本地的旧 questionnaire 推入历史
          if (local) {
            const hist = storage.get<Questionnaire[]>(KEYS.QUESTIONNAIRE_HISTORY) ?? [];
            storage.set(KEYS.QUESTIONNAIRE_HISTORY, [...hist, local]);
          }
          storage.set(KEYS.QUESTIONNAIRE, file.questionnaire);
          applied.questionnaire = true;
        }
      }
    }

    // 历史快照：合并
    if (Array.isArray(file.questionnaire_history) && file.questionnaire_history.length > 0) {
      const localHist =
        strategy === 'overwrite'
          ? []
          : storage.get<Questionnaire[]>(KEYS.QUESTIONNAIRE_HISTORY) ?? [];
      const merged = mergeByCreatedAt(
        localHist as Array<Questionnaire & { created_at: string }>,
        file.questionnaire_history as Array<Questionnaire & { created_at: string }>,
      );
      storage.set(KEYS.QUESTIONNAIRE_HISTORY, merged);
    }

    // —— Metrics 五类 ——
    const mergeMetric = <T extends { created_at: string }>(
      key: string,
      incoming: T[] | undefined,
      label: string,
    ) => {
      if (!Array.isArray(incoming)) return;
      const local = strategy === 'overwrite' ? [] : storage.get<T[]>(key) ?? [];
      const next = strategy === 'overwrite' ? incoming : mergeByCreatedAt(local, incoming);
      storage.set(key, next);
      applied.metricsCount[label] = next.length;
    };

    if (file.metrics) {
      mergeMetric<WeightRecord>(KEYS.METRICS_WEIGHT, file.metrics.weight, 'weight');
      mergeMetric<BPRecord>(KEYS.METRICS_BP, file.metrics.bp, 'bp');
      mergeMetric<GlucoseRecord>(KEYS.METRICS_GLUCOSE, file.metrics.glucose, 'glucose');
      mergeMetric<LipidRecord>(KEYS.METRICS_LIPID, file.metrics.lipid, 'lipid');
      mergeMetric<UricRecord>(KEYS.METRICS_URIC, file.metrics.uric, 'uric');
    }

    // —— Settings ——
    if (file.settings) {
      storage.set(KEYS.SETTINGS, file.settings);
      applied.settings = true;
    }

    // —— Thresholds ——
    if (file.thresholds) {
      const merged: Thresholds = { ...DEFAULT_THRESHOLDS, ...file.thresholds };
      storage.set(KEYS.THRESHOLDS, merged);
      applied.thresholds = true;
    }

    return { ok: true, errors, applied };
  } catch (e) {
    errors.push(`导入过程出错：${(e as Error).message}`);
    return { ok: false, errors };
  }
}

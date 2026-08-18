// 数据导出：把所有 cmo:* 键收集为一个 BackupFile JSON 对象。

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

/**
 * 收集本地全部数据，生成 BackupFile JSON。
 * 当本地为空时仍输出合法骨架，不抛错。
 */
export function exportToJSON(): BackupFile & { thresholds: Thresholds } {
  const profile = storage.get<Profile>(KEYS.PROFILE);
  const questionnaire = storage.get<Questionnaire>(KEYS.QUESTIONNAIRE);
  const questionnaire_history =
    storage.get<Questionnaire[]>(KEYS.QUESTIONNAIRE_HISTORY) ?? [];
  const weight = storage.get<WeightRecord[]>(KEYS.METRICS_WEIGHT) ?? [];
  const bp = storage.get<BPRecord[]>(KEYS.METRICS_BP) ?? [];
  const glucose = storage.get<GlucoseRecord[]>(KEYS.METRICS_GLUCOSE) ?? [];
  const lipid = storage.get<LipidRecord[]>(KEYS.METRICS_LIPID) ?? [];
  const uric = storage.get<UricRecord[]>(KEYS.METRICS_URIC) ?? [];

  const settings: Settings = storage.get<Settings>(KEYS.SETTINGS) ?? {
    schemaVersion: SCHEMA_VERSION,
    import_strategy_default: 'merge',
  };

  const thresholds: Thresholds = {
    ...DEFAULT_THRESHOLDS,
    ...(storage.get<Partial<Thresholds>>(KEYS.THRESHOLDS) ?? {}),
  };

  const file: BackupFile & { thresholds: Thresholds } = {
    schemaVersion: SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    profile,
    questionnaire,
    questionnaire_history,
    metrics: { weight, bp, glucose, lipid, uric },
    settings,
    thresholds,
  };
  return file;
}

/** 导出时建议的文件名 */
export function defaultExportFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `cmo-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}.json`
  );
}

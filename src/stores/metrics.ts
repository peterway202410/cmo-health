import { defineStore } from 'pinia';
import { storage } from '@/infra/storage/StorageAdapter';
import { KEYS } from '@/infra/storage/keys';
import type {
  WeightRecord,
  BPRecord,
  GlucoseRecord,
  LipidRecord,
  UricRecord,
  ScoreRecord,
} from '@/infra/storage/schema';
import { nowIso } from '@/utils/date';

interface State {
  weight: WeightRecord[];
  bp: BPRecord[];
  glucose: GlucoseRecord[];
  lipid: LipidRecord[];
  uric: UricRecord[];
  score: ScoreRecord[];
}

function withTimestamps<T extends object>(
  input: T,
  createdAt?: string,
): T & { created_at: string; updated_at: string } {
  const now = nowIso();
  return { ...input, created_at: createdAt ?? now, updated_at: now };
}

/**
 * 提交指标后触发评估重算。
 * 用动态 import 避免与 assessmentStore 形成循环依赖。
 */
function triggerAssessment() {
  Promise.resolve().then(async () => {
    const mod = await import('./assessment');
    mod.useAssessmentStore().recompute();
  });
}

/** 维持数组按 created_at 升序，便于 latest = arr[arr.length-1]。 */
function sortByCreatedAt<T extends { created_at: string }>(arr: T[]): T[] {
  return [...arr].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export const useMetricsStore = defineStore('metrics', {
  state: (): State => ({
    weight: [],
    bp: [],
    glucose: [],
    lipid: [],
    uric: [],
    score: [],
  }),
  getters: {
    totalCount(): number {
      return (
        this.weight.length +
        this.bp.length +
        this.glucose.length +
        this.lipid.length +
        this.uric.length
      );
    },
    latestWeight(): WeightRecord | null {
      return this.weight.length ? this.weight[this.weight.length - 1] : null;
    },
    latestBP(): BPRecord | null {
      return this.bp.length ? this.bp[this.bp.length - 1] : null;
    },
    latestGlucose(): GlucoseRecord | null {
      return this.glucose.length ? this.glucose[this.glucose.length - 1] : null;
    },
  },
  actions: {
    load() {
      this.weight = storage.get<WeightRecord[]>(KEYS.METRICS_WEIGHT) ?? [];
      this.bp = storage.get<BPRecord[]>(KEYS.METRICS_BP) ?? [];
      this.glucose = storage.get<GlucoseRecord[]>(KEYS.METRICS_GLUCOSE) ?? [];
      this.lipid = storage.get<LipidRecord[]>(KEYS.METRICS_LIPID) ?? [];
      this.uric = storage.get<UricRecord[]>(KEYS.METRICS_URIC) ?? [];
      this.score = storage.get<ScoreRecord[]>(KEYS.METRICS_SCORE) ?? [];
    },
    addWeight(
      input: { weight_kg?: number; waist_cm?: number; hip_cm?: number },
      created_at?: string,
    ) {
      const rec = withTimestamps(input, created_at);
      this.weight = sortByCreatedAt([...this.weight, rec]);
      storage.set(KEYS.METRICS_WEIGHT, this.weight);
      triggerAssessment();
    },
    addBP(
      input: { systolic_mmHg: number; diastolic_mmHg: number; heart_rate_bpm?: number },
      created_at?: string,
    ) {
      const rec = withTimestamps(input, created_at);
      this.bp = sortByCreatedAt([...this.bp, rec]);
      storage.set(KEYS.METRICS_BP, this.bp);
      triggerAssessment();
    },
    addGlucose(
      input: { fpg_mmol_per_l?: number; pp2h_mmol_per_l?: number; hba1c_pct?: number },
      created_at?: string,
    ) {
      const rec = withTimestamps(input, created_at);
      this.glucose = sortByCreatedAt([...this.glucose, rec]);
      storage.set(KEYS.METRICS_GLUCOSE, this.glucose);
      triggerAssessment();
    },
    addLipid(
      input: {
        tg_mmol_per_l?: number;
        hdl_mmol_per_l?: number;
        ldl_mmol_per_l?: number;
        tc_mmol_per_l?: number;
      },
      created_at?: string,
    ) {
      const rec = withTimestamps(input, created_at);
      this.lipid = sortByCreatedAt([...this.lipid, rec]);
      storage.set(KEYS.METRICS_LIPID, this.lipid);
      triggerAssessment();
    },
    addUric(input: { uric_umol_per_l: number }, created_at?: string) {
      const rec = withTimestamps(input, created_at);
      this.uric = sortByCreatedAt([...this.uric, rec]);
      storage.set(KEYS.METRICS_URIC, this.uric);
      triggerAssessment();
    },

    /**
     * 通用更新：按 created_at 定位记录，替换内容（同时更新 updated_at）。
     * 若 newCreatedAt 给出，则连带改记录的 created_at（用户可能调整了检测时间）。
     */
    updateRecord<K extends 'weight' | 'bp' | 'glucose' | 'lipid' | 'uric'>(
      kind: K,
      original_created_at: string,
      patch: object,
      newCreatedAt?: string,
    ) {
      const keyMap: Record<K, string> = {
        weight: KEYS.METRICS_WEIGHT,
        bp: KEYS.METRICS_BP,
        glucose: KEYS.METRICS_GLUCOSE,
        lipid: KEYS.METRICS_LIPID,
        uric: KEYS.METRICS_URIC,
      } as Record<K, string>;
      const arr = this[kind] as Array<{ created_at: string; updated_at: string }>;
      const idx = arr.findIndex((r) => r.created_at === original_created_at);
      if (idx === -1) return;
      const next = {
        ...arr[idx],
        ...patch,
        created_at: newCreatedAt ?? arr[idx].created_at,
        updated_at: nowIso(),
      };
      const rest = arr.filter((_, i) => i !== idx);
      const updated = sortByCreatedAt([...rest, next]);
      // @ts-expect-error 由 K 决定类型
      this[kind] = updated;
      storage.set(keyMap[kind], updated);
      triggerAssessment();
    },

    /** 通用删除：按 created_at 定位记录。 */
    removeRecord<K extends 'weight' | 'bp' | 'glucose' | 'lipid' | 'uric'>(
      kind: K,
      created_at: string,
    ) {
      const keyMap: Record<K, string> = {
        weight: KEYS.METRICS_WEIGHT,
        bp: KEYS.METRICS_BP,
        glucose: KEYS.METRICS_GLUCOSE,
        lipid: KEYS.METRICS_LIPID,
        uric: KEYS.METRICS_URIC,
      } as Record<K, string>;
      const arr = this[kind] as Array<{ created_at: string }>;
      const next = arr.filter((r) => r.created_at !== created_at);
      // @ts-expect-error 由 K 决定类型
      this[kind] = next;
      storage.set(keyMap[kind], next);
      triggerAssessment();
    },
  },
});

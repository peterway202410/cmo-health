import { defineStore } from 'pinia';
import { useProfileStore } from './profile';
import { useMetricsStore } from './metrics';
import { useQuestionnaireStore } from './questionnaire';
import { useThresholdsStore } from './thresholds';
import { computeAssessment } from '@/domain/assessment';
import { generateRecommendations } from '@/domain/recommendation/rules';
import type { AssessmentResult, AssessmentSnapshot } from '@/domain/assessment/types';
import type { Recommendation } from '@/domain/recommendation/types';
import { storage } from '@/infra/storage/StorageAdapter';
import { KEYS } from '@/infra/storage/keys';
import type { ScoreRecord } from '@/infra/storage/schema';
import { nowIso } from '@/utils/date';

interface State {
  result: AssessmentResult | null;
  recommendations: Recommendation[];
}

function buildSnapshot(): AssessmentSnapshot | null {
  const profile = useProfileStore().profile;
  const m = useMetricsStore();
  const q = useQuestionnaireStore();
  const t = useThresholdsStore();

  if (!profile) return null;

  const last = <T extends { created_at: string }>(arr: T[]): T | undefined =>
    arr.length ? arr[arr.length - 1] : undefined;

  /**
   * 按字段维度找最近一次有值的记录。
   * 数组按 created_at 升序保存，所以从后往前找。
   */
  function findLatestWith<T extends { created_at: string }>(
    arr: T[],
    has: (rec: T) => boolean,
  ): T | undefined {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (has(arr[i])) return arr[i];
    }
    return undefined;
  }

  const maxIso = (...candidates: (string | undefined)[]): string => {
    const list = candidates.filter((x): x is string => !!x);
    if (list.length === 0) return nowIso();
    return list.reduce((a, b) => (new Date(a).getTime() >= new Date(b).getTime() ? a : b));
  };

  // 体重 / 腰围 / 臀围 各取最近一次有值
  const weightRec = findLatestWith(m.weight, (r) => r.weight_kg != null);
  const waistRec = findLatestWith(m.weight, (r) => r.waist_cm != null);
  const hipRec = findLatestWith(m.weight, (r) => r.hip_cm != null);
  const weightLatest =
    weightRec || waistRec || hipRec
      ? {
          weight_kg: weightRec?.weight_kg,
          waist_cm: waistRec?.waist_cm,
          hip_cm: hipRec?.hip_cm,
          created_at: maxIso(weightRec?.created_at, waistRec?.created_at, hipRec?.created_at),
        }
      : undefined;

  // 血糖各字段
  const fpgRec = findLatestWith(m.glucose, (r) => r.fpg_mmol_per_l != null);
  const ppRec = findLatestWith(m.glucose, (r) => r.pp2h_mmol_per_l != null);
  const hbRec = findLatestWith(m.glucose, (r) => r.hba1c_pct != null);
  const glucoseLatest =
    fpgRec || ppRec || hbRec
      ? {
          fpg_mmol_per_l: fpgRec?.fpg_mmol_per_l,
          pp2h_mmol_per_l: ppRec?.pp2h_mmol_per_l,
          hba1c_pct: hbRec?.hba1c_pct,
          created_at: maxIso(fpgRec?.created_at, ppRec?.created_at, hbRec?.created_at),
        }
      : undefined;

  // 血脂各字段
  const tgRec = findLatestWith(m.lipid, (r) => r.tg_mmol_per_l != null);
  const hdlRec = findLatestWith(m.lipid, (r) => r.hdl_mmol_per_l != null);
  const ldlRec = findLatestWith(m.lipid, (r) => r.ldl_mmol_per_l != null);
  const tcRec = findLatestWith(m.lipid, (r) => r.tc_mmol_per_l != null);
  const lipidLatest =
    tgRec || hdlRec || ldlRec || tcRec
      ? {
          tg_mmol_per_l: tgRec?.tg_mmol_per_l,
          hdl_mmol_per_l: hdlRec?.hdl_mmol_per_l,
          ldl_mmol_per_l: ldlRec?.ldl_mmol_per_l,
          tc_mmol_per_l: tcRec?.tc_mmol_per_l,
          created_at: maxIso(
            tgRec?.created_at,
            hdlRec?.created_at,
            ldlRec?.created_at,
            tcRec?.created_at,
          ),
        }
      : undefined;

  return {
    birth_date: profile.birth_date,
    gender: profile.gender,
    height_cm: profile.height_cm,
    has_hypertension: profile.has_hypertension,
    has_diabetes: profile.has_diabetes,
    now: nowIso(),
    latest: {
      weight: weightLatest,
      bp: last(m.bp),
      glucose: glucoseLatest,
      lipid: lipidLatest,
      uric: last(m.uric),
    },
    bpHistory: m.bp.map((r) => ({
      systolic_mmHg: r.systolic_mmHg,
      diastolic_mmHg: r.diastolic_mmHg,
      created_at: r.created_at,
    })),
    questionnaire: q.current,
    thresholds: t.thresholds,
  };
}

export const useAssessmentStore = defineStore('assessment', {
  state: (): State => ({
    result: null,
    recommendations: [],
  }),
  getters: {
    hasScore: (s) => s.result !== null && s.result.score !== null,
  },
  actions: {
    /** 重算并写入 state；评分变化时追加到 cmo:metrics:score 历史，便于趋势页绘图。 */
    recompute() {
      // 确保依赖 store 已 load
      const profileStore = useProfileStore();
      const metricsStore = useMetricsStore();
      const qStore = useQuestionnaireStore();
      const thresholdsStore = useThresholdsStore();

      if (!profileStore.profile) profileStore.load();
      if (
        metricsStore.weight.length === 0 &&
        metricsStore.bp.length === 0 &&
        metricsStore.glucose.length === 0 &&
        metricsStore.lipid.length === 0 &&
        metricsStore.uric.length === 0
      ) {
        metricsStore.load();
      }
      if (!qStore.current) qStore.load();
      thresholdsStore.load();

      const snapshot = buildSnapshot();
      if (!snapshot) {
        this.result = null;
        this.recommendations = [];
        return;
      }

      const result = computeAssessment(snapshot);
      this.result = result;
      this.recommendations = generateRecommendations(result.deductions);

      // 评分历史：仅在有评分且与最近一条不同（或第一次）时追加
      if (result.score !== null) {
        const prev = metricsStore.score;
        const last = prev.length ? prev[prev.length - 1] : null;
        if (!last || last.score !== result.score) {
          const next: ScoreRecord = {
            score: result.score,
            created_at: snapshot.now,
          };
          const updated = [...prev, next];
          metricsStore.score = updated;
          storage.set(KEYS.METRICS_SCORE, updated);
        }
      }
    },
  },
});

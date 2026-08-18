import { defineStore } from 'pinia';
import { storage } from '@/infra/storage/StorageAdapter';
import { KEYS } from '@/infra/storage/keys';
import type { Questionnaire } from '@/infra/storage/schema';
import { nowIso } from '@/utils/date';

interface State {
  current: Questionnaire | null;
  history: Questionnaire[];
}

export const useQuestionnaireStore = defineStore('questionnaire', {
  state: (): State => ({
    current: null,
    history: [],
  }),
  getters: {
    isFilled: (s) => s.current !== null,
  },
  actions: {
    load() {
      this.current = storage.get<Questionnaire>(KEYS.QUESTIONNAIRE);
      this.history = storage.get<Questionnaire[]>(KEYS.QUESTIONNAIRE_HISTORY) ?? [];
    },
    /** 提交新问卷：旧问卷 append 到历史快照表，再覆盖当前问卷。 */
    save(input: Omit<Questionnaire, 'created_at'>) {
      const created_at = nowIso();
      const next: Questionnaire = { ...input, created_at };

      // 历史快照（仅保留旧的，不含本次）
      if (this.current) {
        this.history = [...this.history, this.current];
        storage.set(KEYS.QUESTIONNAIRE_HISTORY, this.history);
      }

      this.current = next;
      storage.set(KEYS.QUESTIONNAIRE, next);

      // 触发评估重算（动态 import 防循环）
      Promise.resolve().then(async () => {
        const mod = await import('./assessment');
        mod.useAssessmentStore().recompute();
      });
    },
    clear() {
      storage.remove(KEYS.QUESTIONNAIRE);
      storage.remove(KEYS.QUESTIONNAIRE_HISTORY);
      this.current = null;
      this.history = [];
    },
  },
});

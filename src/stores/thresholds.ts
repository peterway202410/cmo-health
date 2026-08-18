import { defineStore } from 'pinia';
import { storage } from '@/infra/storage/StorageAdapter';
import { KEYS } from '@/infra/storage/keys';
import { DEFAULT_THRESHOLDS, type Thresholds } from '@/infra/storage/schema';

interface State {
  thresholds: Thresholds;
}

export const useThresholdsStore = defineStore('thresholds', {
  state: (): State => ({
    thresholds: { ...DEFAULT_THRESHOLDS },
  }),
  actions: {
    load() {
      const saved = storage.get<Partial<Thresholds>>(KEYS.THRESHOLDS);
      // 与默认值合并，保证未来新增字段自动有默认值
      this.thresholds = { ...DEFAULT_THRESHOLDS, ...(saved ?? {}) };
    },
    update(partial: Partial<Thresholds>) {
      this.thresholds = { ...this.thresholds, ...partial };
      storage.set(KEYS.THRESHOLDS, this.thresholds);
      // 触发评估重算
      Promise.resolve().then(async () => {
        const mod = await import('./assessment');
        mod.useAssessmentStore().recompute();
      });
    },
    resetAll() {
      this.thresholds = { ...DEFAULT_THRESHOLDS };
      storage.set(KEYS.THRESHOLDS, this.thresholds);
      Promise.resolve().then(async () => {
        const mod = await import('./assessment');
        mod.useAssessmentStore().recompute();
      });
    },
  },
});

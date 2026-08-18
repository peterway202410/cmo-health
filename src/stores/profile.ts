import { defineStore } from 'pinia';
import { storage } from '@/infra/storage/StorageAdapter';
import { KEYS } from '@/infra/storage/keys';
import type { Profile } from '@/infra/storage/schema';
import { ageFromBirth, nowIso } from '@/utils/date';

interface State {
  profile: Profile | null;
}

export const useProfileStore = defineStore('profile', {
  state: (): State => ({
    profile: null,
  }),
  getters: {
    isInitialized: (s) => s.profile !== null,
    realAge: (s) => (s.profile ? ageFromBirth(s.profile.birth_date) : null),
  },
  actions: {
    load() {
      this.profile = storage.get<Profile>(KEYS.PROFILE);
    },
    save(input: Omit<Profile, 'created_at' | 'updated_at'>) {
      const now = nowIso();
      const created_at = this.profile?.created_at ?? now;
      const profile: Profile = {
        ...input,
        created_at,
        updated_at: now,
      };
      storage.set(KEYS.PROFILE, profile);
      this.profile = profile;
    },
    clear() {
      storage.remove(KEYS.PROFILE);
      this.profile = null;
    },
  },
});

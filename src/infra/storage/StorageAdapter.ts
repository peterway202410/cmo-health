// 跨端存储适配层。封装 uni-app 的同步存储 API。
// 详见 design.md「Storage Adapter」。

import { KEY_PREFIX } from './keys';

export interface StorageAdapter {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  clearAllByPrefix(prefix: string): void;
  listKeys(): string[];
}

class UniStorageAdapter implements StorageAdapter {
  get<T>(key: string): T | null {
    try {
      const raw = uni.getStorageSync(key);
      if (raw === '' || raw == null) return null;
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw) as T;
        } catch {
          return null;
        }
      }
      // uni 在某些平台直接返回对象
      return raw as T;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      uni.setStorageSync(key, JSON.stringify(value));
    } catch (e) {
      console.error('[storage.set] failed', key, e);
    }
  }

  remove(key: string): void {
    try {
      uni.removeStorageSync(key);
    } catch (e) {
      console.error('[storage.remove] failed', key, e);
    }
  }

  listKeys(): string[] {
    try {
      const info = uni.getStorageInfoSync();
      return info.keys || [];
    } catch {
      return [];
    }
  }

  clearAllByPrefix(prefix: string): void {
    const keys = this.listKeys();
    for (const k of keys) {
      if (k.startsWith(prefix)) {
        this.remove(k);
      }
    }
  }
}

export const storage: StorageAdapter = new UniStorageAdapter();
export { KEY_PREFIX };

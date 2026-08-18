import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KEYS } from '@/infra/storage/keys';
import { SCHEMA_VERSION, type BackupFile, type Profile } from '@/infra/storage/schema';

const mem = vi.hoisted(() => new Map<string, string>());

vi.mock('@/infra/storage/StorageAdapter', () => ({
  KEY_PREFIX: 'cmo:',
  storage: {
    get<T>(key: string): T | null {
      const raw = mem.get(key);
      if (raw == null) return null;
      return JSON.parse(raw) as T;
    },
    set<T>(key: string, value: T) {
      mem.set(key, JSON.stringify(value));
    },
    remove(key: string) {
      mem.delete(key);
    },
    listKeys() {
      return [...mem.keys()];
    },
    clearAllByPrefix(prefix: string) {
      for (const key of [...mem.keys()]) {
        if (key.startsWith(prefix)) mem.delete(key);
      }
    },
  },
}));

import { exportToJSON, defaultExportFilename } from '@/infra/backup/exporter';
import { importFromText } from '@/infra/backup/importer';

function emptyBackup(overrides: Partial<BackupFile> = {}): BackupFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    exported_at: '2026-08-18T00:00:00.000Z',
    profile: null,
    questionnaire: null,
    questionnaire_history: [],
    metrics: { weight: [], bp: [], glucose: [], lipid: [], uric: [] },
    settings: { schemaVersion: SCHEMA_VERSION, import_strategy_default: 'merge' },
    ...overrides,
  };
}

const sampleProfile: Profile = {
  birth_date: '1988-05-20',
  gender: 'female',
  height_cm: 162,
  has_hypertension: false,
  has_diabetes: false,
  has_hypercholesterolemia: false,
  has_hyperuricemia: false,
  has_fatty_liver: false,
  has_carotid_plaque: false,
  has_stroke_history: false,
  has_family_metabolic_history: false,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('backup import / export', () => {
  beforeEach(() => {
    mem.clear();
  });

  it('rejects invalid JSON and unknown schema versions', () => {
    expect(importFromText('not-json', 'merge').ok).toBe(false);
    expect(importFromText(JSON.stringify({ hello: 1 }), 'merge').ok).toBe(false);
    expect(
      importFromText(
        JSON.stringify({ ...emptyBackup(), schemaVersion: 99 }),
        'merge',
      ).ok,
    ).toBe(false);
  });

  it('exports an empty-but-valid skeleton', () => {
    const file = exportToJSON();
    expect(file.schemaVersion).toBe(1);
    expect(file.profile).toBeNull();
    expect(file.metrics.bp).toEqual([]);
    expect(file.thresholds.bmi_overweight).toBe(24);
    expect(defaultExportFilename()).toMatch(/^cmo-backup-\d{8}-\d{4}\.json$/);
  });

  it('merges metrics by created_at and keeps the incoming row on conflict', () => {
    mem.set(
      KEYS.METRICS_BP,
      JSON.stringify([
        {
          systolic_mmHg: 120,
          diastolic_mmHg: 80,
          created_at: '2026-08-01T00:00:00.000Z',
          updated_at: '2026-08-01T00:00:00.000Z',
        },
      ]),
    );

    const incoming = emptyBackup({
      metrics: {
        weight: [],
        bp: [
          {
            systolic_mmHg: 130,
            diastolic_mmHg: 85,
            created_at: '2026-08-01T00:00:00.000Z',
            updated_at: '2026-08-02T00:00:00.000Z',
          },
          {
            systolic_mmHg: 118,
            diastolic_mmHg: 76,
            created_at: '2026-08-10T00:00:00.000Z',
            updated_at: '2026-08-10T00:00:00.000Z',
          },
        ],
        glucose: [],
        lipid: [],
        uric: [],
      },
    });

    const result = importFromText(JSON.stringify(incoming), 'merge');
    expect(result.ok).toBe(true);
    const stored = JSON.parse(mem.get(KEYS.METRICS_BP)!) as Array<{
      systolic_mmHg: number;
      created_at: string;
    }>;
    expect(stored).toHaveLength(2);
    expect(stored[0].systolic_mmHg).toBe(130);
    expect(stored[1].created_at).toBe('2026-08-10T00:00:00.000Z');
  });

  it('does not overwrite an existing profile when merging', () => {
    mem.set(KEYS.PROFILE, JSON.stringify(sampleProfile));
    const incoming = emptyBackup({
      profile: { ...sampleProfile, height_cm: 180, gender: 'male' },
    });
    importFromText(JSON.stringify(incoming), 'merge');
    expect(JSON.parse(mem.get(KEYS.PROFILE)!).height_cm).toBe(162);
  });

  it('overwrite clears previous metrics then writes the file', () => {
    mem.set(
      KEYS.METRICS_URIC,
      JSON.stringify([
        {
          uric_umol_per_l: 500,
          created_at: '2026-07-01T00:00:00.000Z',
          updated_at: '2026-07-01T00:00:00.000Z',
        },
      ]),
    );
    const incoming = emptyBackup({
      profile: sampleProfile,
      metrics: {
        weight: [],
        bp: [],
        glucose: [],
        lipid: [],
        uric: [
          {
            uric_umol_per_l: 360,
            created_at: '2026-08-01T00:00:00.000Z',
            updated_at: '2026-08-01T00:00:00.000Z',
          },
        ],
      },
    });
    const result = importFromText(JSON.stringify(incoming), 'overwrite');
    expect(result.ok).toBe(true);
    expect(JSON.parse(mem.get(KEYS.METRICS_URIC)!)).toHaveLength(1);
    expect(JSON.parse(mem.get(KEYS.PROFILE)!).birth_date).toBe('1988-05-20');
  });

  it('round-trips export after import', () => {
    const incoming = emptyBackup({ profile: sampleProfile });
    expect(importFromText(JSON.stringify(incoming), 'overwrite').ok).toBe(true);
    const exported = exportToJSON();
    expect(exported.profile?.birth_date).toBe('1988-05-20');
    expect(exported.schemaVersion).toBe(1);
  });
});

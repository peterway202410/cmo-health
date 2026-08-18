export const KEY_PREFIX = 'cmo:';

export const KEYS = {
  PROFILE: 'cmo:profile',
  QUESTIONNAIRE: 'cmo:questionnaire',
  QUESTIONNAIRE_HISTORY: 'cmo:questionnaire:history',
  METRICS_WEIGHT: 'cmo:metrics:weight',
  METRICS_BP: 'cmo:metrics:bp',
  METRICS_GLUCOSE: 'cmo:metrics:glucose',
  METRICS_LIPID: 'cmo:metrics:lipid',
  METRICS_URIC: 'cmo:metrics:uric',
  METRICS_SCORE: 'cmo:metrics:score',
  SETTINGS: 'cmo:settings',
  THRESHOLDS: 'cmo:thresholds',
} as const;

export type StorageKey = (typeof KEYS)[keyof typeof KEYS];

// 数据 Schema 定义。详见 .kiro/specs/chief-metabolic-officer/design.md「Data Models」。

export const SCHEMA_VERSION = 1 as const;

export type Gender = 'male' | 'female';

export interface Profile {
  birth_date: string; // 'YYYY-MM-DD'
  gender: Gender;
  height_cm: number;
  has_hypertension: boolean;
  has_diabetes: boolean;
  has_hypercholesterolemia: boolean;
  has_hyperuricemia: boolean;
  has_fatty_liver: boolean;
  has_carotid_plaque: boolean;
  has_stroke_history: boolean;
  has_family_metabolic_history: boolean;
  /** 活动水平：用于 TDEE 计算 */
  activity?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | 'unknown';
  created_at: string;
  updated_at: string;
}

export interface Questionnaire {
  sleep_hours: number;
  sleep_quality: 1 | 2 | 3 | 4 | 5;
  late_night_per_week: number;
  sugary_drink_per_week: number;
  midnight_snack_per_week: number;
  takeout_per_week: number;
  exercise_per_week: number;
  sedentary_hours_per_day: number;
  alcohol_per_week: number;
  smoking: boolean;
  stress_level: 1 | 2 | 3 | 4 | 5;
  created_at: string;
}

export interface BaseRecord {
  created_at: string;
  updated_at: string;
}

export interface WeightRecord extends BaseRecord {
  weight_kg?: number;
  waist_cm?: number;
  hip_cm?: number;
  /** 测量时段：任意 / 晨起 / 睡前 */
  period?: 'any' | 'morning' | 'bedtime';
}

export interface BPRecord extends BaseRecord {
  systolic_mmHg: number;
  diastolic_mmHg: number;
  heart_rate_bpm?: number;
}

export interface GlucoseRecord extends BaseRecord {
  fpg_mmol_per_l?: number;
  pp2h_mmol_per_l?: number;
  hba1c_pct?: number;
}

export interface LipidRecord extends BaseRecord {
  tg_mmol_per_l?: number;
  hdl_mmol_per_l?: number;
  ldl_mmol_per_l?: number;
  tc_mmol_per_l?: number;
}

export interface UricRecord extends BaseRecord {
  uric_umol_per_l: number;
}

export interface ScoreRecord {
  score: number;
  created_at: string;
}

export interface Settings {
  schemaVersion: typeof SCHEMA_VERSION;
  import_strategy_default: 'merge' | 'overwrite';
}

/** 用户可调的参考值（阈值）。所有字段都可被用户覆盖；未覆盖的字段使用默认值。 */
export interface Thresholds {
  // BMI
  bmi_overweight: number; // 默认 24
  bmi_obese: number; // 默认 28
  // 腰围（代谢综合征腹型肥胖）
  waist_male_cm: number; // 默认 90
  waist_female_cm: number; // 默认 85
  // 腰臀比
  whr_male: number; // 默认 0.9
  whr_female: number; // 默认 0.85
  // 血压（代谢综合征用）
  bp_sys_mmHg: number; // 默认 135（家庭血压偏高标准）
  bp_dia_mmHg: number; // 默认 85
  /** 判定"反复偏高"的窗口天数 */
  bp_window_days: number; // 默认 7
  /** 判定"反复偏高"的次数阈值（窗口内 ≥X 次满足才算） */
  bp_repeated_count: number; // 默认 5
  // 血糖（代谢综合征用）
  fpg_mmol: number; // 默认 6.1
  pp2h_mmol: number; // 默认 7.8
  // 血脂
  tg_mmol: number; // 默认 1.7
  hdl_mmol: number; // 默认 1.04（低于此值视为偏低）
  // 尿酸
  uric_male: number; // 默认 420
  uric_female: number; // 默认 360
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  bmi_overweight: 24,
  bmi_obese: 28,
  waist_male_cm: 90,
  waist_female_cm: 85,
  whr_male: 0.9,
  whr_female: 0.85,
  bp_sys_mmHg: 135,
  bp_dia_mmHg: 85,
  bp_window_days: 7,
  bp_repeated_count: 5,
  fpg_mmol: 6.1,
  pp2h_mmol: 7.8,
  tg_mmol: 1.7,
  hdl_mmol: 1.04,
  uric_male: 420,
  uric_female: 360,
};

export interface MetricsBundle {
  weight: WeightRecord[];
  bp: BPRecord[];
  glucose: GlucoseRecord[];
  lipid: LipidRecord[];
  uric: UricRecord[];
}

export interface BackupFile {
  schemaVersion: typeof SCHEMA_VERSION;
  exported_at: string;
  profile: Profile | null;
  questionnaire: Questionnaire | null;
  questionnaire_history: Questionnaire[];
  metrics: MetricsBundle;
  settings: Settings;
  thresholds?: Thresholds;
}

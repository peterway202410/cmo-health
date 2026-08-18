export type RecCategory = 'diet' | 'exercise' | 'lifestyle';

export interface Recommendation {
  category: RecCategory;
  text: string;
  source: 'risk_factor' | 'general';
  factor?: string;
}

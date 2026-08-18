// 通用建议词条：当某类风险因子为 0 时使用
import type { Recommendation } from './types';

export const GENERAL_RECS: Record<'diet' | 'exercise' | 'lifestyle', Recommendation[]> = {
  diet: [
    {
      category: 'diet',
      text: '保持膳食均衡，每日摄入足量蔬菜与全谷物，控制精制糖与饱和脂肪。',
      source: 'general',
    },
    {
      category: 'diet',
      text: '少盐少油少糖；用茶水或白开水代替含糖饮料。',
      source: 'general',
    },
  ],
  exercise: [
    {
      category: 'exercise',
      text: '建议每周 150 分钟以上中等强度有氧运动，可分散到 5 天进行。',
      source: 'general',
    },
    {
      category: 'exercise',
      text: '工作时每隔 1 小时起身活动 2–3 分钟，有助于改善代谢。',
      source: 'general',
    },
  ],
  lifestyle: [
    {
      category: 'lifestyle',
      text: '保持规律作息，每日 7 小时左右优质睡眠。',
      source: 'general',
    },
    {
      category: 'lifestyle',
      text: '通过冥想、散步或兴趣爱好缓解压力，避免长期紧张状态。',
      source: 'general',
    },
  ],
};

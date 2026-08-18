// 行动建议生成：固定 3 条，三类（饮食/运动/生活方式）各 1 条
import type { ScoreDeduction } from '../assessment/types';
import { GENERAL_RECS } from './catalog';
import type { RecCategory, Recommendation } from './types';

// 因子 → 类别映射
const FACTOR_CATEGORY: Record<string, RecCategory> = {
  // 饮食
  central_obesity: 'diet',
  high_tg: 'diet',
  low_hdl: 'diet',
  hyperglycemia: 'diet',
  sugary_drink: 'diet',
  takeout: 'diet',
  midnight_snack: 'diet',
  // 运动
  bmi: 'exercise',
  whr: 'exercise',
  sedentary: 'exercise',
  exercise: 'exercise',
  // 生活方式
  hypertension: 'lifestyle',
  uric: 'lifestyle',
  late_night: 'lifestyle',
  smoking: 'lifestyle',
  alcohol: 'lifestyle',
  stress: 'lifestyle',
  sleep_quality: 'lifestyle',
};

// 因子 → 具体建议文案
const FACTOR_TEXT: Record<string, string> = {
  // 饮食
  central_obesity: '腰围偏高，建议减少精制碳水与含糖饮料，配合饭后散步。',
  high_tg: '甘油三酯偏高，减少油炸与肥肉摄入，多吃深海鱼与豆类。',
  low_hdl: 'HDL 偏低，适度增加坚果、橄榄油等不饱和脂肪并坚持有氧运动。',
  hyperglycemia: '血糖偏高，建议低 GI 主食、控制总热量并固定就餐时间。',
  sugary_drink: '含糖饮料摄入过多，用白水或无糖茶替代是最直接的改善。',
  takeout: '外卖频次较高，留意盐与油摄入；可逐步增加在家烹饪比例。',
  midnight_snack: '夜宵频繁，建议晚餐后 3 小时内不再进食，给消化系统休息时间。',

  // 运动
  bmi: '体重偏高，结合饮食控制与每周 3–5 次有氧运动效果更佳。',
  whr: '腰臀比偏高，针对腹部脂肪做核心训练 + 中等强度有氧。',
  sedentary: '久坐时间过长，工作时使用站立桌或每小时活动 5 分钟。',
  exercise: '当前运动量不足，可从快走 30 分钟/天起步，逐步增加。',

  // 生活方式
  hypertension: '血压偏高，限盐每日 < 5g，监测血压趋势并保持充足睡眠。',
  uric: '尿酸偏高，少食动物内脏与浓汤，多喝水帮助代谢。',
  late_night: '熬夜频繁，长期会扰乱代谢，争取在 23 点前入睡。',
  smoking: '戒烟可显著改善心血管与代谢健康；可考虑专业戒烟支持。',
  alcohol: '饮酒频次偏高，建议每周不超过 2 次且单次少量。',
  stress: '压力较大，每天 10 分钟正念或散步有助于神经放松。',
  sleep_quality: '睡眠质量较差，睡前减少蓝光与咖啡因摄入。',
};

export function generateRecommendations(
  riskFactors: ScoreDeduction[],
): [Recommendation, Recommendation, Recommendation] {
  // 按 points 降序，权重高的优先
  const sorted = [...riskFactors].sort((a, b) => b.points - a.points);

  const picked: Record<RecCategory, Recommendation | null> = {
    diet: null,
    exercise: null,
    lifestyle: null,
  };

  for (const f of sorted) {
    const cat = FACTOR_CATEGORY[f.factor];
    if (!cat || picked[cat]) continue;
    const text = FACTOR_TEXT[f.factor];
    if (!text) continue;
    picked[cat] = {
      category: cat,
      text,
      source: 'risk_factor',
      factor: f.factor,
    };
  }

  // 缺类用通用建议补齐
  const fillFromGeneral = (cat: RecCategory): Recommendation => {
    const pool = GENERAL_RECS[cat];
    return pool[0]; // 取首条；调用方需求是确定性输出
  };

  return [
    picked.diet ?? fillFromGeneral('diet'),
    picked.exercise ?? fillFromGeneral('exercise'),
    picked.lifestyle ?? fillFromGeneral('lifestyle'),
  ];
}

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useMetricsStore } from '@/stores/metrics';
import { useProfileStore } from '@/stores/profile';
import AppTabBar from '@/components/AppTabBar.vue';
import { assessUric, type UricLevel, type UricRisk } from '@/domain/analysis/uric';
import { formatDateTime } from '@/utils/date';

const metricsStore = useMetricsStore();
const profileStore = useProfileStore();

function refresh() {
  metricsStore.load();
  profileStore.load();
}
onMounted(refresh);
onShow(refresh);

const result = computed(() => {
  const profile = profileStore.profile;
  if (!profile) return null;
  return assessUric({ records: metricsStore.uric, gender: profile.gender });
});

const isFemale = computed(() => profileStore.profile?.gender === 'female');

const riskInfo = computed(() => {
  const r = result.value?.classify?.risk;
  if (!r) return 'risk-low';
  return ({ good: 'risk-low', medium: 'risk-mid', high: 'risk-high' } as Record<UricRisk, string>)[r];
});

function tagClass(risk: UricRisk | undefined): string {
  if (risk === 'good') return 'tag-good';
  if (risk === 'medium') return 'tag-warn';
  if (risk === 'high') return 'tag-bad';
  return '';
}

function trendLabel(dir: string): string {
  return (
    {
      up: '上升趋势',
      down: '下降趋势',
      stable: '相对稳定',
      insufficient: '数据不足',
    }[dir] ?? '—'
  );
}

function trendTagClass(dir: string): string {
  if (dir === 'up') return 'tag-bad';
  if (dir === 'down') return 'tag-good';
  if (dir === 'stable') return 'tag-good';
  return '';
}

function levelInterpret(): string {
  const c = result.value?.classify;
  if (!c) return '';
  switch (c.level) {
    case 'too_low':
      return '尿酸过低（< 120 μmol/L），建议排查遗传代谢病或肾小管功能障碍。';
    case 'treatment_lower':
      return '处于降尿酸治疗下限附近（120-179 μmol/L）。如在用药，建议评估是否过量。';
    case 'goal_gout':
      return '处于"溶石点"达标范围（180-299 μmol/L），适用于有痛风石史或已发作痛风的患者。继续保持，每年复查。';
    case 'goal_normal':
      return '处于"溶晶点"达标范围（300-359 μmol/L），属普通人群理想区间。继续保持，每年复查。';
    case 'normal_high':
      return '处于正常高值，建议控制饮食、多饮水、规律运动，3-6 个月后复查。';
    case 'suspected':
      return '已达高尿酸血症区间，建议优化生活方式：减少高嘌呤食物、避免酒精和含糖饮料、多饮水（≥ 2000 ml/天），3-6 个月后复查。';
    case 'suspected_treat':
      return '尿酸明显偏高，建议尽快就医，评估是否启动降尿酸药物治疗。';
    case 'severe':
      return '尿酸水平已达重度高尿酸血症，建议立即就医，制定系统治疗方案。';
    default:
      return '';
  }
}

function trendInterpret(): string {
  const t = result.value?.trend;
  if (!t || t.dir === 'insufficient') return '至少需要 2 次记录才能分析趋势。';
  if (t.dir === 'up') return `近期均值上升 ${t.diff} μmol/L，需注意饮食与生活习惯。`;
  if (t.dir === 'down') return `近期均值下降 ${Math.abs(t.diff ?? 0)} μmol/L，趋势良好。`;
  return '近期尿酸水平相对稳定。';
}

function frequencyHint(): string | null {
  if ((result.value?.count ?? 0) < 3) return '建议增加监测频率，至少 3 次记录可生成更稳定的评估。';
  return null;
}

// 标尺：男女不同
interface ScaleItem {
  range: string;
  label: string;
  active: boolean;
  level: UricLevel;
}

const maleSegments: ScaleItem[] = [
  { range: '<120', label: '过低', active: false, level: 'too_low' },
  { range: '120-179', label: '降治下限', active: false, level: 'treatment_lower' },
  { range: '180-299', label: '溶石点', active: false, level: 'goal_gout' },
  { range: '300-359', label: '溶晶点', active: false, level: 'goal_normal' },
  { range: '360-419', label: '正常高值', active: false, level: 'normal_high' },
  { range: '420-539', label: '疑似', active: false, level: 'suspected' },
  { range: '540-699', label: '需治疗', active: false, level: 'suspected_treat' },
  { range: '≥700', label: '重度', active: false, level: 'severe' },
];

const femaleSegments: ScaleItem[] = [
  { range: '<120', label: '过低', active: false, level: 'too_low' },
  { range: '120-179', label: '降治下限', active: false, level: 'treatment_lower' },
  { range: '180-299', label: '溶晶点', active: false, level: 'goal_normal' },
  { range: '300-359', label: '正常高值', active: false, level: 'normal_high' },
  { range: '360-419', label: '疑似', active: false, level: 'suspected' },
  { range: '420-699', label: '需治疗', active: false, level: 'suspected_treat' },
  { range: '≥700', label: '重度', active: false, level: 'severe' },
];

const scaleItems = computed(() => {
  const segs = (isFemale.value ? femaleSegments : maleSegments).map((s) => ({ ...s }));
  const lvl = result.value?.classify?.level;
  if (lvl) {
    const idx = segs.findIndex((s) => s.level === lvl);
    if (idx >= 0) segs[idx].active = true;
  }
  return segs;
});
</script>

<template>
  <view class="page">
    <view v-if="!result" class="empty">
      <text class="empty-text">需要先填写基础档案</text>
    </view>
    <view v-else-if="!result.hasData" class="empty">
      <text class="empty-text">尚未录入尿酸记录</text>
    </view>

    <view v-else class="container">
      <!-- 顶部分级横幅 -->
      <view class="risk-banner" :class="riskInfo">
        <text class="risk-label">尿酸分级</text>
        <text class="risk-level">{{ result.classify?.label }}</text>
        <text class="risk-reason">
          性别参考：{{ isFemale ? '女性' : '男性' }}
        </text>
      </view>

      <!-- 1. 最新值 -->
      <view v-if="result.latest" class="card">
        <view class="card-head">
          <text class="card-num">1.</text>
          <text class="card-title">最新一次记录</text>
          <text class="tag" :class="tagClass(result.classify?.risk)">
            {{ result.classify?.label }}
          </text>
        </view>
        <view class="big-value">
          <text class="big-num">{{ result.latest.uric_umol_per_l }}</text>
          <text class="big-unit">μmol/L</text>
        </view>
        <view class="meta-row">
          <text class="meta-label">采集时间</text>
          <text class="meta-value">{{ formatDateTime(result.latest.created_at) }}</text>
        </view>
        <text class="card-text">{{ levelInterpret() }}</text>
      </view>

      <!-- 2. 标尺 -->
      <view class="card">
        <view class="card-head">
          <text class="card-num">2.</text>
          <text class="card-title">分级标尺</text>
        </view>
        <view class="scale-list">
          <view
            v-for="(seg, i) in scaleItems"
            :key="i"
            class="scale-row"
            :class="{ active: seg.active }"
          >
            <view class="scale-range-cell">{{ seg.range }}</view>
            <view class="scale-label-cell">{{ seg.label }}</view>
            <view v-if="seg.active" class="scale-marker">●</view>
          </view>
        </view>
      </view>

      <!-- 3. 趋势 -->
      <view class="card">
        <view class="card-head">
          <text class="card-num">3.</text>
          <text class="card-title">尿酸趋势</text>
          <text class="tag" :class="trendTagClass(result.trend.dir)">
            {{ trendLabel(result.trend.dir) }}
          </text>
        </view>
        <view v-if="result.trend.diff != null" class="meta-row">
          <text class="meta-label">前 3 次均值 vs 后 3 次均值</text>
          <text class="meta-value">
            {{ result.trend.diff > 0 ? '+' : '' }}{{ result.trend.diff }} μmol/L
          </text>
        </view>
        <text class="card-text">{{ trendInterpret() }}</text>
      </view>

      <!-- 4. 统计 -->
      <view class="card">
        <view class="card-head">
          <text class="card-num">4.</text>
          <text class="card-title">数据统计</text>
        </view>
        <view class="meta-row">
          <text class="meta-label">总记录数</text>
          <text class="meta-value">{{ result.count }} 条</text>
        </view>
        <view v-if="result.stats.avg != null" class="meta-row">
          <text class="meta-label">平均</text>
          <text class="meta-value">{{ result.stats.avg }} μmol/L</text>
        </view>
        <view v-if="result.stats.min != null && result.stats.max != null" class="meta-row">
          <text class="meta-label">范围</text>
          <text class="meta-value">{{ result.stats.min }} - {{ result.stats.max }}</text>
        </view>
      </view>

      <view v-if="frequencyHint()" class="alert">{{ frequencyHint() }}</view>

      <!-- 健康建议 -->
      <view class="opinion">
        <text class="opinion-label">健康建议</text>
        <text class="opinion-text">
          少吃动物内脏、浓汤、海鲜等高嘌呤食物；
          避免酒精（尤其啤酒）和含糖饮料（果糖促进尿酸生成）；
          每日饮水 ≥ 2000 ml 帮助代谢；
          规律有氧运动，避免剧烈无氧；
          控制体重；3-6 个月复查；
          若曾发作痛风或合并慢性肾病，请遵医嘱定期监测。
        </text>
      </view>
    </view>
    <AppTabBar active="analysis" />
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.page {
  min-height: 100vh;
  padding: 32rpx 0 60rpx;
}

.container {
  width: 100%;
  max-width: 720rpx;
  margin: 0 auto;
  padding: 0 32rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.empty {
  text-align: center;
  padding: 80rpx 32rpx;
}

.empty-text {
  font-size: 28rpx;
  color: $color-text-muted;
}

.risk-banner {
  background: $color-surface;
  border-radius: $radius-lg;
  padding: 40rpx 32rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  border-top: 8rpx solid $color-border;
  box-shadow: $shadow-sm;
}

.risk-banner.risk-low {
  border-top-color: $color-success;
}

.risk-banner.risk-mid {
  border-top-color: $color-warning;
}

.risk-banner.risk-high {
  border-top-color: $color-danger;
}

.risk-label {
  font-size: 24rpx;
  color: $color-text-muted;
}

.risk-level {
  font-size: 48rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
  text-align: center;
  line-height: 1.4;
}

.risk-banner.risk-low .risk-level {
  color: $color-success;
}

.risk-banner.risk-mid .risk-level {
  color: $color-warning;
}

.risk-banner.risk-high .risk-level {
  color: $color-danger;
}

.risk-reason {
  font-size: 24rpx;
  color: $color-text-muted;
}

.card {
  background: $color-surface;
  border-radius: $radius-lg;
  padding: 28rpx 32rpx;
  box-shadow: $shadow-sm;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.card-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
}

.card-num {
  font-size: 30rpx;
  font-weight: 700;
  color: $color-text-strong;
}

.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $color-text-strong;
}

.tag {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-weight: 500;
}

.tag-good {
  color: $color-success;
  background: rgba(46, 184, 114, 0.12);
}

.tag-warn {
  color: $color-warning;
  background: rgba(224, 159, 62, 0.14);
}

.tag-bad {
  color: $color-danger;
  background: rgba(212, 88, 74, 0.12);
}

.big-value {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  margin-top: 4rpx;
}

.big-num {
  font-size: 72rpx;
  font-weight: 700;
  color: $color-text-strong;
  line-height: 1;
  letter-spacing: -1rpx;
}

.big-unit {
  font-size: 24rpx;
  color: $color-text-faint;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8rpx 0;
  border-bottom: 1rpx dashed $color-border;
}

.meta-row:last-of-type {
  border-bottom: none;
}

.meta-label {
  font-size: 24rpx;
  color: $color-text-muted;
}

.meta-value {
  font-size: 26rpx;
  color: $color-text-strong;
  font-weight: 500;
}

.card-text {
  font-size: 24rpx;
  color: $color-text-muted;
  line-height: 1.7;
}

// —— 标尺 ——

.scale-list {
  display: flex;
  flex-direction: column;
}

.scale-row {
  display: flex;
  align-items: center;
  padding: 14rpx 0;
  border-bottom: 1rpx dashed $color-border;
  gap: 16rpx;

  &:last-child {
    border-bottom: none;
  }
}

.scale-row.active {
  background: rgba(42, 141, 127, 0.06);
  border-radius: $radius-sm;
  padding-left: 12rpx;
  padding-right: 12rpx;
  margin-left: -12rpx;
  margin-right: -12rpx;
}

.scale-range-cell {
  width: 160rpx;
  font-size: 24rpx;
  color: $color-text-muted;
  font-family: monospace;
}

.scale-row.active .scale-range-cell {
  color: $color-primary;
  font-weight: 600;
}

.scale-label-cell {
  flex: 1;
  font-size: 24rpx;
  color: $color-text;
}

.scale-row.active .scale-label-cell {
  color: $color-text-strong;
  font-weight: 600;
}

.scale-marker {
  color: $color-primary;
  font-size: 22rpx;
}

.alert {
  padding: 16rpx 20rpx;
  background: rgba(224, 159, 62, 0.08);
  border-left: 4rpx solid $color-warning;
  border-radius: $radius-sm;
  font-size: 24rpx;
  color: $color-warning;
}

.opinion {
  background: $color-surface;
  border-radius: $radius-lg;
  padding: 28rpx 32rpx;
  box-shadow: $shadow-sm;
  border-left: 6rpx solid $color-primary;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-top: 4rpx;
}

.opinion-label {
  font-size: 24rpx;
  font-weight: 600;
  color: $color-primary;
}

.opinion-text {
  font-size: 26rpx;
  color: $color-text;
  line-height: 1.7;
}
</style>

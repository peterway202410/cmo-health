<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useMetricsStore } from '@/stores/metrics';
import AppTabBar from '@/components/AppTabBar.vue';
import { assessLipid, type FieldLevel } from '@/domain/analysis/lipid';
import { formatDateTime } from '@/utils/date';

const metricsStore = useMetricsStore();

function refresh() {
  metricsStore.load();
}
onMounted(refresh);
onShow(refresh);

const result = computed(() => assessLipid({ records: metricsStore.lipid }));

const riskInfo = computed(() => {
  const r = result.value.statusInfo.risk;
  return {
    good: 'risk-low',
    warn: 'risk-mid',
    bad: 'risk-high',
    muted: 'risk-low',
  }[r];
});

function tagClass(level: FieldLevel | undefined): string {
  if (level === 'good') return 'tag-good';
  if (level === 'borderline') return 'tag-warn';
  if (level === 'bad') return 'tag-bad';
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

// —— 解读文案 ——

function statusInterpret(): string {
  const s = result.value.status;
  switch (s) {
    case 'normal':
      return '当前血脂各项指标在合适/正常范围，请继续保持良好饮食与运动习惯，每年定期复查。';
    case 'borderline':
      return '部分指标处于边缘升高范围，建议调整饮食结构、增加有氧运动，3-6 个月后复查。';
    case 'high_chol':
      return '总胆固醇或 LDL 升高，建议低饱和脂肪、低胆固醇饮食，必要时遵医嘱启动药物治疗。';
    case 'high_tg':
      return '甘油三酯偏高，建议减少精制糖与酒精摄入，控制体重，增加运动。';
    case 'mixed':
      return '同时存在高胆固醇与高甘油三酯，建议系统性饮食结构调整，并就医评估是否启动药物治疗。';
    case 'low_hdl_only':
      return 'HDL 偏低会削弱「好胆固醇」的保护作用。建议增加坚果、橄榄油等不饱和脂肪摄入，坚持有氧运动，并戒烟。';
    case 'high_chol_with_low_hdl':
    case 'high_tg_with_low_hdl':
    case 'mixed_with_low_hdl':
      return '存在血脂异常合并 HDL 偏低，心血管风险显著升高。建议尽快就医评估，并制定综合干预计划。';
    default:
      return '尚无足够数据进行综合判定。';
  }
}

function trendInterpret(): string {
  const t = result.value.trend;
  if (t.dir === 'insufficient') return '至少需要 2 次非同日总胆固醇记录才能分析趋势。';
  if (t.dir === 'up') return `近期总胆固醇均值上升 ${t.diff} mmol/L，建议关注饮食并复查。`;
  if (t.dir === 'down') return `近期总胆固醇均值下降 ${Math.abs(t.diff ?? 0)} mmol/L，趋势良好。`;
  return '近期总胆固醇相对稳定。';
}

const hasAnyField = computed(() => {
  const f = result.value.fields;
  return (
    f.tc.value != null ||
    f.tg.value != null ||
    f.ldl.value != null ||
    f.hdl.value != null
  );
});
</script>

<template>
  <view class="page">
    <view v-if="!result.hasData" class="empty">
      <text class="empty-text">尚未录入血脂记录</text>
    </view>

    <view v-else class="container">
      <!-- 顶部综合判定 -->
      <view class="risk-banner" :class="riskInfo">
        <text class="risk-label">血脂综合判定</text>
        <text class="risk-level">{{ result.statusInfo.label }}</text>
        <text class="risk-reason">{{ result.statusInfo.sub }}</text>
      </view>

      <!-- 1. 最新记录 -->
      <view v-if="result.latest" class="card">
        <view class="card-head">
          <text class="card-num">1.</text>
          <text class="card-title">最新一次记录</text>
        </view>
        <view class="meta-row">
          <text class="meta-label">采集时间</text>
          <text class="meta-value">{{ formatDateTime(result.latest.created_at) }}</text>
        </view>
        <view v-if="!hasAnyField" class="meta-row">
          <text class="meta-value">本次未录入血脂指标</text>
        </view>
        <text class="card-text">{{ statusInterpret() }}</text>
      </view>

      <!-- 2. TC -->
      <view v-if="result.fields.tc.value != null" class="card">
        <view class="card-head">
          <text class="card-num">2.</text>
          <text class="card-title">总胆固醇（TC）</text>
          <text class="tag" :class="tagClass(result.fields.tc.level)">
            {{ result.fields.tc.label }}
          </text>
        </view>
        <view class="big-value">
          <text class="big-num">{{ result.fields.tc.value }}</text>
          <text class="big-unit">mmol/L</text>
        </view>
        <view class="scale">
          <view class="scale-item">
            <text class="scale-range">&lt; 5.2</text>
            <text class="scale-label">合适</text>
          </view>
          <view class="scale-item">
            <text class="scale-range">5.2-6.1</text>
            <text class="scale-label">边缘升高</text>
          </view>
          <view class="scale-item">
            <text class="scale-range">≥ 6.2</text>
            <text class="scale-label">升高</text>
          </view>
        </view>
      </view>

      <!-- 3. TG -->
      <view v-if="result.fields.tg.value != null" class="card">
        <view class="card-head">
          <text class="card-num">3.</text>
          <text class="card-title">甘油三酯（TG）</text>
          <text class="tag" :class="tagClass(result.fields.tg.level)">
            {{ result.fields.tg.label }}
          </text>
        </view>
        <view class="big-value">
          <text class="big-num">{{ result.fields.tg.value }}</text>
          <text class="big-unit">mmol/L</text>
        </view>
        <view class="scale">
          <view class="scale-item">
            <text class="scale-range">&lt; 1.7</text>
            <text class="scale-label">合适</text>
          </view>
          <view class="scale-item">
            <text class="scale-range">1.7-2.2</text>
            <text class="scale-label">边缘升高</text>
          </view>
          <view class="scale-item">
            <text class="scale-range">≥ 2.3</text>
            <text class="scale-label">升高</text>
          </view>
        </view>
      </view>

      <!-- 4. LDL -->
      <view v-if="result.fields.ldl.value != null" class="card">
        <view class="card-head">
          <text class="card-num">4.</text>
          <text class="card-title">低密度脂蛋白（LDL）</text>
          <text class="tag" :class="tagClass(result.fields.ldl.level)">
            {{ result.fields.ldl.label }}
          </text>
        </view>
        <view class="big-value">
          <text class="big-num">{{ result.fields.ldl.value }}</text>
          <text class="big-unit">mmol/L</text>
        </view>
        <view class="scale">
          <view class="scale-item">
            <text class="scale-range">&lt; 3.4</text>
            <text class="scale-label">合适</text>
          </view>
          <view class="scale-item">
            <text class="scale-range">3.4-4.0</text>
            <text class="scale-label">边缘升高</text>
          </view>
          <view class="scale-item">
            <text class="scale-range">≥ 4.1</text>
            <text class="scale-label">升高</text>
          </view>
        </view>
        <text class="card-text">LDL 是「坏胆固醇」，与动脉粥样硬化关系密切。</text>
      </view>

      <!-- 5. HDL -->
      <view v-if="result.fields.hdl.value != null" class="card">
        <view class="card-head">
          <text class="card-num">5.</text>
          <text class="card-title">高密度脂蛋白（HDL）</text>
          <text class="tag" :class="tagClass(result.fields.hdl.level)">
            {{ result.fields.hdl.label }}
          </text>
        </view>
        <view class="big-value">
          <text class="big-num">{{ result.fields.hdl.value }}</text>
          <text class="big-unit">mmol/L</text>
        </view>
        <view class="scale">
          <view class="scale-item">
            <text class="scale-range">&lt; 1.0</text>
            <text class="scale-label">降低</text>
          </view>
          <view class="scale-item">
            <text class="scale-range">≥ 1.0</text>
            <text class="scale-label">正常</text>
          </view>
        </view>
        <text class="card-text">HDL 是「好胆固醇」，越高越好。规律有氧运动与不饱和脂肪有助于提升 HDL。</text>
      </view>

      <!-- 6. 趋势 -->
      <view class="card">
        <view class="card-head">
          <text class="card-num">6.</text>
          <text class="card-title">总胆固醇趋势</text>
          <text class="tag" :class="trendTagClass(result.trend.dir)">
            {{ trendLabel(result.trend.dir) }}
          </text>
        </view>
        <view v-if="result.trend.diff != null" class="meta-row">
          <text class="meta-label">前 3 次均值 vs 后 3 次均值</text>
          <text class="meta-value">
            {{ result.trend.diff > 0 ? '+' : '' }}{{ result.trend.diff }} mmol/L
          </text>
        </view>
        <text class="card-text">{{ trendInterpret() }}</text>
      </view>

      <!-- 健康建议 -->
      <view class="opinion">
        <text class="opinion-label">健康建议</text>
        <text class="opinion-text">
          少吃饱和脂肪与反式脂肪（油炸、肥肉、烘焙制品），多吃深海鱼、坚果、豆类、橄榄油；
          每周 ≥ 150 分钟中等强度有氧运动 + 力量训练；控制体重与腰围；戒烟限酒；
          有家族史或合并糖尿病、高血压者，建议每 6-12 个月复查血脂。
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
  font-size: 44rpx;
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
  text-align: center;
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

.scale {
  display: flex;
  margin-top: 4rpx;
  border-top: 1rpx dashed $color-border;
  padding-top: 12rpx;
}

.scale-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rpx;
}

.scale-range {
  font-size: 20rpx;
  color: $color-text-faint;
}

.scale-label {
  font-size: 22rpx;
  color: $color-text-muted;
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

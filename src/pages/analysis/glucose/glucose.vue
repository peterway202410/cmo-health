<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useMetricsStore } from '@/stores/metrics';
import AppTabBar from '@/components/AppTabBar.vue';
import { assessGlucose } from '@/domain/analysis/glucose';
import { formatDateTime } from '@/utils/date';

const metricsStore = useMetricsStore();

function refresh() {
  metricsStore.load();
}
onMounted(refresh);
onShow(refresh);

const result = computed(() => assessGlucose({ records: metricsStore.glucose }));

const riskInfo = computed(() => {
  const r = result.value.statusInfo.risk;
  return {
    good: 'risk-low',
    warn: 'risk-mid',
    bad: 'risk-high',
    muted: 'risk-low',
  }[r];
});

function tagClass(risk: 'good' | 'warn' | 'bad' | undefined): string {
  if (risk === 'good') return 'tag-good';
  if (risk === 'warn') return 'tag-warn';
  if (risk === 'bad') return 'tag-bad';
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

// —— 解读 ——

function statusInterpret(): string {
  const s = result.value.status;
  switch (s) {
    case 'low':
      return '空腹血糖偏低，可能与长时间未进食、降糖药过量或潜在内分泌问题有关。请立即补充含糖食物，并排查低血糖原因。';
    case 'diabetes':
      return '当前指标已达到糖尿病诊断标准。建议尽快就医，完善 OGTT、胰岛素释放试验等检查，制定治疗方案。';
    case 'ifg':
      return '空腹血糖处于受损区间（6.1-6.9 mmol/L），属糖尿病前期。控制饮食、规律运动、控制体重，3-6 个月复查。';
    case 'igt':
      return '餐后血糖处于受损区间（7.8-11.0 mmol/L），属糖尿病前期。注意低 GI 饮食、餐后散步，3-6 个月复查。';
    case 'normal':
      return '当前血糖各项指标在正常范围，请继续保持，每年定期体检。';
    default:
      return '尚无足够数据进行综合判定。';
  }
}

function trendInterpret(): string {
  const t = result.value.trend;
  if (t.dir === 'insufficient') return '至少需要 2 次非同日空腹血糖记录才能分析趋势。';
  if (t.dir === 'up') return `近期空腹血糖均值上升 ${t.diff} mmol/L，建议关注饮食并复查。`;
  if (t.dir === 'down') return `近期空腹血糖均值下降 ${Math.abs(t.diff ?? 0)} mmol/L，趋势良好。`;
  return '近期空腹血糖相对稳定。';
}

function frequencyHint(): string | null {
  if (result.value.count < 3) return '建议增加监测频率，至少 3 次记录可生成更稳定的评估。';
  return null;
}
</script>

<template>
  <view class="page">
    <view v-if="!result.hasData" class="empty">
      <text class="empty-text">尚未录入血糖记录</text>
    </view>

    <view v-else class="container">
      <!-- 顶部综合判定 -->
      <view class="risk-banner" :class="riskInfo">
        <text class="risk-label">血糖综合判定</text>
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
        <view v-if="result.fields.fpg.value != null" class="meta-row">
          <text class="meta-label">空腹血糖</text>
          <text class="meta-value">{{ result.fields.fpg.value }} mmol/L</text>
        </view>
        <view v-if="result.fields.pp2h.value != null" class="meta-row">
          <text class="meta-label">餐后 2h 血糖</text>
          <text class="meta-value">{{ result.fields.pp2h.value }} mmol/L</text>
        </view>
        <view v-if="result.fields.hba1c.value != null" class="meta-row">
          <text class="meta-label">糖化血红蛋白</text>
          <text class="meta-value">{{ result.fields.hba1c.value }}%</text>
        </view>
        <text class="card-text">{{ statusInterpret() }}</text>
      </view>

      <!-- 2. 空腹血糖 -->
      <view v-if="result.fields.fpg.value != null" class="card">
        <view class="card-head">
          <text class="card-num">2.</text>
          <text class="card-title">空腹血糖（FPG）</text>
          <text class="tag" :class="tagClass(result.fields.fpg.risk)">
            {{ result.fields.fpg.label }}
          </text>
        </view>
        <view class="big-value">
          <text class="big-num">{{ result.fields.fpg.value }}</text>
          <text class="big-unit">mmol/L</text>
        </view>
        <view class="scale">
          <view class="scale-item">
            <text class="scale-range">≤ 3.9</text>
            <text class="scale-label">低血糖</text>
          </view>
          <view class="scale-item">
            <text class="scale-range">&lt; 6.1</text>
            <text class="scale-label">正常</text>
          </view>
          <view class="scale-item">
            <text class="scale-range">6.1-6.9</text>
            <text class="scale-label">受损</text>
          </view>
          <view class="scale-item">
            <text class="scale-range">≥ 7.0</text>
            <text class="scale-label">糖尿病</text>
          </view>
        </view>
      </view>

      <!-- 3. 餐后 2h -->
      <view v-if="result.fields.pp2h.value != null" class="card">
        <view class="card-head">
          <text class="card-num">3.</text>
          <text class="card-title">餐后 2h 血糖</text>
          <text class="tag" :class="tagClass(result.fields.pp2h.risk)">
            {{ result.fields.pp2h.label }}
          </text>
        </view>
        <view class="big-value">
          <text class="big-num">{{ result.fields.pp2h.value }}</text>
          <text class="big-unit">mmol/L</text>
        </view>
        <view class="scale">
          <view class="scale-item">
            <text class="scale-range">&lt; 7.8</text>
            <text class="scale-label">正常</text>
          </view>
          <view class="scale-item">
            <text class="scale-range">7.8-11.0</text>
            <text class="scale-label">糖耐量减低</text>
          </view>
          <view class="scale-item">
            <text class="scale-range">≥ 11.1</text>
            <text class="scale-label">糖尿病</text>
          </view>
        </view>
      </view>

      <!-- 4. HbA1c -->
      <view v-if="result.fields.hba1c.value != null" class="card">
        <view class="card-head">
          <text class="card-num">4.</text>
          <text class="card-title">糖化血红蛋白（HbA1c）</text>
          <text class="tag" :class="tagClass(result.fields.hba1c.risk)">
            {{ result.fields.hba1c.label }}
          </text>
        </view>
        <view class="big-value">
          <text class="big-num">{{ result.fields.hba1c.value }}</text>
          <text class="big-unit">%</text>
        </view>
        <view class="scale">
          <view class="scale-item">
            <text class="scale-range">&lt; 5.7</text>
            <text class="scale-label">正常</text>
          </view>
          <view class="scale-item">
            <text class="scale-range">5.7-6.4</text>
            <text class="scale-label">糖尿病前期</text>
          </view>
          <view class="scale-item">
            <text class="scale-range">≥ 6.5</text>
            <text class="scale-label">糖尿病</text>
          </view>
        </view>
        <text class="card-text">糖化血红蛋白反映过去 2-3 个月的平均血糖水平，是糖尿病管理的重要监测指标。</text>
      </view>

      <!-- 5. 趋势 -->
      <view class="card">
        <view class="card-head">
          <text class="card-num">5.</text>
          <text class="card-title">空腹血糖趋势</text>
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

      <!-- 频率提示 -->
      <view v-if="frequencyHint()" class="alert">{{ frequencyHint() }}</view>

      <!-- 健康建议 -->
      <view class="opinion">
        <text class="opinion-label">健康建议</text>
        <text class="opinion-text">
          饮食以低 GI 主食为主、减少精制糖与含糖饮料；每周 ≥ 150 分钟中等强度有氧 + 力量训练；保持腰围与体重；规律睡眠；如有糖尿病家族史或既往血糖异常史，建议每 3-6 个月复查。
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

// —— 顶部 ——

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
  letter-spacing: 2rpx;
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

// —— 卡片 ——

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

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useMetricsStore } from '@/stores/metrics';
import AppTabBar from '@/components/AppTabBar.vue';
import { assessBP } from '@/domain/analysis/bp';
import { formatDateTime } from '@/utils/date';

const metricsStore = useMetricsStore();

function refresh() {
  metricsStore.load();
}
onMounted(refresh);
onShow(refresh);

const result = computed(() => assessBP({ records: metricsStore.bp }));

const riskInfo = computed(() => {
  const r = result.value.classify?.risk;
  if (!r) return { label: '暂无数据', cls: 'risk-low' };
  return {
    good: { label: result.value.classify?.label ?? '正常', cls: 'risk-low' },
    warn: { label: result.value.classify?.label ?? '正常高值', cls: 'risk-mid' },
    bad: { label: result.value.classify?.label ?? '高血压', cls: 'risk-high' },
  }[r];
});

function tagClass(risk: 'good' | 'warn' | 'bad' | undefined): string {
  if (risk === 'good') return 'tag-good';
  if (risk === 'warn') return 'tag-warn';
  if (risk === 'bad') return 'tag-bad';
  return '';
}

function hrTagClass(s: string): string {
  if (s === 'normal') return 'tag-good';
  return 'tag-warn';
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

function controlTagClass(level: string | undefined): string {
  if (level === 'good') return 'tag-good';
  if (level === 'partial') return 'tag-warn';
  if (level === 'poor') return 'tag-bad';
  return '';
}

function controlLabel(level: string | undefined): string {
  return (
    {
      good: '控制良好',
      partial: '部分达标',
      poor: '控制不理想',
    }[level ?? ''] ?? '—'
  );
}

// —— 解读文案 ——

function classifyInterpret(): string {
  const c = result.value.classify;
  if (!c) return '尚无足够数据进行分级。';
  const sys = result.value.meanSys;
  const dia = result.value.meanDia;
  const base = `非同日平均血压 ${sys}/${dia} mmHg，按《中国高血压防治指南 2023 版》归入「${c.label}」。`;
  if (c.risk === 'good') return base + '请继续保持健康生活方式，每年监测。';
  if (c.risk === 'warn') return base + '建议从饮食、运动、情绪管理入手，3-6 个月后复评。';
  if (c.level === 'stage1') return base + '建议先以非药物干预为主，3-6 个月仍不达标再就医。';
  return base + '建议尽快就医评估，必要时启动降压治疗。';
}

function trendInterpret(): string {
  const t = result.value.trend;
  if (t.dir === 'insufficient') return '至少需要 2 次非同日记录才能分析趋势。';
  let s = '';
  if (t.dir === 'up') s = `近期收缩压上升 ${t.diff} mmHg，需关注。`;
  else if (t.dir === 'down') s = `近期收缩压下降 ${Math.abs(t.diff ?? 0)} mmHg，趋势良好。`;
  else s = '近期血压相对稳定。';
  if (t.fluctuating) s += '但整体波动较大，建议固定时间、固定姿势测量。';
  return s;
}

function controlInterpret(): string {
  const c = result.value.control;
  if (!c) return '至少需要 3 次非同日记录才能计算达标率。';
  return `共 ${c.total} 次非同日记录中 ${c.achieved} 次达标（< 140/90 mmHg），达标率 ${c.pct}%。`;
}

function hrInterpret(): string {
  const v = result.value.hr.value;
  if (v == null) return '尚未录入心率。建议下次测量血压时一并记录。';
  if (result.value.hr.status === 'tachy')
    return `心率 ${v} bpm 偏快。需排查情绪、运动、咖啡因或潜在心律问题。`;
  if (result.value.hr.status === 'brady')
    return `心率 ${v} bpm 偏慢。运动员可能正常，否则建议进一步评估。`;
  return `心率 ${v} bpm，处于正常范围（60-100）。`;
}

function generalAdvice(): string {
  const c = result.value.classify;
  const base =
    '生活方式建议：限盐每日 < 5g、每周 ≥ 150 分钟中等强度有氧运动、保持 BMI 18.5-23.9、戒烟限酒、做好情绪管理。';
  if (!c) return base;
  if (c.level === 'stage2' || c.level === 'stage3') return base + ' 高血压 2-3 级建议尽快就医。';
  if (c.level === 'stage1') return base + ' 高血压 1 级若 3-6 个月干预未达标，请及时就医。';
  return base;
}
</script>

<template>
  <view class="page">
    <view v-if="!result.hasData" class="empty">
      <text class="empty-text">尚未录入血压记录</text>
    </view>

    <view v-else class="container">
      <!-- 顶部分级横幅 -->
      <view class="risk-banner" :class="riskInfo.cls">
        <text class="risk-label">血压综合分级</text>
        <text class="risk-level">{{ riskInfo.label }}</text>
        <text v-if="result.meanSys != null" class="risk-reason">
          非同日平均：{{ result.meanSys }}/{{ result.meanDia }} mmHg
        </text>
        <text v-if="result.isolatedSystolic" class="risk-reason">
          注：单纯收缩压偏高
        </text>
      </view>

      <!-- 1. 最新血压 -->
      <view v-if="result.latest" class="card">
        <view class="card-head">
          <text class="card-num">1.</text>
          <text class="card-title">最新一次测量</text>
        </view>
        <view class="big-value">
          <text class="big-num">{{ result.latest.sys }}</text>
          <text class="big-slash">/</text>
          <text class="big-num secondary">{{ result.latest.dia }}</text>
          <text class="big-unit">mmHg</text>
        </view>
        <view v-if="result.latest.hr != null" class="meta-row">
          <text class="meta-label">心率</text>
          <text class="meta-value">{{ result.latest.hr }} bpm</text>
        </view>
        <view class="meta-row">
          <text class="meta-label">测量时间</text>
          <text class="meta-value">{{ formatDateTime(result.latest.date) }}</text>
        </view>
      </view>

      <!-- 2. 综合分级 -->
      <view v-if="result.classify" class="card">
        <view class="card-head">
          <text class="card-num">2.</text>
          <text class="card-title">血压分级</text>
          <text class="tag" :class="tagClass(result.classify.risk)">
            {{ result.classify.label }}
          </text>
        </view>
        <view class="meta-row">
          <text class="meta-label">非同日平均收缩压</text>
          <text class="meta-value">{{ result.meanSys }} mmHg</text>
        </view>
        <view class="meta-row">
          <text class="meta-label">非同日平均舒张压</text>
          <text class="meta-value">{{ result.meanDia }} mmHg</text>
        </view>
        <text class="card-text">{{ classifyInterpret() }}</text>
      </view>

      <!-- 3. 心率 -->
      <view class="card">
        <view class="card-head">
          <text class="card-num">3.</text>
          <text class="card-title">心率</text>
          <text v-if="result.hr.value != null" class="tag" :class="hrTagClass(result.hr.status)">
            {{ result.hr.label }}
          </text>
        </view>
        <view v-if="result.hr.value != null" class="big-value">
          <text class="big-num">{{ result.hr.value }}</text>
          <text class="big-unit">bpm</text>
        </view>
        <text class="card-text">{{ hrInterpret() }}</text>
      </view>

      <!-- 4. 趋势 -->
      <view class="card">
        <view class="card-head">
          <text class="card-num">4.</text>
          <text class="card-title">血压趋势</text>
          <text class="tag" :class="trendTagClass(result.trend.dir)">
            {{ trendLabel(result.trend.dir) }}
          </text>
        </view>
        <view v-if="result.trend.diff != null" class="meta-row">
          <text class="meta-label">最近 3 次首尾差</text>
          <text class="meta-value">
            {{ result.trend.diff > 0 ? '+' : '' }}{{ result.trend.diff }} mmHg
          </text>
        </view>
        <view v-if="result.trend.fluctuating" class="alert">
          全部记录标准差 &gt; 15 mmHg，提示血压波动较大
        </view>
        <text class="card-text">{{ trendInterpret() }}</text>
      </view>

      <!-- 5. 达标率 -->
      <view class="card">
        <view class="card-head">
          <text class="card-num">5.</text>
          <text class="card-title">达标率</text>
          <text v-if="result.control" class="tag" :class="controlTagClass(result.control.level)">
            {{ controlLabel(result.control.level) }}
          </text>
        </view>
        <view v-if="result.control" class="big-value">
          <text class="big-num">{{ result.control.pct }}</text>
          <text class="big-unit">%</text>
        </view>
        <view v-if="result.control" class="bar">
          <view class="bar-track" />
          <view
            class="bar-fill"
            :style="{
              width: `${result.control.pct}%`,
              background:
                result.control.level === 'good'
                  ? '#2eb872'
                  : result.control.level === 'partial'
                    ? '#e09f3e'
                    : '#d4584a',
            }"
          />
        </view>
        <text class="card-text">{{ controlInterpret() }}</text>
      </view>

      <!-- 6. 统计 -->
      <view class="card">
        <view class="card-head">
          <text class="card-num">6.</text>
          <text class="card-title">数据统计</text>
        </view>
        <view class="meta-row">
          <text class="meta-label">总记录数</text>
          <text class="meta-value">{{ result.stats.count }} 条</text>
        </view>
        <view class="meta-row">
          <text class="meta-label">非同日天数</text>
          <text class="meta-value">{{ result.stats.uniqueDays }} 天</text>
        </view>
        <view class="meta-row">
          <text class="meta-label">收缩压平均 / 范围</text>
          <text class="meta-value">
            {{ result.stats.sysAvg }} ({{ result.stats.sysMin }}-{{ result.stats.sysMax }})
          </text>
        </view>
        <view class="meta-row">
          <text class="meta-label">舒张压平均 / 范围</text>
          <text class="meta-value">
            {{ result.stats.diaAvg }} ({{ result.stats.diaMin }}-{{ result.stats.diaMax }})
          </text>
        </view>
      </view>

      <!-- 综合意见 -->
      <view class="opinion">
        <text class="opinion-label">健康建议</text>
        <text class="opinion-text">{{ generalAdvice() }}</text>
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

// —— 顶部风险横幅 ——

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
  font-size: 56rpx;
  font-weight: 700;
  letter-spacing: 4rpx;
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

// —— 通用卡片 ——

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

// —— 大数字 ——

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

.big-num.secondary {
  color: $color-text-muted;
}

.big-slash {
  font-size: 56rpx;
  color: $color-text-faint;
}

.big-unit {
  font-size: 24rpx;
  color: $color-text-faint;
}

// —— 进度条 ——

.bar {
  position: relative;
  height: 8rpx;
  margin: 4rpx 0;
}

.bar-track {
  position: absolute;
  inset: 0;
  background: $color-border;
  border-radius: 999rpx;
}

.bar-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: 999rpx;
}

// —— Meta 行 ——

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
  padding: 12rpx 16rpx;
  background: rgba(224, 159, 62, 0.08);
  border-left: 4rpx solid $color-warning;
  border-radius: $radius-sm;
  font-size: 24rpx;
  color: $color-warning;
}

// —— 综合意见 ——

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

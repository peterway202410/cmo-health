<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useProfileStore } from '@/stores/profile';
import { useMetricsStore } from '@/stores/metrics';
import AppTabBar from '@/components/AppTabBar.vue';
import { assessWeight, ACTIVITY_LABELS } from '@/domain/analysis/weight';
import { nowIso } from '@/utils/date';

const profileStore = useProfileStore();
const metricsStore = useMetricsStore();

function refresh() {
  profileStore.load();
  metricsStore.load();
}
onMounted(refresh);
onShow(refresh);

const result = computed(() => {
  const profile = profileStore.profile;
  if (!profile) return null;
  return assessWeight({
    birth_date: profile.birth_date,
    gender: profile.gender,
    height_cm: profile.height_cm,
    records: metricsStore.weight,
    activity: profile.activity,
    now: nowIso(),
  });
});

const activityLabel = computed(() => {
  const a = profileStore.profile?.activity ?? 'unknown';
  return ACTIVITY_LABELS[a];
});

const riskInfo = computed(() => {
  const lvl = result.value?.risk.level ?? 'low';
  return {
    low: { label: '低风险', cls: 'risk-low' },
    medium: { label: '中度风险', cls: 'risk-mid' },
    high: { label: '高风险', cls: 'risk-high' },
  }[lvl];
});

// —— BMI 进度条计算 ——
const bmiBar = computed(() => {
  if (!result.value?.bmi) return null;
  const v = result.value.bmi.value;
  // 标尺范围 15 ~ 35，超出截断
  const lo = 15;
  const hi = 35;
  const pct = Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * 100;
  return { pct: pct.toFixed(1), color: barColor(result.value.bmi.level) };
});

const whtrBar = computed(() => {
  if (!result.value?.whtr) return null;
  const v = result.value.whtr.value;
  const lo = 0.35;
  const hi = 0.7;
  const pct = Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * 100;
  return { pct: pct.toFixed(1), color: barColor(result.value.whtr.level) };
});

function barColor(level: string): string {
  if (level === 'normal' || level === 'low') return '#2eb872';
  if (level === 'overweight' || level === 'elevated' || level === 'medium' || level === 'thin')
    return '#e09f3e';
  return '#d4584a';
}

function tagClassFor(level: string): string {
  if (level === 'normal' || level === 'low') return 'tag-good';
  if (level === 'overweight' || level === 'elevated' || level === 'medium' || level === 'thin')
    return 'tag-warn';
  return 'tag-bad';
}

function nightTagClass(level: string): string {
  if (level === 'normal') return 'tag-good';
  if (level === 'low' || level === 'fast') return 'tag-warn';
  return 'tag-bad';
}

function bmiInterpret(): string {
  if (!result.value?.bmi) return '';
  const v = result.value.bmi.value;
  const level = result.value.bmi.level;
  if (level === 'thin')
    return `您的体重指数为 ${v}，低于正常范围。建议排查消瘦原因，制定增肌增重方案。`;
  if (level === 'normal')
    return `您的体重指数为 ${v}，处于正常范围。请继续保持良好的饮食与运动习惯，定期监测体重。`;
  if (level === 'overweight')
    return `您的体重指数为 ${v}，已属超重。建议适度减重 5%-10% 即可显著改善代谢风险。`;
  return `您的体重指数为 ${v}，已达肥胖标准。建议系统性减重，结合饮食、运动与必要的医学评估。`;
}

function bmrInterpret(): string {
  return '基础代谢率是完全静止状态下维持生命所需的最低能量。了解 BMR 是制定个性化饮食计划的基础。';
}

function tdeeInterpret(): string {
  if (!result.value?.tdee) return '';
  const tdee = result.value.tdee;
  const ideal = result.value.ideal;
  let s = `TDEE 是结合活动水平的每日总能量消耗。维持当前体重需 ${tdee} 千卡/天；减重时建议日缺口 300-500 千卡。`;
  if (ideal) s += `理想体重范围 ${ideal.lo} - ${ideal.hi} kg。`;
  return s;
}

function whrInterpret(): string {
  if (!result.value?.whr) return '';
  const v = result.value.whr.value;
  if (result.value.whr.level === 'central')
    return `您的腰臀比为 ${v}，已达到中心性肥胖标准。腹部脂肪蓄积过多与「三高」、脂肪肝、心血管疾病风险关联较大，建议重点减腰围。`;
  return `您的腰臀比为 ${v}，处于正常范围。继续保持核心训练和均衡饮食。`;
}

function whtrInterpret(): string {
  if (!result.value?.whtr) return '';
  const v = result.value.whtr.value;
  const level = result.value.whtr.level;
  if (level === 'high')
    return `腰围身高比为 ${v}，已达高风险水平。腰围超过身高一半提示腹型肥胖明显，请优先减腰围。`;
  if (level === 'elevated')
    return `腰围身高比为 ${v}，风险升高。建议在控制总体重的同时关注腰围。`;
  return `腰围身高比为 ${v}，处于正常范围。`;
}

function nightInterpret(): string {
  if (!result.value?.latestNightDrop) return '';
  const r = result.value.latestNightDrop.rate;
  const level = result.value.latestNightDrop.level;
  if (level === 'normal')
    return `本次夜间回落率 ${r}%，处于正常范围（0.5%-1.2%），代谢与水分平衡良好。`;
  if (level === 'low')
    return `回落率 ${r}%，偏低。可能处于低速节能或锁水状态，留意饮食钠摄入与睡眠质量。`;
  if (level === 'fast')
    return `回落率 ${r}%，偏高。可能处于快速排水阶段，留意是否过量节食或脱水。`;
  return `本次睡前体重未明显下降，需关注消化与睡眠状态。`;
}

function goRecordWeight() {
  uni.navigateTo({ url: '/pages/records/weight/weight' });
}
</script>

<template>
  <view class="page">
    <view v-if="!result" class="empty">
      <text class="empty-text">需要先填写基础档案</text>
    </view>

    <view v-else class="container">
      <!-- 顶部综合风险 -->
      <view class="risk-banner" :class="riskInfo.cls">
        <text class="risk-label">综合体重风险等级</text>
        <text class="risk-level">{{ riskInfo.label }}</text>
        <text class="risk-reason">
          {{
            result.risk.reasons.length > 0 ? '风险因素：' + result.risk.reasons.join(' · ') : '各项指标处于合理范围'
          }}
        </text>
      </view>

      <!-- 1. BMI -->
      <view v-if="result.bmi" class="card">
        <view class="card-head">
          <text class="card-num">1.</text>
          <text class="card-title">体重指数（BMI）</text>
          <text class="tag" :class="tagClassFor(result.bmi.level)">{{ result.bmi.label }}</text>
        </view>
        <view class="big-value">
          <text class="big-num">{{ result.bmi.value }}</text>
          <text class="big-unit">kg/m²</text>
        </view>
        <view v-if="bmiBar" class="bar">
          <view class="bar-track" />
          <view
            class="bar-fill"
            :style="{ width: `${bmiBar.pct}%`, background: bmiBar.color }"
          />
        </view>
        <text class="card-text">{{ bmiInterpret() }}</text>
      </view>
      <view v-else class="card card-muted">
        <view class="card-head">
          <text class="card-num">1.</text>
          <text class="card-title">体重指数（BMI）</text>
        </view>
        <text class="card-text">尚未录入体重</text>
        <text class="card-link" @click="goRecordWeight">去录入 →</text>
      </view>

      <!-- 2. BMR -->
      <view v-if="result.bmr != null" class="card">
        <view class="card-head">
          <text class="card-num">2.</text>
          <text class="card-title">基础代谢率（BMR）</text>
          <text class="tag tag-info">{{ result.bmr }} 千卡/天</text>
        </view>
        <text class="card-text">{{ bmrInterpret() }}</text>
      </view>

      <!-- 3. TDEE -->
      <view v-if="result.tdee != null" class="card">
        <view class="card-head">
          <text class="card-num">3.</text>
          <text class="card-title">每日总能量消耗（TDEE）</text>
          <text class="tag tag-info">{{ result.tdee }} 千卡/天</text>
        </view>
        <view class="meta-row">
          <text class="meta-label">活动水平</text>
          <text class="meta-value">{{ activityLabel }}</text>
        </view>
        <view v-if="result.ideal" class="meta-row">
          <text class="meta-label">理想体重</text>
          <text class="meta-value">{{ result.ideal.lo }} - {{ result.ideal.hi }} kg</text>
        </view>
        <text class="card-text">{{ tdeeInterpret() }}</text>
      </view>

      <!-- 4. WHR -->
      <view v-if="result.whr" class="card">
        <view class="card-head">
          <text class="card-num">4.</text>
          <text class="card-title">腰臀比（WHR）</text>
          <text class="tag" :class="tagClassFor(result.whr.level)">{{ result.whr.label }}</text>
        </view>
        <view class="big-value">
          <text class="big-num">{{ result.whr.value }}</text>
        </view>
        <text class="card-text">{{ whrInterpret() }}</text>
      </view>

      <!-- 5. WHtR -->
      <view v-if="result.whtr" class="card">
        <view class="card-head">
          <text class="card-num">5.</text>
          <text class="card-title">腰围身高比（WHtR）</text>
          <text class="tag" :class="tagClassFor(result.whtr.level)">{{ result.whtr.label }}</text>
        </view>
        <view class="big-value">
          <text class="big-num">{{ result.whtr.value }}</text>
        </view>
        <view v-if="whtrBar" class="bar">
          <view class="bar-track" />
          <view
            class="bar-fill"
            :style="{ width: `${whtrBar.pct}%`, background: whtrBar.color }"
          />
        </view>
        <text class="card-text">{{ whtrInterpret() }}</text>
      </view>

      <!-- 6. 夜间回落率 -->
      <view v-if="result.latestNightDrop" class="card">
        <view class="card-head">
          <text class="card-num">6.</text>
          <text class="card-title">夜间体重回落率</text>
          <text class="tag" :class="nightTagClass(result.latestNightDrop.level)">
            {{ result.latestNightDrop.label }}
          </text>
        </view>
        <view class="big-value">
          <text class="big-num">{{ result.latestNightDrop.rate }}</text>
          <text class="big-unit">%</text>
        </view>
        <view class="meta-row">
          <text class="meta-label">睡前 → 晨起</text>
          <text class="meta-value">
            {{ result.latestNightDrop.pair.bedtime.weight_kg }} →
            {{ result.latestNightDrop.pair.morning.weight_kg }} kg
          </text>
        </view>
        <view class="meta-row">
          <text class="meta-label">有效配对</text>
          <text class="meta-value">{{ result.nightDrops.length }} 组</text>
        </view>
        <view v-if="result.nightAlert" class="alert">{{ result.nightAlert }}</view>
        <text class="card-text">{{ nightInterpret() }}</text>
      </view>

      <!-- 综合意见 -->
      <view class="opinion">
        <text class="opinion-label">综合意见</text>
        <text class="opinion-text">{{ result.opinion }}</text>
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

.card-muted {
  border: 1rpx dashed $color-border;
  box-shadow: none;
  background: transparent;
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
  flex-shrink: 0;
}

// —— Tag ——

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

.tag-info {
  color: $color-primary;
  background: rgba(42, 141, 127, 0.12);
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

.big-unit {
  font-size: 24rpx;
  color: $color-text-faint;
}

// —— 进度条 ——

.bar {
  position: relative;
  height: 8rpx;
  margin: 4rpx 0 4rpx;
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
  transition: width 0.3s;
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

// —— 解读文字 ——

.card-text {
  font-size: 24rpx;
  color: $color-text-muted;
  line-height: 1.7;
}

.card-link {
  font-size: 24rpx;
  color: $color-primary;
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

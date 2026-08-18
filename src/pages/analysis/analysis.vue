<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useProfileStore } from '@/stores/profile';
import { useMetricsStore } from '@/stores/metrics';
import { useQuestionnaireStore } from '@/stores/questionnaire';
import { useThresholdsStore } from '@/stores/thresholds';
import AppTabBar from '@/components/AppTabBar.vue';
import RadarChart from '@/components/RadarChart.vue';
import { computeComprehensive } from '@/domain/comprehensive';
import { nowIso } from '@/utils/date';

const profileStore = useProfileStore();
const metricsStore = useMetricsStore();
const qStore = useQuestionnaireStore();
const tStore = useThresholdsStore();

function refresh() {
  profileStore.load();
  metricsStore.load();
  qStore.load();
  tStore.load();
}

onMounted(refresh);
onShow(refresh);

const result = computed(() => {
  const profile = profileStore.profile;
  if (!profile) return null;
  return computeComprehensive({
    profile,
    bp: metricsStore.bp,
    glucose: metricsStore.glucose,
    lipid: metricsStore.lipid,
    uric: metricsStore.uric,
    weight: metricsStore.weight,
    questionnaire: qStore.current,
    thresholds: tStore.thresholds,
    now: nowIso(),
  });
});

const hasMetrics = computed(() => metricsStore.totalCount > 0);

const radarAxes = computed(() => {
  if (!result.value) return [];
  return result.value.dimensions.map((d) => ({
    label: d.label,
    score: d.score,
  }));
});

const offsetText = computed(() => {
  const r = result.value;
  if (!r || r.mode === 'unavailable') return '';
  const o = r.riskOffsetYears;
  if (o === 0) return '与同龄人代谢风险相当';
  if (o > 0) return `代谢风险相当于 +${o} 岁的同龄人`;
  return `代谢风险相当于 ${o} 岁的同龄人（优于同龄）`;
});

function levelClass(color: string): string {
  return ({ good: 'level-good', warn: 'level-warn', bad: 'level-bad' } as Record<string, string>)[color] ?? '';
}

function dimColorClass(score: number | null): string {
  if (score === null) return 'dim-muted';
  if (score >= 80) return 'dim-good';
  if (score >= 60) return 'dim-warn';
  return 'dim-bad';
}

const subItems = [
  {
    key: 'weight',
    title: '体重评估',
    desc: 'BMI · BMR · 腰臀比 · 风险',
    emoji: '⚖️',
    bg: '#fff1ec',
    path: '/pages/analysis/weight/weight',
  },
  {
    key: 'bp',
    title: '血压评估',
    desc: '分级 · 趋势 · 达标率',
    emoji: '💗',
    bg: '#ecf4ff',
    path: '/pages/analysis/bp/bp',
  },
  {
    key: 'glucose',
    title: '血糖评估',
    desc: 'IFG · IGT · 糖尿病分期',
    emoji: '🩸',
    bg: '#f1ecff',
    path: '/pages/analysis/glucose/glucose',
  },
  {
    key: 'lipid',
    title: '血脂评估',
    desc: 'TC · TG · LDL · HDL',
    emoji: '🧪',
    bg: '#fff7e6',
    path: '/pages/analysis/lipid/lipid',
  },
  {
    key: 'uric',
    title: '尿酸评估',
    desc: '分级 · 趋势 · 治疗建议',
    emoji: '⚗️',
    bg: '#fde8ea',
    path: '/pages/analysis/uric/uric',
  },
] as const;

function go(item: (typeof subItems)[number]) {
  uni.navigateTo({ url: item.path });
}

function goRecords() {
  uni.reLaunch({ url: '/pages/records/records' });
}
</script>

<template>
  <view class="page">
    <view v-if="!hasMetrics" class="empty-card" @click="goRecords">
      <text class="empty-icon">＋</text>
      <text class="empty-title">先录入一些指标</text>
      <text class="empty-hint">完成必要指标后即可生成完整代谢评估</text>
    </view>

    <template v-else-if="result">
      <!-- 综合评分卡 -->
      <view class="score-card" :class="levelClass(result.levelInfo.color)">
        <view class="score-row">
          <view class="score-num-block">
            <text class="score-num">{{ result.score }}</text>
            <text class="score-unit">/100</text>
          </view>
          <view class="score-info">
            <text class="score-level">{{ result.levelInfo.label }}</text>
            <text v-if="offsetText" class="score-offset">{{ offsetText }}</text>
          </view>
        </view>
        <view class="score-meta">
          <text class="score-meta-text">
            {{ result.mode === 'reference' ? '参考评分' : '综合评分' }} · 数据完整度
            {{ Math.round(result.coverage * 100) }}%
          </text>
        </view>
      </view>

      <!-- 雷达图 -->
      <view class="radar-card">
        <text class="radar-title">8 维健康图谱</text>
        <RadarChart :axes="radarAxes" />
        <view class="radar-legend">
          <view
            v-for="d in result.dimensions"
            :key="d.key"
            class="legend-item"
            :class="dimColorClass(d.score)"
          >
            <text class="legend-label">{{ d.label }}</text>
            <text class="legend-score">
              {{ d.score === null ? '—' : d.score }}
            </text>
          </view>
        </view>
      </view>

      <!-- 各维度详情 -->
      <view class="dim-list">
        <view
          v-for="d in result.dimensions"
          :key="d.key"
          class="dim-card"
          :class="dimColorClass(d.score)"
        >
          <view class="dim-head">
            <text class="dim-title">{{ d.label }}</text>
            <text class="dim-score">
              {{ d.score === null ? '无数据' : d.score + ' 分' }}
            </text>
          </view>
          <view v-if="d.reasons.length" class="dim-reasons">
            <text v-for="r in d.reasons" :key="r" class="dim-reason">· {{ r }}</text>
          </view>
        </view>
      </view>

      <!-- 5 个子评估入口 -->
      <view class="sub-list-title">
        <text>详细评估</text>
      </view>
      <view class="sub-list">
        <view v-for="item in subItems" :key="item.key" class="sub-item" @click="go(item)">
          <view class="sub-icon" :style="{ background: item.bg }">
            <text class="sub-emoji">{{ item.emoji }}</text>
          </view>
          <view class="sub-main">
            <text class="sub-title">{{ item.title }}</text>
            <text class="sub-desc">{{ item.desc }}</text>
          </view>
          <text class="sub-arrow">›</text>
        </view>
      </view>

      <view class="disclaimer">
        本应用仅用于个人代谢健康参考，不构成医疗诊断、治疗或用药建议。
      </view>
    </template>
    <AppTabBar active="analysis" />
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.page {
  min-height: 100vh;
  width: 100%;
  max-width: $container-max-width;
  margin: 0 auto;
  padding: 24rpx 32rpx 60rpx;
}

// —— 空状态 ——

.empty-card {
  background: $color-surface;
  border-radius: $radius-lg;
  padding: 80rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 2rpx dashed rgba(42, 141, 127, 0.25);
}

.empty-icon {
  font-size: 64rpx;
  color: $color-primary;
  margin-bottom: 12rpx;
}

.empty-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $color-text-strong;
  margin-bottom: 8rpx;
}

.empty-hint {
  font-size: 24rpx;
  color: $color-text-muted;
}

// —— 综合评分卡 ——

.score-card {
  background: linear-gradient(135deg, #2a8d7f 0%, #4fb3a5 100%);
  border-radius: $radius-lg;
  padding: 32rpx 32rpx 24rpx;
  color: #ffffff;
  box-shadow: 0 12rpx 32rpx rgba(42, 141, 127, 0.2);
  margin-bottom: 24rpx;
}

.score-card.level-warn {
  background: linear-gradient(135deg, #d99745 0%, #e9b76d 100%);
  box-shadow: 0 12rpx 32rpx rgba(224, 159, 62, 0.25);
}

.score-card.level-bad {
  background: linear-gradient(135deg, #c64f43 0%, #e07c6f 100%);
  box-shadow: 0 12rpx 32rpx rgba(212, 88, 74, 0.25);
}

.score-row {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.score-num-block {
  display: flex;
  align-items: baseline;
  flex-shrink: 0;
}

.score-num {
  font-size: 88rpx;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -2rpx;
}

.score-unit {
  font-size: 24rpx;
  margin-left: 4rpx;
  opacity: 0.8;
}

.score-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.score-level {
  font-size: 36rpx;
  font-weight: 700;
}

.score-offset {
  font-size: 22rpx;
  opacity: 0.9;
  line-height: 1.4;
}

.score-meta {
  margin-top: 16rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.18);
}

.score-meta-text {
  font-size: 22rpx;
  opacity: 0.85;
}

// —— 雷达图卡 ——

.radar-card {
  background: $color-surface;
  border-radius: $radius-lg;
  padding: 28rpx 24rpx 20rpx;
  box-shadow: $shadow-sm;
  margin-bottom: 24rpx;
}

.radar-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: $color-text-strong;
  margin-bottom: 12rpx;
  text-align: center;
}

.radar-legend {
  margin-top: 16rpx;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8rpx 16rpx;
}

.legend-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6rpx 12rpx;
  border-radius: $radius-sm;
  background: $color-bg;
  font-size: 22rpx;
}

.legend-item.dim-good {
  background: rgba(46, 184, 114, 0.08);
}

.legend-item.dim-warn {
  background: rgba(224, 159, 62, 0.1);
}

.legend-item.dim-bad {
  background: rgba(212, 88, 74, 0.08);
}

.legend-item.dim-muted {
  background: $color-bg;
  opacity: 0.6;
}

.legend-label {
  color: $color-text;
  font-size: 22rpx;
}

.legend-score {
  font-weight: 600;
  font-size: 24rpx;
}

.dim-good .legend-score {
  color: $color-success;
}

.dim-warn .legend-score {
  color: $color-warning;
}

.dim-bad .legend-score {
  color: $color-danger;
}

.dim-muted .legend-score {
  color: $color-text-faint;
}

// —— 各维度详情 ——

.dim-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 32rpx;
}

.dim-card {
  background: $color-surface;
  border-radius: $radius-md;
  padding: 18rpx 24rpx;
  box-shadow: $shadow-sm;
  border-left: 6rpx solid $color-border;
}

.dim-card.dim-good {
  border-left-color: $color-success;
}

.dim-card.dim-warn {
  border-left-color: $color-warning;
}

.dim-card.dim-bad {
  border-left-color: $color-danger;
}

.dim-card.dim-muted {
  border-left-color: $color-text-faint;
  opacity: 0.7;
}

.dim-head {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}

.dim-title {
  font-size: 26rpx;
  font-weight: 600;
  color: $color-text-strong;
  flex: 1;
}

.dim-weight {
  font-size: 20rpx;
  color: $color-text-faint;
}

.dim-score {
  font-size: 26rpx;
  font-weight: 700;
}

.dim-good .dim-score {
  color: $color-success;
}

.dim-warn .dim-score {
  color: $color-warning;
}

.dim-bad .dim-score {
  color: $color-danger;
}

.dim-muted .dim-score {
  color: $color-text-faint;
}

.dim-reasons {
  margin-top: 8rpx;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.dim-reason {
  font-size: 22rpx;
  color: $color-text-muted;
}

// —— 子菜单 ——

.sub-list-title {
  font-size: 24rpx;
  color: $color-text-muted;
  margin-bottom: 12rpx;
  padding-left: 4rpx;
}

.sub-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.sub-item {
  background: $color-surface;
  border-radius: $radius-md;
  padding: 24rpx;
  display: flex;
  align-items: center;
  box-shadow: $shadow-sm;
}

.sub-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 20rpx;
}

.sub-emoji {
  font-size: 40rpx;
  line-height: 1;
}

.sub-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.sub-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $color-text-strong;
}

.sub-desc {
  font-size: 22rpx;
  color: $color-text-muted;
}

.sub-arrow {
  font-size: 36rpx;
  color: $color-text-faint;
  flex-shrink: 0;
}

.disclaimer {
  margin-top: 32rpx;
  text-align: center;
  font-size: 22rpx;
  color: $color-text-faint;
  line-height: 1.6;
}
</style>

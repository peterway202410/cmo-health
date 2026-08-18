<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import AppTabBar from '@/components/AppTabBar.vue';
import { useMetricsStore } from '@/stores/metrics';
import { useQuestionnaireStore } from '@/stores/questionnaire';
import { useAssessmentStore } from '@/stores/assessment';
import { formatDateTime } from '@/utils/date';

const metricsStore = useMetricsStore();
const qStore = useQuestionnaireStore();
const assessmentStore = useAssessmentStore();

function refresh() {
  metricsStore.load();
  qStore.load();
  assessmentStore.recompute();
}

onMounted(refresh);
onShow(refresh);

// —— 各项目摘要 ——

interface RowSummary {
  summary: string; // 主要摘要（最近一次值）
  time: string; // 采集时间
  badge?: string; // 右上角小标签（可选，例如问卷扣分）
}

function findLatestWith<T extends { created_at: string }>(
  arr: T[],
  has: (rec: T) => boolean,
): T | undefined {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (has(arr[i])) return arr[i];
  }
  return undefined;
}

function maxIso(...candidates: (string | undefined)[]): string {
  const list = candidates.filter((x): x is string => !!x);
  if (list.length === 0) return '';
  return list.reduce((a, b) => (new Date(a).getTime() >= new Date(b).getTime() ? a : b));
}

const weightSummary = computed<RowSummary | null>(() => {
  const arr = metricsStore.weight;
  if (arr.length === 0) return null;
  const w = findLatestWith(arr, (r) => r.weight_kg != null);
  const waist = findLatestWith(arr, (r) => r.waist_cm != null);
  const hip = findLatestWith(arr, (r) => r.hip_cm != null);
  const parts: string[] = [];
  if (w?.weight_kg != null) parts.push(`体重 ${w.weight_kg.toFixed(1)} kg`);
  if (waist?.waist_cm != null) parts.push(`腰 ${waist.waist_cm.toFixed(1)}`);
  if (hip?.hip_cm != null) parts.push(`臀 ${hip.hip_cm.toFixed(1)}`);
  return {
    summary: parts.join(' · '),
    time: formatDateTime(maxIso(w?.created_at, waist?.created_at, hip?.created_at)),
  };
});

const bpSummary = computed<RowSummary | null>(() => {
  const arr = metricsStore.bp;
  if (arr.length === 0) return null;
  const last = arr[arr.length - 1];
  return {
    summary: `${last.systolic_mmHg} / ${last.diastolic_mmHg} mmHg`,
    time: formatDateTime(last.created_at),
  };
});

const glucoseSummary = computed<RowSummary | null>(() => {
  const arr = metricsStore.glucose;
  if (arr.length === 0) return null;
  const fpg = findLatestWith(arr, (r) => r.fpg_mmol_per_l != null);
  const pp = findLatestWith(arr, (r) => r.pp2h_mmol_per_l != null);
  const hb = findLatestWith(arr, (r) => r.hba1c_pct != null);
  const parts: string[] = [];
  if (fpg?.fpg_mmol_per_l != null) parts.push(`空腹 ${fpg.fpg_mmol_per_l.toFixed(1)}`);
  if (pp?.pp2h_mmol_per_l != null) parts.push(`餐后2h ${pp.pp2h_mmol_per_l.toFixed(1)}`);
  if (hb?.hba1c_pct != null) parts.push(`HbA1c ${hb.hba1c_pct.toFixed(1)}%`);
  return {
    summary: parts.join(' · '),
    time: formatDateTime(maxIso(fpg?.created_at, pp?.created_at, hb?.created_at)),
  };
});

const lipidSummary = computed<RowSummary | null>(() => {
  const arr = metricsStore.lipid;
  if (arr.length === 0) return null;
  const tg = findLatestWith(arr, (r) => r.tg_mmol_per_l != null);
  const hdl = findLatestWith(arr, (r) => r.hdl_mmol_per_l != null);
  const ldl = findLatestWith(arr, (r) => r.ldl_mmol_per_l != null);
  const tc = findLatestWith(arr, (r) => r.tc_mmol_per_l != null);
  const parts: string[] = [];
  if (tg?.tg_mmol_per_l != null) parts.push(`TG ${tg.tg_mmol_per_l.toFixed(2)}`);
  if (hdl?.hdl_mmol_per_l != null) parts.push(`HDL ${hdl.hdl_mmol_per_l.toFixed(2)}`);
  if (ldl?.ldl_mmol_per_l != null) parts.push(`LDL ${ldl.ldl_mmol_per_l.toFixed(2)}`);
  if (tc?.tc_mmol_per_l != null) parts.push(`TC ${tc.tc_mmol_per_l.toFixed(2)}`);
  return {
    summary: parts.join(' · '),
    time: formatDateTime(
      maxIso(tg?.created_at, hdl?.created_at, ldl?.created_at, tc?.created_at),
    ),
  };
});

const uricSummary = computed<RowSummary | null>(() => {
  const arr = metricsStore.uric;
  if (arr.length === 0) return null;
  const last = arr[arr.length - 1];
  return {
    summary: `${last.uric_umol_per_l} μmol/L`,
    time: formatDateTime(last.created_at),
  };
});

// 问卷：展示核心 3 个值
const questionnaireSummary = computed<RowSummary | null>(() => {
  const q = qStore.current;
  if (!q) return null;
  const sleep = `睡眠 ${q.sleep_hours}h`;
  const exercise = `运动 ${q.exercise_per_week}次/周`;
  const stress = `压力 ${q.stress_level}`;
  return {
    summary: [sleep, exercise, stress].join(' · '),
    time: formatDateTime(q.created_at),
  };
});

// —— 列表数据 ——

interface RowItem {
  key: string;
  label: string;
  emoji: string;
  bg: string;
  path: string;
  summary: RowSummary | null;
}

const rows = computed<RowItem[]>(() => [
  {
    key: 'weight',
    label: '体重',
    emoji: '⚖️',
    bg: '#fff1ec',
    path: '/pages/records/weight/weight',
    summary: weightSummary.value,
  },
  {
    key: 'bp',
    label: '血压',
    emoji: '💗',
    bg: '#ecf4ff',
    path: '/pages/records/bp/bp',
    summary: bpSummary.value,
  },
  {
    key: 'glucose',
    label: '血糖',
    emoji: '🩸',
    bg: '#f1ecff',
    path: '/pages/records/glucose/glucose',
    summary: glucoseSummary.value,
  },
  {
    key: 'lipid',
    label: '血脂',
    emoji: '🧪',
    bg: '#fff7e6',
    path: '/pages/records/lipid/lipid',
    summary: lipidSummary.value,
  },
  {
    key: 'uric',
    label: '尿酸',
    emoji: '⚗️',
    bg: '#fde8ea',
    path: '/pages/records/uric/uric',
    summary: uricSummary.value,
  },
  {
    key: 'questionnaire',
    label: '生活方式问卷',
    emoji: '📝',
    bg: '#ecfaf3',
    path: '/pages/records/questionnaire/questionnaire',
    summary: questionnaireSummary.value,
  },
]);

function go(item: RowItem) {
  uni.navigateTo({ url: item.path });
}
</script>

<template>
  <view class="page">
    <view class="list">
      <view v-for="item in rows" :key="item.key" class="row" @click="go(item)">
        <view class="icon" :style="{ background: item.bg }">
          <text class="emoji">{{ item.emoji }}</text>
        </view>
        <view class="row-main">
          <view class="row-head">
            <text class="row-label">{{ item.label }}</text>
            <text v-if="item.summary?.badge" class="row-badge">
              {{ item.summary.badge }}
            </text>
          </view>
          <text v-if="item.summary" class="row-summary">
            {{ item.summary.summary }}
          </text>
          <text v-else class="row-empty">尚未录入</text>
          <text v-if="item.summary" class="row-time">{{ item.summary.time }}</text>
        </view>
        <text class="row-arrow">›</text>
      </view>
    </view>
    <AppTabBar active="records" />
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.page {
  min-height: 100vh;
  width: 100%;
  max-width: $container-max-width;
  margin: 0 auto;
  padding: 24rpx 32rpx;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.row {
  background: $color-surface;
  border-radius: $radius-md;
  padding: 24rpx 24rpx;
  display: flex;
  align-items: center;
  box-shadow: $shadow-sm;
}

.icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 20rpx;
}

.emoji {
  font-size: 40rpx;
  line-height: 1;
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.row-label {
  font-size: 28rpx;
  font-weight: 600;
  color: $color-text-strong;
}

.row-badge {
  font-size: 20rpx;
  color: $color-primary;
  background: rgba(42, 141, 127, 0.1);
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  flex-shrink: 0;
}

.row-summary {
  font-size: 24rpx;
  color: $color-text-muted;
  /* 单行省略 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-empty {
  font-size: 24rpx;
  color: $color-text-faint;
  font-style: italic;
}

.row-time {
  font-size: 20rpx;
  color: $color-text-faint;
}

.row-arrow {
  margin-left: 16rpx;
  font-size: 36rpx;
  color: $color-text-faint;
  flex-shrink: 0;
}
</style>

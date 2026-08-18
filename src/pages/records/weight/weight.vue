<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useMetricsStore } from '@/stores/metrics';
import { checkRange, toNum, type ValidationError } from '@/utils/validators';
import { formatDateTime, nowIso } from '@/utils/date';
import AppTabBar from '@/components/AppTabBar.vue';
import MeasuredAtPicker from '@/components/MeasuredAtPicker.vue';

const metricsStore = useMetricsStore();

const form = reactive({
  weight_kg: '' as string,
  waist_cm: '' as string,
  hip_cm: '' as string,
  period: 'any' as 'any' | 'morning' | 'bedtime',
});

const measuredAt = ref<string>(nowIso());
/** 编辑模式时存原记录的 created_at */
const editingId = ref<string | null>(null);
/** 历史列表当前显示条数（分页） */
const visibleCount = ref<number>(5);

function resetForm() {
  form.weight_kg = '';
  form.waist_cm = '';
  form.hip_cm = '';
  form.period = 'any';
  measuredAt.value = nowIso();
  editingId.value = null;
}

onMounted(() => {
  metricsStore.load();
  resetForm();
});
onShow(() => {
  metricsStore.load();
});

const recentList = computed(() => {
  // 倒序，按 visibleCount 截取
  return [...metricsStore.weight].reverse().slice(0, visibleCount.value);
});

const totalCount = computed(() => metricsStore.weight.length);
const hasMore = computed(() => visibleCount.value < totalCount.value);

function loadMore() {
  visibleCount.value = Math.min(visibleCount.value + 5, totalCount.value);
}

function validate(): ValidationError | null {
  const w = toNum(form.weight_kg);
  const waist = toNum(form.waist_cm);
  const hip = toNum(form.hip_cm);
  if (w === undefined && waist === undefined && hip === undefined) {
    return { field: 'all', message: '请至少填写一项' };
  }
  return (
    checkRange(w, { field: 'weight_kg', label: '体重', min: 20, max: 300, optional: true }) ||
    checkRange(waist, { field: 'waist_cm', label: '腰围', min: 30, max: 200, optional: true }) ||
    checkRange(hip, { field: 'hip_cm', label: '臀围', min: 30, max: 200, optional: true })
  );
}

function handleSubmit() {
  const err = validate();
  if (err) {
    uni.showToast({ title: err.message, icon: 'none' });
    return;
  }
  const patch = {
    weight_kg: toNum(form.weight_kg),
    waist_cm: toNum(form.waist_cm),
    hip_cm: toNum(form.hip_cm),
    period: form.period,
  };
  if (editingId.value) {
    metricsStore.updateRecord('weight', editingId.value, patch, measuredAt.value);
    uni.showToast({ title: '已更新', icon: 'success' });
  } else {
    metricsStore.addWeight(patch, measuredAt.value);
    uni.showToast({ title: '已保存', icon: 'success' });
  }
  resetForm();
}

function handleEdit(rec: {
  weight_kg?: number;
  waist_cm?: number;
  hip_cm?: number;
  period?: 'any' | 'morning' | 'bedtime';
  created_at: string;
}) {
  form.weight_kg = rec.weight_kg != null ? String(rec.weight_kg) : '';
  form.waist_cm = rec.waist_cm != null ? String(rec.waist_cm) : '';
  form.hip_cm = rec.hip_cm != null ? String(rec.hip_cm) : '';
  form.period = rec.period ?? 'any';
  measuredAt.value = rec.created_at;
  editingId.value = rec.created_at;
  uni.pageScrollTo({ scrollTop: 0, duration: 200 });
}

function handleCancelEdit() {
  resetForm();
}

function handleDelete(rec: { created_at: string }) {
  uni.showModal({
    title: '删除记录？',
    content: '此操作无法撤销。',
    confirmText: '删除',
    confirmColor: '#d4584a',
    success: ({ confirm }) => {
      if (confirm) {
        metricsStore.removeRecord('weight', rec.created_at);
        if (editingId.value === rec.created_at) resetForm();
        uni.showToast({ title: '已删除', icon: 'success' });
      }
    },
  });
}

function formatRecord(rec: {
  weight_kg?: number;
  waist_cm?: number;
  hip_cm?: number;
  period?: 'any' | 'morning' | 'bedtime';
}): string {
  const parts: string[] = [];
  if (rec.weight_kg != null) {
    const tag = rec.period && rec.period !== 'any' ? ` (${periodLabel(rec.period)})` : '';
    parts.push(`体重 ${rec.weight_kg.toFixed(1)} kg${tag}`);
  }
  if (rec.waist_cm != null) parts.push(`腰 ${rec.waist_cm.toFixed(1)} cm`);
  if (rec.hip_cm != null) parts.push(`臀 ${rec.hip_cm.toFixed(1)} cm`);
  return parts.join(' · ');
}

const periodOptions = [
  { value: 'any', label: '任意时段' },
  { value: 'morning', label: '晨起' },
  { value: 'bedtime', label: '睡前' },
] as const;

function periodLabel(v: 'any' | 'morning' | 'bedtime'): string {
  return periodOptions.find((o) => o.value === v)?.label ?? '任意时段';
}

function onPeriodChange(e: { detail: { value: number | string } }) {
  const idx = Number(e.detail.value);
  if (Number.isFinite(idx) && periodOptions[idx]) {
    form.period = periodOptions[idx].value;
  }
}

const periodIndex = computed(() =>
  Math.max(0, periodOptions.findIndex((o) => o.value === form.period)),
);
</script>

<template>
  <view class="record-page">
    <view class="record-header">
      <view class="record-title-block">
        <text class="record-title">{{ editingId ? '编辑：体重' : '体重' }}</text>
        <text class="record-subtitle">体重、腰围、臀围（至少填一项）</text>
      </view>
    </view>

    <view class="record-form">
      <view class="record-field">
        <view class="record-field-label">
          <text class="record-label">体重</text>
          <picker
            mode="selector"
            :range="periodOptions"
            range-key="label"
            :value="periodIndex"
            @change="onPeriodChange"
          >
            <view class="period-picker">
              <text class="period-text">{{ periodLabel(form.period) }}</text>
              <text class="period-arrow">▾</text>
            </view>
          </picker>
        </view>
        <view class="record-input-block">
          <view class="record-input-wrap">
            <input class="record-input" type="digit" v-model="form.weight_kg" />
          </view>
          <text class="record-unit">kg</text>
        </view>
      </view>

      <view class="record-field-vertical">
        <view class="record-field-row">
          <view class="record-field-label">
            <text class="record-label">腰围</text>
            <text class="record-label-hint">肚脐水平一周</text>
          </view>
          <view class="record-input-block">
            <view class="record-input-wrap">
              <input class="record-input" type="digit" v-model="form.waist_cm" />
            </view>
            <text class="record-unit">cm</text>
          </view>
        </view>
      </view>

      <view class="record-field">
        <view class="record-field-label">
          <text class="record-label">臀围</text>
          <text class="record-label-hint">臀部最丰满处一周</text>
        </view>
        <view class="record-input-block">
          <view class="record-input-wrap">
            <input class="record-input" type="digit" v-model="form.hip_cm" />
          </view>
          <text class="record-unit">cm</text>
        </view>
      </view>

      <MeasuredAtPicker v-model="measuredAt" />
    </view>

    <view class="record-actions">
      <button class="record-primary-btn" @click="handleSubmit">
        {{ editingId ? '更新本条记录' : '保存本次记录' }}
      </button>
      <button v-if="editingId" class="record-secondary-btn" @click="handleCancelEdit">
        取消编辑
      </button>
    </view>

    <view class="record-history">
      <view class="record-history-header">
        <text class="record-history-title">历史记录</text>
        <text v-if="totalCount > 0" class="record-history-count">共 {{ totalCount }} 条</text>
      </view>
      <view v-if="recentList.length === 0" class="record-history-empty">暂无记录</view>
      <view v-else class="record-history-list">
        <view v-for="rec in recentList" :key="rec.created_at" class="record-history-item">
          <view class="record-history-main">
            <text class="record-history-value">{{ formatRecord(rec) }}</text>
            <text class="record-history-time">{{ formatDateTime(rec.created_at) }}</text>
          </view>
          <view class="record-history-actions">
            <text class="record-history-action" @click="handleEdit(rec)">编辑</text>
            <text class="record-history-action danger" @click="handleDelete(rec)">删除</text>
          </view>
        </view>
      </view>
      <view v-if="hasMore" class="load-more" @click="loadMore">
        加载更多（剩余 {{ totalCount - visibleCount }} 条）
      </view>
    </view>
    <AppTabBar active="records" />
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/record.scss';
@import '@/styles/variables.scss';

.record-field-vertical {
  padding: 28rpx 0;
  border-bottom: 1rpx solid $color-border;
}

.record-field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.period-picker {
  display: inline-flex;
  align-items: center;
  background: $color-bg;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  margin-top: 8rpx;
  align-self: flex-start;
}

.period-text {
  font-size: 22rpx;
  color: $color-primary;
}

.period-arrow {
  font-size: 18rpx;
  color: $color-primary;
  margin-left: 4rpx;
}
</style>

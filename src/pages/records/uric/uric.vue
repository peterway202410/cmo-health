<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useMetricsStore } from '@/stores/metrics';
import { useProfileStore } from '@/stores/profile';
import { useThresholdsStore } from '@/stores/thresholds';
import { checkRange, toNum, type ValidationError } from '@/utils/validators';
import { formatDateTime, nowIso } from '@/utils/date';
import AppTabBar from '@/components/AppTabBar.vue';
import MeasuredAtPicker from '@/components/MeasuredAtPicker.vue';

const metricsStore = useMetricsStore();
const profileStore = useProfileStore();
const tStore = useThresholdsStore();

const form = reactive({ uric_umol_per_l: '' as string });
const measuredAt = ref<string>(nowIso());
const editingId = ref<string | null>(null);
const visibleCount = ref<number>(5);

function resetForm() {
  form.uric_umol_per_l = '';
  measuredAt.value = nowIso();
  editingId.value = null;
}

onMounted(() => {
  metricsStore.load();
  profileStore.load();
  tStore.load();
  resetForm();
});
onShow(() => {
  metricsStore.load();
  profileStore.load();
  tStore.load();
});

const recentList = computed(() =>
  [...metricsStore.uric].reverse().slice(0, visibleCount.value),
);
const totalCount = computed(() => metricsStore.uric.length);
const hasMore = computed(() => visibleCount.value < totalCount.value);
function loadMore() {
  visibleCount.value = Math.min(visibleCount.value + 5, totalCount.value);
}

const threshold = computed(() => {
  return profileStore.profile?.gender === 'female'
    ? tStore.thresholds.uric_female
    : tStore.thresholds.uric_male;
});

function classify(uric: number): { label: string; color: string } {
  return uric > threshold.value
    ? { label: '偏高', color: '#d4584a' }
    : { label: '正常', color: '#2eb872' };
}

function validate(): ValidationError | null {
  const u = toNum(form.uric_umol_per_l);
  return checkRange(u, { field: 'uric_umol_per_l', label: '尿酸', min: 50, max: 1500 });
}

function handleSubmit() {
  const err = validate();
  if (err) {
    uni.showToast({ title: err.message, icon: 'none' });
    return;
  }
  const patch = { uric_umol_per_l: toNum(form.uric_umol_per_l)! };
  if (editingId.value) {
    metricsStore.updateRecord('uric', editingId.value, patch, measuredAt.value);
    uni.showToast({ title: '已更新', icon: 'success' });
  } else {
    metricsStore.addUric(patch, measuredAt.value);
    uni.showToast({ title: '已保存', icon: 'success' });
  }
  resetForm();
}

function handleEdit(rec: { uric_umol_per_l: number; created_at: string }) {
  form.uric_umol_per_l = String(rec.uric_umol_per_l);
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
        metricsStore.removeRecord('uric', rec.created_at);
        if (editingId.value === rec.created_at) resetForm();
        uni.showToast({ title: '已删除', icon: 'success' });
      }
    },
  });
}
</script>

<template>
  <view class="record-page">
    <view class="record-header">
      <view class="record-title-block">
        <text class="record-title">{{ editingId ? '编辑：尿酸' : '尿酸' }}</text>
        <text class="record-subtitle">血尿酸（UA）</text>
      </view>
    </view>

    <view class="record-form">
      <view class="record-field">
        <view class="record-field-label">
          <text class="record-label">血尿酸</text>
          <text class="record-label-hint">单位若为 mg/dL，可乘 59.5 换算</text>
        </view>
        <view class="record-input-block">
          <view class="record-input-wrap">
            <input class="record-input" type="number" v-model="form.uric_umol_per_l" />
          </view>
          <text class="record-unit">μmol/L</text>
        </view>
      </view>

      <MeasuredAtPicker v-model="measuredAt" />
    </view>

    <view class="record-tip">
      <text class="record-tip-text">
        当前你的判定阈值为
        <text class="record-tip-strong">{{ threshold }} μmol/L</text>。
      </text>
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
            <view class="uric-result">
              <text class="record-history-value">{{ rec.uric_umol_per_l }} μmol/L</text>
              <text class="uric-tag" :style="{ color: classify(rec.uric_umol_per_l).color }">
                {{ classify(rec.uric_umol_per_l).label }}
              </text>
            </view>
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

.record-tip-strong {
  color: $color-primary;
  font-weight: 600;
}

.uric-result {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.uric-tag {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.04);
}
</style>

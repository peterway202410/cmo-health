<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useMetricsStore } from '@/stores/metrics';
import { useThresholdsStore } from '@/stores/thresholds';
import { checkRange, toNum, type ValidationError } from '@/utils/validators';
import { formatDateTime, nowIso } from '@/utils/date';
import AppTabBar from '@/components/AppTabBar.vue';
import MeasuredAtPicker from '@/components/MeasuredAtPicker.vue';

const metricsStore = useMetricsStore();
const tStore = useThresholdsStore();

const form = reactive({
  systolic_mmHg: '' as string,
  diastolic_mmHg: '' as string,
  heart_rate_bpm: '' as string,
});
const measuredAt = ref<string>(nowIso());
const editingId = ref<string | null>(null);
const visibleCount = ref<number>(5);

function resetForm() {
  form.systolic_mmHg = '';
  form.diastolic_mmHg = '';
  form.heart_rate_bpm = '';
  measuredAt.value = nowIso();
  editingId.value = null;
}

onMounted(() => {
  metricsStore.load();
  tStore.load();
  resetForm();
});
onShow(() => {
  metricsStore.load();
  tStore.load();
});

const recentList = computed(() =>
  [...metricsStore.bp].reverse().slice(0, visibleCount.value),
);
const totalCount = computed(() => metricsStore.bp.length);
const hasMore = computed(() => visibleCount.value < totalCount.value);

function loadMore() {
  visibleCount.value = Math.min(visibleCount.value + 5, totalCount.value);
}

function classifyBP(s: number, d: number): { label: string; color: string } {
  const sysT = tStore.thresholds.bp_sys_mmHg;
  const diaT = tStore.thresholds.bp_dia_mmHg;
  if (s >= 140 || d >= 90) return { label: '本次明显偏高', color: '#d4584a' };
  if (s >= sysT || d >= diaT) return { label: '本次偏高', color: '#e09f3e' };
  return { label: '正常', color: '#2eb872' };
}

function validate(): ValidationError | null {
  const s = toNum(form.systolic_mmHg);
  const d = toNum(form.diastolic_mmHg);
  const hr = toNum(form.heart_rate_bpm);
  return (
    checkRange(s, { field: 'systolic_mmHg', label: '收缩压', min: 60, max: 260 }) ||
    checkRange(d, { field: 'diastolic_mmHg', label: '舒张压', min: 30, max: 200 }) ||
    checkRange(hr, { field: 'heart_rate_bpm', label: '心率', min: 30, max: 220, optional: true }) ||
    (s !== undefined && d !== undefined && s <= d
      ? { field: 'systolic_mmHg', message: '收缩压应大于舒张压' }
      : null)
  );
}

function handleSubmit() {
  const err = validate();
  if (err) {
    uni.showToast({ title: err.message, icon: 'none' });
    return;
  }
  const s = toNum(form.systolic_mmHg)!;
  const d = toNum(form.diastolic_mmHg)!;
  const hr = toNum(form.heart_rate_bpm);
  const patch = { systolic_mmHg: s, diastolic_mmHg: d, heart_rate_bpm: hr };
  if (editingId.value) {
    metricsStore.updateRecord('bp', editingId.value, patch, measuredAt.value);
    uni.showToast({ title: '已更新', icon: 'success' });
  } else {
    metricsStore.addBP(patch, measuredAt.value);
    uni.showToast({ title: '已保存', icon: 'success' });
  }
  resetForm();
}

function handleEdit(rec: {
  systolic_mmHg: number;
  diastolic_mmHg: number;
  heart_rate_bpm?: number;
  created_at: string;
}) {
  form.systolic_mmHg = String(rec.systolic_mmHg);
  form.diastolic_mmHg = String(rec.diastolic_mmHg);
  form.heart_rate_bpm = rec.heart_rate_bpm != null ? String(rec.heart_rate_bpm) : '';
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
        metricsStore.removeRecord('bp', rec.created_at);
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
        <text class="record-title">{{ editingId ? '编辑：血压' : '血压' }}</text>
        <text class="record-subtitle">收缩压 / 舒张压</text>
      </view>
    </view>

    <view class="record-form">
      <view class="record-field">
        <view class="record-field-label">
          <text class="record-label">收缩压（高压）</text>
          <text class="record-label-hint">需多次测量综合判断</text>
        </view>
        <view class="record-input-block">
          <view class="record-input-wrap">
            <input class="record-input" type="number" v-model="form.systolic_mmHg" />
          </view>
          <text class="record-unit">mmHg</text>
        </view>
      </view>

      <view class="record-field">
        <view class="record-field-label">
          <text class="record-label">舒张压（低压）</text>
        </view>
        <view class="record-input-block">
          <view class="record-input-wrap">
            <input class="record-input" type="number" v-model="form.diastolic_mmHg" />
          </view>
          <text class="record-unit">mmHg</text>
        </view>
      </view>

      <view class="record-field">
        <view class="record-field-label">
          <text class="record-label">心率</text>
          <text class="record-label-hint">可选；正常 60-100 次/分</text>
        </view>
        <view class="record-input-block">
          <view class="record-input-wrap">
            <input class="record-input" type="number" v-model="form.heart_rate_bpm" />
          </view>
          <text class="record-unit">bpm</text>
        </view>
      </view>

      <MeasuredAtPicker v-model="measuredAt" />
    </view>

    <view class="record-tip">
      <text class="record-tip-text">
        建议安静坐位休息 5 分钟后再测量；同一时段连续测两次取平均更准确。
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
            <view class="bp-result">
              <text class="record-history-value">
                {{ rec.systolic_mmHg }} / {{ rec.diastolic_mmHg }}
              </text>
              <text v-if="rec.heart_rate_bpm != null" class="bp-hr">
                ♥ {{ rec.heart_rate_bpm }}
              </text>
              <text
                class="bp-tag"
                :style="{ color: classifyBP(rec.systolic_mmHg, rec.diastolic_mmHg).color }"
              >
                {{ classifyBP(rec.systolic_mmHg, rec.diastolic_mmHg).label }}
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

.bp-result {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.bp-tag {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.04);
}

.bp-hr {
  font-size: 22rpx;
  color: $color-text-muted;
}
</style>

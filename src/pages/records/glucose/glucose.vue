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
  fpg_mmol_per_l: '' as string,
  pp2h_mmol_per_l: '' as string,
  hba1c_pct: '' as string,
});
const measuredAt = ref<string>(nowIso());
const editingId = ref<string | null>(null);
const visibleCount = ref<number>(5);

function resetForm() {
  form.fpg_mmol_per_l = '';
  form.pp2h_mmol_per_l = '';
  form.hba1c_pct = '';
  measuredAt.value = nowIso();
  editingId.value = null;
}

onMounted(() => {
  metricsStore.load();
  resetForm();
});
onShow(() => metricsStore.load());

const recentList = computed(() =>
  [...metricsStore.glucose].reverse().slice(0, visibleCount.value),
);
const totalCount = computed(() => metricsStore.glucose.length);
const hasMore = computed(() => visibleCount.value < totalCount.value);
function loadMore() {
  visibleCount.value = Math.min(visibleCount.value + 5, totalCount.value);
}

function validate(): ValidationError | null {
  const fpg = toNum(form.fpg_mmol_per_l);
  const pp2h = toNum(form.pp2h_mmol_per_l);
  const hba1c = toNum(form.hba1c_pct);
  if (fpg === undefined && pp2h === undefined && hba1c === undefined) {
    return { field: 'all', message: '请至少填写一项' };
  }
  return (
    checkRange(fpg, { field: 'fpg_mmol_per_l', label: '空腹血糖', min: 1, max: 30, optional: true }) ||
    checkRange(pp2h, { field: 'pp2h_mmol_per_l', label: '餐后两小时血糖', min: 1, max: 40, optional: true }) ||
    checkRange(hba1c, { field: 'hba1c_pct', label: '糖化血红蛋白', min: 2, max: 20, optional: true })
  );
}

function handleSubmit() {
  const err = validate();
  if (err) {
    uni.showToast({ title: err.message, icon: 'none' });
    return;
  }
  const patch = {
    fpg_mmol_per_l: toNum(form.fpg_mmol_per_l),
    pp2h_mmol_per_l: toNum(form.pp2h_mmol_per_l),
    hba1c_pct: toNum(form.hba1c_pct),
  };
  if (editingId.value) {
    metricsStore.updateRecord('glucose', editingId.value, patch, measuredAt.value);
    uni.showToast({ title: '已更新', icon: 'success' });
  } else {
    metricsStore.addGlucose(patch, measuredAt.value);
    uni.showToast({ title: '已保存', icon: 'success' });
  }
  resetForm();
}

function handleEdit(rec: {
  fpg_mmol_per_l?: number;
  pp2h_mmol_per_l?: number;
  hba1c_pct?: number;
  created_at: string;
}) {
  form.fpg_mmol_per_l = rec.fpg_mmol_per_l != null ? String(rec.fpg_mmol_per_l) : '';
  form.pp2h_mmol_per_l = rec.pp2h_mmol_per_l != null ? String(rec.pp2h_mmol_per_l) : '';
  form.hba1c_pct = rec.hba1c_pct != null ? String(rec.hba1c_pct) : '';
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
        metricsStore.removeRecord('glucose', rec.created_at);
        if (editingId.value === rec.created_at) resetForm();
        uni.showToast({ title: '已删除', icon: 'success' });
      }
    },
  });
}

function formatRecord(rec: {
  fpg_mmol_per_l?: number;
  pp2h_mmol_per_l?: number;
  hba1c_pct?: number;
}): string {
  const parts: string[] = [];
  if (rec.fpg_mmol_per_l != null) parts.push(`空腹 ${rec.fpg_mmol_per_l.toFixed(1)}`);
  if (rec.pp2h_mmol_per_l != null) parts.push(`餐后2h ${rec.pp2h_mmol_per_l.toFixed(1)}`);
  if (rec.hba1c_pct != null) parts.push(`HbA1c ${rec.hba1c_pct.toFixed(1)}%`);
  return parts.join(' · ');
}
</script>

<template>
  <view class="record-page">
    <view class="record-header">
      <view class="record-title-block">
        <text class="record-title">{{ editingId ? '编辑：血糖' : '血糖' }}</text>
        <text class="record-subtitle">空腹 / 餐后两小时 / 糖化血红蛋白</text>
      </view>
    </view>

    <view class="record-form">
      <view class="record-field">
        <view class="record-field-label">
          <text class="record-label">空腹血糖</text>
          <text class="record-label-hint">禁食 8 小时以上</text>
        </view>
        <view class="record-input-block">
          <view class="record-input-wrap">
            <input class="record-input" type="digit" v-model="form.fpg_mmol_per_l" />
          </view>
          <text class="record-unit">mmol/L</text>
        </view>
      </view>

      <view class="record-field">
        <view class="record-field-label">
          <text class="record-label">餐后两小时血糖</text>
          <text class="record-label-hint">可选</text>
        </view>
        <view class="record-input-block">
          <view class="record-input-wrap">
            <input class="record-input" type="digit" v-model="form.pp2h_mmol_per_l" />
          </view>
          <text class="record-unit">mmol/L</text>
        </view>
      </view>

      <view class="record-field">
        <view class="record-field-label">
          <text class="record-label">糖化血红蛋白 HbA1c</text>
          <text class="record-label-hint">可选；反映近 2-3 个月血糖</text>
        </view>
        <view class="record-input-block">
          <view class="record-input-wrap">
            <input class="record-input" type="digit" v-model="form.hba1c_pct" />
          </view>
          <text class="record-unit">%</text>
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
</style>

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
  tg_mmol_per_l: '' as string,
  hdl_mmol_per_l: '' as string,
  ldl_mmol_per_l: '' as string,
  tc_mmol_per_l: '' as string,
});
const measuredAt = ref<string>(nowIso());
const editingId = ref<string | null>(null);
const visibleCount = ref<number>(5);

function resetForm() {
  form.tg_mmol_per_l = '';
  form.hdl_mmol_per_l = '';
  form.ldl_mmol_per_l = '';
  form.tc_mmol_per_l = '';
  measuredAt.value = nowIso();
  editingId.value = null;
}

onMounted(() => {
  metricsStore.load();
  resetForm();
});
onShow(() => metricsStore.load());

const recentList = computed(() =>
  [...metricsStore.lipid].reverse().slice(0, visibleCount.value),
);
const totalCount = computed(() => metricsStore.lipid.length);
const hasMore = computed(() => visibleCount.value < totalCount.value);
function loadMore() {
  visibleCount.value = Math.min(visibleCount.value + 5, totalCount.value);
}

function validate(): ValidationError | null {
  const tg = toNum(form.tg_mmol_per_l);
  const hdl = toNum(form.hdl_mmol_per_l);
  const ldl = toNum(form.ldl_mmol_per_l);
  const tc = toNum(form.tc_mmol_per_l);
  if (tg === undefined && hdl === undefined && ldl === undefined && tc === undefined) {
    return { field: 'all', message: '请至少填写一项' };
  }
  return (
    checkRange(tg, { field: 'tg_mmol_per_l', label: '甘油三酯', min: 0.1, max: 30, optional: true }) ||
    checkRange(hdl, { field: 'hdl_mmol_per_l', label: 'HDL 高密度', min: 0.1, max: 10, optional: true }) ||
    checkRange(ldl, { field: 'ldl_mmol_per_l', label: 'LDL 低密度', min: 0.1, max: 15, optional: true }) ||
    checkRange(tc, { field: 'tc_mmol_per_l', label: '总胆固醇', min: 1, max: 30, optional: true })
  );
}

function handleSubmit() {
  const err = validate();
  if (err) {
    uni.showToast({ title: err.message, icon: 'none' });
    return;
  }
  const patch = {
    tg_mmol_per_l: toNum(form.tg_mmol_per_l),
    hdl_mmol_per_l: toNum(form.hdl_mmol_per_l),
    ldl_mmol_per_l: toNum(form.ldl_mmol_per_l),
    tc_mmol_per_l: toNum(form.tc_mmol_per_l),
  };
  if (editingId.value) {
    metricsStore.updateRecord('lipid', editingId.value, patch, measuredAt.value);
    uni.showToast({ title: '已更新', icon: 'success' });
  } else {
    metricsStore.addLipid(patch, measuredAt.value);
    uni.showToast({ title: '已保存', icon: 'success' });
  }
  resetForm();
}

function handleEdit(rec: {
  tg_mmol_per_l?: number;
  hdl_mmol_per_l?: number;
  ldl_mmol_per_l?: number;
  tc_mmol_per_l?: number;
  created_at: string;
}) {
  form.tg_mmol_per_l = rec.tg_mmol_per_l != null ? String(rec.tg_mmol_per_l) : '';
  form.hdl_mmol_per_l = rec.hdl_mmol_per_l != null ? String(rec.hdl_mmol_per_l) : '';
  form.ldl_mmol_per_l = rec.ldl_mmol_per_l != null ? String(rec.ldl_mmol_per_l) : '';
  form.tc_mmol_per_l = rec.tc_mmol_per_l != null ? String(rec.tc_mmol_per_l) : '';
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
        metricsStore.removeRecord('lipid', rec.created_at);
        if (editingId.value === rec.created_at) resetForm();
        uni.showToast({ title: '已删除', icon: 'success' });
      }
    },
  });
}

function formatRecord(rec: {
  tg_mmol_per_l?: number;
  hdl_mmol_per_l?: number;
  ldl_mmol_per_l?: number;
  tc_mmol_per_l?: number;
}): string {
  const parts: string[] = [];
  if (rec.tg_mmol_per_l != null) parts.push(`TG ${rec.tg_mmol_per_l.toFixed(2)}`);
  if (rec.hdl_mmol_per_l != null) parts.push(`HDL ${rec.hdl_mmol_per_l.toFixed(2)}`);
  if (rec.ldl_mmol_per_l != null) parts.push(`LDL ${rec.ldl_mmol_per_l.toFixed(2)}`);
  if (rec.tc_mmol_per_l != null) parts.push(`TC ${rec.tc_mmol_per_l.toFixed(2)}`);
  return parts.join(' · ');
}
</script>

<template>
  <view class="record-page">
    <view class="record-header">
      <view class="record-title-block">
        <text class="record-title">{{ editingId ? '编辑：血脂' : '血脂' }}</text>
        <text class="record-subtitle">甘油三酯 / HDL / LDL / 总胆固醇</text>
      </view>
    </view>

    <view class="record-form">
      <view class="record-field">
        <view class="record-field-label">
          <text class="record-label">甘油三酯 TG</text>
        </view>
        <view class="record-input-block">
          <view class="record-input-wrap">
            <input class="record-input" type="digit" v-model="form.tg_mmol_per_l" />
          </view>
          <text class="record-unit">mmol/L</text>
        </view>
      </view>

      <view class="record-field">
        <view class="record-field-label">
          <text class="record-label">高密度 HDL</text>
        </view>
        <view class="record-input-block">
          <view class="record-input-wrap">
            <input class="record-input" type="digit" v-model="form.hdl_mmol_per_l" />
          </view>
          <text class="record-unit">mmol/L</text>
        </view>
      </view>

      <view class="record-field">
        <view class="record-field-label">
          <text class="record-label">低密度 LDL</text>
          <text class="record-label-hint">理想 &lt;3.4 mmol/L</text>
        </view>
        <view class="record-input-block">
          <view class="record-input-wrap">
            <input class="record-input" type="digit" v-model="form.ldl_mmol_per_l" />
          </view>
          <text class="record-unit">mmol/L</text>
        </view>
      </view>

      <view class="record-field">
        <view class="record-field-label">
          <text class="record-label">总胆固醇</text>
          <text class="record-label-hint">理想 &lt;5.2 mmol/L</text>
        </view>
        <view class="record-input-block">
          <view class="record-input-wrap">
            <input class="record-input" type="digit" v-model="form.tc_mmol_per_l" />
          </view>
          <text class="record-unit">mmol/L</text>
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

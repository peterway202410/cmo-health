<script setup lang="ts">
import { onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useThresholdsStore } from '@/stores/thresholds';
import { DEFAULT_THRESHOLDS, type Thresholds } from '@/infra/storage/schema';
import AppTabBar from '@/components/AppTabBar.vue';

const tStore = useThresholdsStore();

onMounted(() => tStore.load());
onShow(() => tStore.load());

interface Group {
  title: string;
  unit?: string;
  hint?: string;
  fields: { key: keyof Thresholds; label: string; unit?: string }[];
}

const groups: Group[] = [
  {
    title: 'BMI（中国成人）',
    fields: [
      { key: 'bmi_overweight', label: '超重起始' },
      { key: 'bmi_obese', label: '肥胖起始' },
    ],
    hint: '默认 24 / 28',
  },
  {
    title: '腰围（代谢综合征）',
    unit: 'cm',
    fields: [
      { key: 'waist_male_cm', label: '男 ≥' },
      { key: 'waist_female_cm', label: '女 ≥' },
    ],
    hint: '默认 90 / 85',
  },
  {
    title: '腰臀比',
    fields: [
      { key: 'whr_male', label: '男 >' },
      { key: 'whr_female', label: '女 >' },
    ],
    hint: '默认 0.9 / 0.85',
  },
  {
    title: '血压（反复偏高判定）',
    fields: [
      { key: 'bp_sys_mmHg', label: '收缩压 ≥', unit: 'mmHg' },
      { key: 'bp_dia_mmHg', label: '舒张压 ≥', unit: 'mmHg' },
      { key: 'bp_window_days', label: '窗口天数', unit: '天' },
      { key: 'bp_repeated_count', label: '触发次数', unit: '次' },
    ],
    hint: '默认 135/85；近 7 天 ≥ 5 次',
  },
  {
    title: '血糖（代谢综合征阈值）',
    unit: 'mmol/L',
    fields: [
      { key: 'fpg_mmol', label: '空腹 ≥' },
      { key: 'pp2h_mmol', label: '餐后2h ≥' },
    ],
    hint: '默认 6.1 / 7.8',
  },
  {
    title: '血脂',
    unit: 'mmol/L',
    fields: [
      { key: 'tg_mmol', label: 'TG ≥' },
      { key: 'hdl_mmol', label: 'HDL <' },
    ],
    hint: '默认 1.7 / 1.04',
  },
  {
    title: '血尿酸',
    unit: 'μmol/L',
    fields: [
      { key: 'uric_male', label: '男 >' },
      { key: 'uric_female', label: '女 >' },
    ],
    hint: '默认 420 / 360',
  },
];

function setField(key: keyof Thresholds, e: { detail: { value: string } }) {
  const v = Number(e.detail.value);
  if (!Number.isFinite(v)) return;
  tStore.update({ [key]: v } as unknown as Partial<Thresholds>);
}

function isModified(key: keyof Thresholds): boolean {
  return (
    (tStore.thresholds as unknown as Record<string, number>)[key as string] !==
    (DEFAULT_THRESHOLDS as unknown as Record<string, number>)[key as string]
  );
}

function resetAll() {
  uni.showModal({
    title: '恢复默认',
    content: '将所有参考值恢复为默认（中国成人通用标准）。',
    success: ({ confirm }) => {
      if (confirm) {
        tStore.resetAll();
        uni.showToast({ title: '已恢复', icon: 'success' });
      }
    },
  });
}
</script>

<template>
  <view class="page">
    <view class="page-header">
      <text class="title">参考值设置</text>
      <text class="subtitle">不同检测机构标准略有差异，可按报告调整</text>
    </view>

    <view v-for="g in groups" :key="g.title" class="group">
      <view class="group-head">
        <text class="group-title">{{ g.title }}</text>
        <text v-if="g.hint" class="group-hint">{{ g.hint }}</text>
      </view>
      <view v-for="f in g.fields" :key="f.key" class="row">
        <text class="row-label">{{ f.label }}</text>
        <view class="row-input-block">
          <input
            class="row-input"
            type="digit"
            :value="String(tStore.thresholds[f.key])"
            @blur="(e: any) => setField(f.key, e)"
          />
          <text v-if="f.unit ?? g.unit" class="row-unit">{{ f.unit ?? g.unit }}</text>
          <text v-if="isModified(f.key)" class="row-tag">已修改</text>
        </view>
      </view>
    </view>

    <view class="actions">
      <button class="btn-reset" @click="resetAll">全部恢复默认</button>
    </view>

    <view class="page-disclaimer">
      调整阈值会立即影响代谢评分计算。建议参照所在检测机构的标准；不确定时保留默认值。
    </view>
    <AppTabBar />
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.page {
  min-height: 100vh;
  width: 100%;
  max-width: $container-max-width;
  margin: 0 auto;
  padding: 32rpx 32rpx 60rpx;
}

.page-header {
  margin-bottom: 24rpx;
}

.title {
  font-size: 40rpx;
  font-weight: 700;
  color: $color-text-strong;
  display: block;
}

.subtitle {
  font-size: 24rpx;
  color: $color-text-muted;
  margin-top: 6rpx;
  display: block;
}

.group {
  background: $color-surface;
  border-radius: $radius-lg;
  padding: 8rpx 32rpx;
  box-shadow: $shadow-sm;
  margin-bottom: 24rpx;
}

.group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 20rpx 0 12rpx;
}

.group-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $color-primary;
}

.group-hint {
  font-size: 22rpx;
  color: $color-text-faint;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 0;
  border-top: 1rpx solid $color-border;

  &:first-of-type {
    border-top: none;
  }
}

.row-label {
  font-size: 26rpx;
  color: $color-text;
}

.row-input-block {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.row-input {
  width: 160rpx;
  text-align: right;
  font-size: 28rpx;
  color: $color-text-strong;
  font-weight: 600;
  background: $color-bg;
  padding: 8rpx 16rpx;
  border-radius: $radius-sm;
}

.row-unit {
  font-size: 22rpx;
  color: $color-text-muted;
  min-width: 80rpx;
}

.row-tag {
  font-size: 20rpx;
  color: $color-warning;
  background: rgba(224, 159, 62, 0.14);
  padding: 2rpx 10rpx;
  border-radius: 999rpx;
}

.actions {
  margin-top: 24rpx;
}

.btn-reset {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 28rpx;
  color: $color-text;
  background: $color-surface;
  border: 1rpx solid $color-border;
  border-radius: $radius-xl;

  &::after {
    border: none;
  }
}

.page-disclaimer {
  margin-top: 24rpx;
  font-size: 22rpx;
  color: $color-text-faint;
  line-height: 1.6;
}
</style>

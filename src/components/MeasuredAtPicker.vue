<script setup lang="ts">
// 检测时间选择器：日期 picker + 时间 picker
// 默认 = 当前时间；用户可以改为历史任意时间
import { computed, ref, watch } from 'vue';

interface Props {
  /** v-model 绑定的 ISO 字符串 */
  modelValue: string;
}
const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toLocalParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return {
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    };
  }
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

const dateStr = ref(toLocalParts(props.modelValue).date);
const timeStr = ref(toLocalParts(props.modelValue).time);

watch(
  () => props.modelValue,
  (val) => {
    const p = toLocalParts(val);
    dateStr.value = p.date;
    timeStr.value = p.time;
  },
);

const todayStr = computed(() => {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
});

function emitChange() {
  // 把本地日期 + 时间组合为 Date 再转 ISO（保持时区一致）
  const [y, mo, d] = dateStr.value.split('-').map(Number);
  const [h, mi] = timeStr.value.split(':').map(Number);
  const dt = new Date(y, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0, 0, 0);
  emit('update:modelValue', dt.toISOString());
}

function onDateChange(e: { detail: { value: string } }) {
  dateStr.value = e.detail.value;
  emitChange();
}

function onTimeChange(e: { detail: { value: string } }) {
  timeStr.value = e.detail.value;
  emitChange();
}

function setNow() {
  emit('update:modelValue', new Date().toISOString());
}
</script>

<template>
  <view class="mp-picker">
    <text class="mp-label">检测时间</text>
    <view class="mp-fields">
      <picker mode="date" :value="dateStr" :end="todayStr" @change="onDateChange">
        <view class="mp-field">
          <text class="mp-value">{{ dateStr }}</text>
          <text class="mp-arrow">▾</text>
        </view>
      </picker>
      <picker mode="time" :value="timeStr" @change="onTimeChange">
        <view class="mp-field">
          <text class="mp-value">{{ timeStr }}</text>
          <text class="mp-arrow">▾</text>
        </view>
      </picker>
      <view class="mp-now-btn" @click="setNow">现在</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.mp-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-top: 1rpx solid $color-border;
}

.mp-label {
  font-size: 28rpx;
  color: $color-text;
  flex-shrink: 0;
}

.mp-fields {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.mp-field {
  background: $color-bg;
  padding: 8rpx 16rpx;
  border-radius: $radius-sm;
  display: flex;
  align-items: center;
  gap: 4rpx;
}

.mp-value {
  font-size: 24rpx;
  color: $color-text-strong;
}

.mp-arrow {
  font-size: 18rpx;
  color: $color-text-muted;
}

.mp-now-btn {
  font-size: 22rpx;
  color: $color-primary;
  padding: 8rpx 16rpx;
  border: 1rpx solid rgba(42, 141, 127, 0.4);
  border-radius: $radius-sm;
}
</style>

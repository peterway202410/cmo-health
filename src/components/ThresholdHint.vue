<script setup lang="ts">
// 字段右侧的"参考值"标签，点击展开内联编辑器
import { ref } from 'vue';
import { useThresholdsStore } from '@/stores/thresholds';
import { DEFAULT_THRESHOLDS, type Thresholds } from '@/infra/storage/schema';

interface Props {
  /** 参考值字段；多个值用空格分隔，例如 'waist_male_cm waist_female_cm' */
  fields: string;
  /** 文案模板，可用 {字段名} 占位（不传则按 "字段:值" 拼接） */
  template?: (vals: Record<string, number>) => string;
  /** 单位文案（可选） */
  unit?: string;
}

const props = defineProps<Props>();

const tStore = useThresholdsStore();
const expanded = ref(false);

function getValues(): Record<string, number> {
  const obj: Record<string, number> = {};
  props.fields.split(/\s+/).forEach((k) => {
    obj[k] = (tStore.thresholds as unknown as Record<string, number>)[k];
  });
  return obj;
}

function getDefaults(): Record<string, number> {
  const obj: Record<string, number> = {};
  props.fields.split(/\s+/).forEach((k) => {
    obj[k] = (DEFAULT_THRESHOLDS as unknown as Record<string, number>)[k];
  });
  return obj;
}

function setField(key: keyof Thresholds, e: { detail: { value: string } }) {
  const n = Number(e.detail.value);
  if (!Number.isFinite(n)) return;
  tStore.update({ [key]: n } as unknown as Partial<Thresholds>);
}

function reset() {
  const defaults = getDefaults();
  tStore.update(defaults as unknown as Partial<Thresholds>);
}

const fieldLabels: Record<string, string> = {
  bmi_overweight: '超重',
  bmi_obese: '肥胖',
  waist_male_cm: '男',
  waist_female_cm: '女',
  whr_male: '男',
  whr_female: '女',
  bp_sys_mmHg: '收缩压',
  bp_dia_mmHg: '舒张压',
  bp_window_days: '窗口',
  bp_repeated_count: '次数',
  fpg_mmol: '空腹',
  pp2h_mmol: '餐后',
  tg_mmol: 'TG',
  hdl_mmol: 'HDL',
  uric_male: '男',
  uric_female: '女',
};

function defaultText(): string {
  if (props.template) return props.template(getValues());
  const vals = getValues();
  return Object.entries(vals)
    .map(([k, v]) => `${fieldLabels[k] ?? k} ${v}`)
    .join(' / ');
}
</script>

<template>
  <view class="threshold-hint">
    <view class="hint-row" @click="expanded = !expanded">
      <text class="hint-text">参考值：{{ defaultText() }}{{ unit ? ' ' + unit : '' }}</text>
      <text class="hint-toggle">{{ expanded ? '收起' : '修改' }}</text>
    </view>
    <view v-if="expanded" class="hint-edit">
      <view v-for="(val, key) in getValues()" :key="key" class="hint-edit-row">
        <text class="hint-edit-label">{{ fieldLabels[key] ?? key }}</text>
        <input
          class="hint-edit-input"
          type="digit"
          :value="String(val)"
          @blur="(e: any) => setField(key as keyof Thresholds, e)"
        />
        <text v-if="unit" class="hint-edit-unit">{{ unit }}</text>
      </view>
      <view class="hint-edit-actions">
        <text class="hint-reset" @click="reset">恢复默认</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.threshold-hint {
  background: rgba(42, 141, 127, 0.06);
  border-radius: $radius-md;
  padding: 16rpx 20rpx;
  margin-top: 12rpx;
}

.hint-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hint-text {
  font-size: 22rpx;
  color: $color-text-muted;
  flex: 1;
}

.hint-toggle {
  font-size: 22rpx;
  color: $color-primary;
  padding-left: 12rpx;
}

.hint-edit {
  margin-top: 12rpx;
  padding-top: 12rpx;
  border-top: 1rpx dashed rgba(42, 141, 127, 0.2);
}

.hint-edit-row {
  display: flex;
  align-items: center;
  padding: 8rpx 0;
}

.hint-edit-label {
  width: 120rpx;
  font-size: 24rpx;
  color: $color-text-muted;
}

.hint-edit-input {
  flex: 1;
  height: 56rpx;
  padding: 0 16rpx;
  background: $color-surface;
  border: 1rpx solid $color-border;
  border-radius: $radius-sm;
  font-size: 24rpx;
  color: $color-text-strong;
  text-align: right;
}

.hint-edit-unit {
  margin-left: 8rpx;
  font-size: 22rpx;
  color: $color-text-faint;
  min-width: 80rpx;
}

.hint-edit-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8rpx;
}

.hint-reset {
  font-size: 22rpx;
  color: $color-primary;
}
</style>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useQuestionnaireStore } from '@/stores/questionnaire';
import AppTabBar from '@/components/AppTabBar.vue';
import { formatDateTime } from '@/utils/date';

const qStore = useQuestionnaireStore();

interface FormState {
  sleep_hours: number;
  sleep_quality: 1 | 2 | 3 | 4 | 5;
  late_night_per_week: number;
  sugary_drink_per_week: number;
  midnight_snack_per_week: number;
  takeout_per_week: number;
  exercise_per_week: number;
  sedentary_hours_per_day: number;
  alcohol_per_week: number;
  smoking: boolean;
  stress_level: 1 | 2 | 3 | 4 | 5;
}

function defaultForm(): FormState {
  return {
    sleep_hours: 7,
    sleep_quality: 3,
    late_night_per_week: 0,
    sugary_drink_per_week: 0,
    midnight_snack_per_week: 0,
    takeout_per_week: 0,
    exercise_per_week: 3,
    sedentary_hours_per_day: 6,
    alcohol_per_week: 0,
    smoking: false,
    stress_level: 3,
  };
}

const form = reactive<FormState>(defaultForm());
const lastSavedAt = ref<string | null>(null);

function fillFromStore() {
  if (qStore.current) {
    Object.assign(form, qStore.current);
    lastSavedAt.value = qStore.current.created_at;
  } else {
    Object.assign(form, defaultForm());
    lastSavedAt.value = null;
  }
}

onMounted(() => {
  qStore.load();
  fillFromStore();
});

onShow(() => {
  qStore.load();
  fillFromStore();
});

// —— 各类输入辅助 ——

const qualityLabels = ['很差', '较差', '一般', '良好', '很好'];
const stressLabels = ['很轻', '较轻', '一般', '较重', '很重'];

function setRating(field: 'sleep_quality' | 'stress_level', val: 1 | 2 | 3 | 4 | 5) {
  form[field] = val;
}

interface NumericFieldConfig {
  field: keyof FormState;
  min: number;
  max: number;
  step: number;
}

const numericConfig: Record<string, NumericFieldConfig> = {
  sleep_hours: { field: 'sleep_hours', min: 0, max: 14, step: 0.5 },
  late_night_per_week: { field: 'late_night_per_week', min: 0, max: 7, step: 1 },
  sugary_drink_per_week: { field: 'sugary_drink_per_week', min: 0, max: 14, step: 1 },
  midnight_snack_per_week: { field: 'midnight_snack_per_week', min: 0, max: 7, step: 1 },
  takeout_per_week: { field: 'takeout_per_week', min: 0, max: 21, step: 1 },
  exercise_per_week: { field: 'exercise_per_week', min: 0, max: 14, step: 1 },
  sedentary_hours_per_day: { field: 'sedentary_hours_per_day', min: 0, max: 16, step: 1 },
  alcohol_per_week: { field: 'alcohol_per_week', min: 0, max: 14, step: 1 },
};

function step(fieldKey: string, dir: 1 | -1) {
  const cfg = numericConfig[fieldKey];
  if (!cfg) return;
  const cur = form[cfg.field] as number;
  const next = Math.max(cfg.min, Math.min(cfg.max, +(cur + dir * cfg.step).toFixed(2)));
  (form as unknown as Record<string, unknown>)[fieldKey] = next;
}

function onNumInput(fieldKey: string, e: { detail: { value: string } }) {
  const cfg = numericConfig[fieldKey];
  if (!cfg) return;
  const raw = (e?.detail?.value ?? '').toString().trim();
  if (raw === '') return;
  const n = Number(raw);
  if (!Number.isFinite(n)) return;
  const clamped = Math.max(cfg.min, Math.min(cfg.max, n));
  (form as unknown as Record<string, unknown>)[fieldKey] = clamped;
}

// 提交校验
function validate(): string | null {
  for (const k of Object.keys(numericConfig)) {
    const cfg = numericConfig[k];
    const v = form[cfg.field] as number;
    if (!Number.isFinite(v) || v < cfg.min || v > cfg.max) {
      return `字段超出有效范围`;
    }
  }
  return null;
}

function handleSubmit() {
  const err = validate();
  if (err) {
    uni.showToast({ title: err, icon: 'none' });
    return;
  }
  qStore.save({ ...form });
  uni.showToast({ title: '问卷已保存', icon: 'success' });
  lastSavedAt.value = qStore.current?.created_at ?? null;
}

function goBack() {
  uni.navigateBack();
}

// 用于模板里显示
function fmt(v: number, decimals = 0): string {
  return decimals > 0 ? v.toFixed(decimals) : String(Math.round(v));
}
</script>

<template>
  <view class="q-page">
    <view class="q-header">
      <view class="q-title-block">
        <text class="q-title">生活方式问卷</text>
        <text class="q-subtitle">每次提交覆盖上一份，仅保留最新</text>
      </view>
      <text v-if="lastSavedAt" class="q-saved-time">
        上次填写：{{ formatDateTime(lastSavedAt) }}
      </text>
    </view>

    <!-- Section 1: 睡眠 -->
    <view class="q-section">
      <text class="q-section-title">睡眠</text>

      <view class="q-item">
        <text class="q-label">平均睡眠时长</text>
        <view class="q-stepper">
          <view class="q-step-btn" @click="step('sleep_hours', -1)">−</view>
          <input
            class="q-step-input"
            type="digit"
            :value="fmt(form.sleep_hours, 1)"
            @blur="(e: any) => onNumInput('sleep_hours', e)"
          />
          <text class="q-step-unit">小时</text>
          <view class="q-step-btn" @click="step('sleep_hours', 1)">+</view>
        </view>
      </view>

      <view class="q-item">
        <view class="q-item-head">
          <text class="q-label">睡眠质量</text>
          <text class="q-value">{{ qualityLabels[form.sleep_quality - 1] }}</text>
        </view>
        <view class="q-rating">
          <view
            v-for="n in 5"
            :key="n"
            class="q-rating-dot"
            :class="{ active: n <= form.sleep_quality }"
            @click="setRating('sleep_quality', n as 1 | 2 | 3 | 4 | 5)"
          >
            <text class="q-rating-num">{{ n }}</text>
          </view>
        </view>
      </view>

      <view class="q-item">
        <text class="q-label">熬夜频率</text>
        <view class="q-stepper">
          <view class="q-step-btn" @click="step('late_night_per_week', -1)">−</view>
          <input
            class="q-step-input"
            type="number"
            :value="fmt(form.late_night_per_week)"
            @blur="(e: any) => onNumInput('late_night_per_week', e)"
          />
          <text class="q-step-unit">次/周</text>
          <view class="q-step-btn" @click="step('late_night_per_week', 1)">+</view>
        </view>
      </view>
    </view>

    <!-- Section 2: 饮食 -->
    <view class="q-section">
      <text class="q-section-title">饮食习惯</text>

      <view class="q-item">
        <text class="q-label">含糖饮料</text>
        <view class="q-stepper">
          <view class="q-step-btn" @click="step('sugary_drink_per_week', -1)">−</view>
          <input
            class="q-step-input"
            type="number"
            :value="fmt(form.sugary_drink_per_week)"
            @blur="(e: any) => onNumInput('sugary_drink_per_week', e)"
          />
          <text class="q-step-unit">次/周</text>
          <view class="q-step-btn" @click="step('sugary_drink_per_week', 1)">+</view>
        </view>
      </view>

      <view class="q-item">
        <text class="q-label">夜宵频率</text>
        <view class="q-stepper">
          <view class="q-step-btn" @click="step('midnight_snack_per_week', -1)">−</view>
          <input
            class="q-step-input"
            type="number"
            :value="fmt(form.midnight_snack_per_week)"
            @blur="(e: any) => onNumInput('midnight_snack_per_week', e)"
          />
          <text class="q-step-unit">次/周</text>
          <view class="q-step-btn" @click="step('midnight_snack_per_week', 1)">+</view>
        </view>
      </view>

      <view class="q-item">
        <text class="q-label">外卖频率</text>
        <view class="q-stepper">
          <view class="q-step-btn" @click="step('takeout_per_week', -1)">−</view>
          <input
            class="q-step-input"
            type="number"
            :value="fmt(form.takeout_per_week)"
            @blur="(e: any) => onNumInput('takeout_per_week', e)"
          />
          <text class="q-step-unit">次/周</text>
          <view class="q-step-btn" @click="step('takeout_per_week', 1)">+</view>
        </view>
      </view>
    </view>

    <!-- Section 3: 运动与久坐 -->
    <view class="q-section">
      <text class="q-section-title">运动与久坐</text>

      <view class="q-item">
        <text class="q-label">每周运动次数</text>
        <view class="q-stepper">
          <view class="q-step-btn" @click="step('exercise_per_week', -1)">−</view>
          <input
            class="q-step-input"
            type="number"
            :value="fmt(form.exercise_per_week)"
            @blur="(e: any) => onNumInput('exercise_per_week', e)"
          />
          <text class="q-step-unit">次/周</text>
          <view class="q-step-btn" @click="step('exercise_per_week', 1)">+</view>
        </view>
      </view>

      <view class="q-item">
        <text class="q-label">每日久坐时间</text>
        <view class="q-stepper">
          <view class="q-step-btn" @click="step('sedentary_hours_per_day', -1)">−</view>
          <input
            class="q-step-input"
            type="number"
            :value="fmt(form.sedentary_hours_per_day)"
            @blur="(e: any) => onNumInput('sedentary_hours_per_day', e)"
          />
          <text class="q-step-unit">小时/天</text>
          <view class="q-step-btn" @click="step('sedentary_hours_per_day', 1)">+</view>
        </view>
      </view>
    </view>

    <!-- Section 4: 风险因素 -->
    <view class="q-section">
      <text class="q-section-title">风险因素</text>

      <view class="q-item">
        <text class="q-label">饮酒频率</text>
        <view class="q-stepper">
          <view class="q-step-btn" @click="step('alcohol_per_week', -1)">−</view>
          <input
            class="q-step-input"
            type="number"
            :value="fmt(form.alcohol_per_week)"
            @blur="(e: any) => onNumInput('alcohol_per_week', e)"
          />
          <text class="q-step-unit">次/周</text>
          <view class="q-step-btn" @click="step('alcohol_per_week', 1)">+</view>
        </view>
      </view>

      <view class="q-switch-row">
        <text class="q-label">是否吸烟</text>
        <switch
          :checked="form.smoking"
          color="#2a8d7f"
          @change="(e: any) => (form.smoking = e.detail.value)"
        />
      </view>

      <view class="q-item">
        <view class="q-item-head">
          <text class="q-label">压力水平</text>
          <text class="q-value">{{ stressLabels[form.stress_level - 1] }}</text>
        </view>
        <view class="q-rating">
          <view
            v-for="n in 5"
            :key="n"
            class="q-rating-dot"
            :class="{ active: n <= form.stress_level }"
            @click="setRating('stress_level', n as 1 | 2 | 3 | 4 | 5)"
          >
            <text class="q-rating-num">{{ n }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="q-tip">
      <text class="q-tip-text">
        生活方式与代谢风险密切相关。诚实填写有助于评估更准确，所有数据仅保存在本设备。
      </text>
    </view>

    <view class="q-actions">
      <button class="q-primary-btn" @click="handleSubmit">保存问卷</button>
      <button class="q-secondary-btn" @click="goBack">返回</button>
    </view>
    <AppTabBar active="records" />
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.q-page {
  min-height: 100vh;
  width: 100%;
  max-width: $container-max-width;
  margin: 0 auto;
  padding: 32rpx 32rpx 60rpx;
}

.q-header {
  margin-bottom: 24rpx;
}

.q-title-block {
  display: flex;
  flex-direction: column;
}

.q-title {
  font-size: 40rpx;
  font-weight: 700;
  color: $color-text-strong;
}

.q-subtitle {
  font-size: 24rpx;
  color: $color-text-muted;
  margin-top: 6rpx;
}

.q-saved-time {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: $color-text-faint;
}

.q-section {
  background: $color-surface;
  border-radius: $radius-lg;
  padding: 24rpx 32rpx 8rpx;
  box-shadow: $shadow-sm;
  margin-bottom: 24rpx;
}

.q-section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $color-primary;
  display: block;
  margin-bottom: 8rpx;
}

.q-item {
  padding: 20rpx 0;
  border-top: 1rpx solid $color-border;
  display: flex;
  flex-direction: column;
  gap: 12rpx;

  &:first-of-type {
    border-top: none;
  }
}

.q-item-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.q-label {
  font-size: 28rpx;
  color: $color-text;
}

.q-value {
  font-size: 26rpx;
  color: $color-primary;
  font-weight: 600;
}

// —— 步进器 ——

.q-stepper {
  display: flex;
  align-items: center;
  background: $color-bg;
  border-radius: 999rpx;
  padding: 6rpx;
  width: fit-content;
  margin-left: auto;
}

.q-step-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: $color-surface;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  color: $color-primary;
  font-weight: 600;
  user-select: none;
  box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.04);
}

.q-step-btn:active {
  background: $color-primary;
  color: #ffffff;
}

.q-step-input {
  width: 96rpx;
  text-align: center;
  font-size: 30rpx;
  color: $color-text-strong;
  font-weight: 600;
  background: transparent;
  border: none;
}

.q-step-unit {
  font-size: 24rpx;
  color: $color-text-muted;
  padding: 0 16rpx 0 4rpx;
}

// —— 评级圆点 ——

.q-rating {
  display: flex;
  gap: 16rpx;
}

.q-rating-dot {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: $color-bg;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid $color-border;
}

.q-rating-dot.active {
  background: $color-primary;
  border-color: $color-primary;
}

.q-rating-num {
  font-size: 26rpx;
  color: $color-text-muted;
}

.q-rating-dot.active .q-rating-num {
  color: #ffffff;
  font-weight: 600;
}

// —— 开关行 ——

.q-switch-row {
  padding: 24rpx 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1rpx solid $color-border;
}

// —— 提示与按钮 ——

.q-tip {
  background: rgba(42, 141, 127, 0.06);
  border-radius: $radius-md;
  padding: 24rpx 28rpx;
  margin: 8rpx 0 32rpx;
}

.q-tip-text {
  font-size: 24rpx;
  color: $color-text-muted;
  line-height: 1.6;
}

.q-actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.q-primary-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #ffffff;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-light 100%);
  border: none;
  border-radius: $radius-xl;

  &::after {
    border: none;
  }
}

.q-secondary-btn {
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
</style>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useProfileStore } from '@/stores/profile';
import type { Gender, Profile } from '@/infra/storage/schema';
import AppTabBar from '@/components/AppTabBar.vue';

type Activity = NonNullable<Profile['activity']>;

const ACTIVITY_OPTIONS: { value: Activity; label: string }[] = [
  { value: 'sedentary', label: '久坐少动' },
  { value: 'light', label: '轻度活动' },
  { value: 'moderate', label: '中度活动' },
  { value: 'active', label: '高强度活动' },
  { value: 'very_active', label: '极高强度' },
];

const profileStore = useProfileStore();

const form = reactive({
  birth_date: profileStore.profile?.birth_date ?? '1990-01-01',
  gender: (profileStore.profile?.gender ?? 'male') as Gender,
  height_cm: profileStore.profile?.height_cm ?? 170,
  has_hypertension: profileStore.profile?.has_hypertension ?? false,
  has_diabetes: profileStore.profile?.has_diabetes ?? false,
  has_hypercholesterolemia: profileStore.profile?.has_hypercholesterolemia ?? false,
  has_hyperuricemia: profileStore.profile?.has_hyperuricemia ?? false,
  has_fatty_liver: profileStore.profile?.has_fatty_liver ?? false,
  has_carotid_plaque: profileStore.profile?.has_carotid_plaque ?? false,
  has_stroke_history: profileStore.profile?.has_stroke_history ?? false,
  has_family_metabolic_history: profileStore.profile?.has_family_metabolic_history ?? false,
  activity: (profileStore.profile?.activity ?? 'light') as Activity,
});

import { computed } from 'vue';

const activityIndex = computed(() =>
  Math.max(0, ACTIVITY_OPTIONS.findIndex((o) => o.value === form.activity)),
);

function onActivityChange(e: { detail: { value: number | string } }) {
  const idx = Number(e.detail.value);
  if (Number.isFinite(idx) && ACTIVITY_OPTIONS[idx]) {
    form.activity = ACTIVITY_OPTIONS[idx].value;
  }
}

function activityLabel(v: Activity): string {
  return ACTIVITY_OPTIONS.find((o) => o.value === v)?.label ?? '—';
}

const errorMsg = ref<string>('');

function onPickDate(e: { detail: { value: string } }) {
  form.birth_date = e.detail.value;
}

function selectGender(g: Gender) {
  form.gender = g;
}

function onHeightInput(e: { detail: { value: string } }) {
  const n = Number(e.detail.value);
  form.height_cm = Number.isFinite(n) ? n : 0;
}

function validate(): string | null {
  if (!form.birth_date) return '请选择出生日期';
  const age = new Date().getFullYear() - new Date(form.birth_date).getFullYear();
  if (age > 120 || age < 0) return '出生日期不在合理范围';
  if (!form.height_cm || form.height_cm < 50 || form.height_cm > 250) {
    return '身高应在 50–250 cm 之间';
  }
  return null;
}

function handleSubmit() {
  const err = validate();
  if (err) {
    errorMsg.value = err;
    uni.showToast({ title: err, icon: 'none' });
    return;
  }
  errorMsg.value = '';
  profileStore.save({
    birth_date: form.birth_date,
    gender: form.gender,
    height_cm: form.height_cm,
    has_hypertension: form.has_hypertension,
    has_diabetes: form.has_diabetes,
    has_hypercholesterolemia: form.has_hypercholesterolemia,
    has_hyperuricemia: form.has_hyperuricemia,
    has_fatty_liver: form.has_fatty_liver,
    has_carotid_plaque: form.has_carotid_plaque,
    has_stroke_history: form.has_stroke_history,
    has_family_metabolic_history: form.has_family_metabolic_history,
    activity: form.activity,
  });
  uni.showToast({ title: '已保存', icon: 'success' });
  setTimeout(() => {
    uni.reLaunch({ url: '/pages/home/home' });
  }, 600);
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">基础档案</text>
      <text class="subtitle">这些信息只保存在你的设备上</text>
    </view>

    <view class="form">
      <view class="field">
        <text class="label">出生日期</text>
        <picker mode="date" :value="form.birth_date" @change="onPickDate">
          <view class="value-row">
            <text class="value">{{ form.birth_date }}</text>
            <text class="arrow">›</text>
          </view>
        </picker>
      </view>

      <view class="field">
        <text class="label">性别</text>
        <view class="segment">
          <view
            class="segment-item"
            :class="{ active: form.gender === 'male' }"
            @click="selectGender('male')"
          >
            男
          </view>
          <view
            class="segment-item"
            :class="{ active: form.gender === 'female' }"
            @click="selectGender('female')"
          >
            女
          </view>
        </view>
      </view>

      <view class="field">
        <text class="label">身高</text>
        <view class="value-row">
          <input
            class="input"
            type="number"
            :value="form.height_cm"
            @input="onHeightInput"
            placeholder="cm"
          />
          <text class="unit">cm</text>
        </view>
      </view>

      <view class="field">
        <text class="label">活动水平</text>
        <picker
          mode="selector"
          :range="ACTIVITY_OPTIONS"
          range-key="label"
          :value="activityIndex"
          @change="onActivityChange"
        >
          <view class="value-row">
            <text class="value">{{ activityLabel(form.activity) }}</text>
            <text class="arrow">›</text>
          </view>
        </picker>
      </view>

      <view class="field-switch">
        <text class="label">已确诊高血压</text>
        <switch :checked="form.has_hypertension" color="#2a8d7f" @change="(e: any) => (form.has_hypertension = e.detail.value)" />
      </view>

      <view class="field-switch">
        <text class="label">已确诊糖尿病</text>
        <switch :checked="form.has_diabetes" color="#2a8d7f" @change="(e: any) => (form.has_diabetes = e.detail.value)" />
      </view>

      <view class="field-switch">
        <text class="label">已确诊高胆固醇血症</text>
        <switch :checked="form.has_hypercholesterolemia" color="#2a8d7f" @change="(e: any) => (form.has_hypercholesterolemia = e.detail.value)" />
      </view>

      <view class="field-switch">
        <text class="label">已确诊高尿酸血症</text>
        <switch :checked="form.has_hyperuricemia" color="#2a8d7f" @change="(e: any) => (form.has_hyperuricemia = e.detail.value)" />
      </view>

      <view class="field-switch">
        <text class="label">已确诊脂肪肝</text>
        <switch :checked="form.has_fatty_liver" color="#2a8d7f" @change="(e: any) => (form.has_fatty_liver = e.detail.value)" />
      </view>

      <view class="field-switch">
        <text class="label">已确诊颈动脉斑块</text>
        <switch :checked="form.has_carotid_plaque" color="#2a8d7f" @change="(e: any) => (form.has_carotid_plaque = e.detail.value)" />
      </view>

      <view class="field-switch">
        <text class="label">有中风病史</text>
        <switch :checked="form.has_stroke_history" color="#2a8d7f" @change="(e: any) => (form.has_stroke_history = e.detail.value)" />
      </view>

      <view class="field-switch">
        <text class="label">有家族代谢综合征相关疾病史</text>
        <switch :checked="form.has_family_metabolic_history" color="#2a8d7f" @change="(e: any) => (form.has_family_metabolic_history = e.detail.value)" />
      </view>
    </view>

    <view class="actions">
      <button class="primary-btn" @click="handleSubmit">保存并进入首页</button>
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
  padding: 48rpx 32rpx 80rpx;
}

.header {
  margin-bottom: 40rpx;
}

.title {
  font-size: 44rpx;
  font-weight: 700;
  color: $color-text-strong;
  display: block;
}

.subtitle {
  font-size: 24rpx;
  color: $color-text-muted;
  margin-top: 8rpx;
  display: block;
}

.form {
  background: $color-surface;
  border-radius: $radius-lg;
  padding: 8rpx 32rpx;
  box-shadow: $shadow-md;
}

.field,
.field-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 0;
  border-bottom: 1rpx solid $color-border;
  &:last-child {
    border-bottom: none;
  }
}

.label {
  font-size: 28rpx;
  color: $color-text;
}

.value-row {
  display: flex;
  align-items: center;
}

.value {
  font-size: 28rpx;
  color: $color-text-strong;
  margin-right: 8rpx;
}

.arrow {
  font-size: 32rpx;
  color: $color-text-faint;
}

.input {
  width: 160rpx;
  text-align: right;
  font-size: 28rpx;
  color: $color-text-strong;
}

.unit {
  margin-left: 8rpx;
  font-size: 26rpx;
  color: $color-text-muted;
}

.segment {
  display: flex;
  background: $color-bg;
  border-radius: $radius-md;
  padding: 4rpx;
}

.segment-item {
  padding: 12rpx 36rpx;
  font-size: 26rpx;
  color: $color-text-muted;
  border-radius: $radius-sm;
}

.segment-item.active {
  background: $color-primary;
  color: #ffffff;
  font-weight: 600;
}

.actions {
  margin-top: 60rpx;
}

.primary-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #ffffff;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-light 100%);
  border: none;
  border-radius: $radius-xl;
}

.primary-btn::after {
  border: none;
}
</style>

<script setup lang="ts">
function handleStart() {
  // 进入档案录入；填完后会跳到首页 tab
  uni.navigateTo({ url: '/pages/profile/profile' });
}
</script>

<template>
  <view class="welcome">
    <view class="hero">
      <view class="brand">
        <text class="brand-mark">CMO</text>
      </view>
      <text class="title">首席代谢官</text>
      <text class="subtitle">Chief Metabolic Officer</text>
    </view>

    <view class="intro-card">
      <text class="intro">
        首席代谢官是一个记录个体血压、血糖等健康数据，并通过这些数据评估代谢状况、给出改善建议的工具。
      </text>
      <view class="features">
        <view class="feature">
          <text class="feature-dot">·</text>
          <text class="feature-text">记录血压、血糖、血脂、体重等关键指标</text>
        </view>
        <view class="feature">
          <text class="feature-dot">·</text>
          <text class="feature-text">基于权威标准评估代谢风险与代谢年龄</text>
        </view>
        <view class="feature">
          <text class="feature-dot">·</text>
          <text class="feature-text">数据完全本地，可随时导入导出备份</text>
        </view>
      </view>
    </view>

    <view class="actions">
      <button class="primary-btn" @click="handleStart">开始</button>
      <text class="hint">下一步：填写基础信息 → 健康问卷 → 录入指标</text>
    </view>

    <text class="disclaimer">本应用仅用于个人代谢健康参考，不构成医疗诊断或用药建议。</text>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.welcome {
  min-height: 100vh;
  width: 100%;
  max-width: $container-max-width;
  margin: 0 auto;
  padding: 120rpx 48rpx 60rpx;
  background: linear-gradient(180deg, #eaf6f4 0%, #f6f7f9 60%);
  display: flex;
  flex-direction: column;
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 64rpx;
}

.brand {
  width: 128rpx;
  height: 128rpx;
  border-radius: 32rpx;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-light 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 32rpx;
  box-shadow: 0 16rpx 40rpx rgba(42, 141, 127, 0.25);
}

.brand-mark {
  color: #ffffff;
  font-size: 44rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.title {
  font-size: 56rpx;
  font-weight: 700;
  color: $color-text-strong;
  letter-spacing: 2rpx;
}

.subtitle {
  font-size: 24rpx;
  color: $color-text-muted;
  margin-top: 8rpx;
  letter-spacing: 1rpx;
}

.intro-card {
  background: $color-surface;
  border-radius: $radius-lg;
  padding: 40rpx 36rpx;
  box-shadow: $shadow-md;
  margin-bottom: 64rpx;
}

.intro {
  font-size: 28rpx;
  color: $color-text;
  line-height: 1.7;
  display: block;
}

.features {
  margin-top: 28rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid $color-border;
}

.feature {
  display: flex;
  align-items: flex-start;
  margin-top: 14rpx;
  &:first-child {
    margin-top: 0;
  }
}

.feature-dot {
  color: $color-primary;
  font-size: 36rpx;
  line-height: 1;
  margin-right: 12rpx;
  margin-top: -2rpx;
}

.feature-text {
  font-size: 26rpx;
  color: $color-text-muted;
  flex: 1;
}

.actions {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.primary-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: #ffffff;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-light 100%);
  border: none;
  border-radius: $radius-xl;
  box-shadow: 0 12rpx 24rpx rgba(42, 141, 127, 0.25);
  letter-spacing: 8rpx;
}

.primary-btn::after {
  border: none;
}

.hint {
  font-size: 24rpx;
  color: $color-text-faint;
  margin-top: 24rpx;
}

.disclaimer {
  font-size: 22rpx;
  color: $color-text-faint;
  text-align: center;
  margin-top: 40rpx;
  line-height: 1.6;
}
</style>

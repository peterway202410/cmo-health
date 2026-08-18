<script setup lang="ts">
import AppTabBar from '@/components/AppTabBar.vue';
</script>

<template>
  <view class="page">
    <view class="container">
      <!-- Logo + 名称 -->
      <view class="brand">
        <view class="brand-icon">
          <text class="brand-mark">CMO</text>
        </view>
        <text class="brand-name">首席代谢官</text>
        <text class="brand-version">v0.1.0</text>
      </view>

      <!-- 产品介绍 -->
      <view class="section">
        <text class="section-title">产品介绍</text>
        <text class="section-text">
          「首席代谢官」聚焦个人代谢与血管风险管理，支持用户长期记录体重、腰围、血压、血糖、血脂、尿酸等健康数据，并基于多维风险模型进行动态评估与趋势分析，帮助用户更直观地了解自身健康风险变化。
        </text>
      </view>

      <!-- 健元平台 -->
      <view class="section">
        <text class="section-title">健元健康管理平台</text>
        <text class="section-text">
          「首席代谢官」是「健元」健康管理平台的个人版（2C 版）产品。
        </text>
        <text class="section-text">
          「健元」面向健康产业从业者，提供客户健康数据存储、风险评估、健康档案管理、评估报告生成及干预方案制定等功能，帮助健康管理师持续跟踪、维护与管理客户健康状态。
        </text>
        <text class="section-text qr-hint">详情可扫码咨询：</text>
        <view class="qr-wrap">
          <image
            class="qr-img"
            src="/static/qrcode-jianyuan.png"
            mode="aspectFit"
          />
        </view>
      </view>

      <!-- 版权声明 -->
      <view class="section copyright">
        <text class="section-title">开源与版权</text>
        <text class="section-text">
          「首席代谢官」由常来常往工作室创意、研发与维护，以 GNU GPL v3 协议开源。
        </text>
        <text class="section-text">
          你可以自由使用、研究、修改和再分发本软件。若对外发布修改版本，须同样以 GPL v3 开源，并保留版权声明。源码：github.com/peterway202410/cmo-health
        </text>
      </view>

      <!-- 免责 -->
      <view class="disclaimer">
        <text class="disclaimer-text">
          本应用仅用于个人代谢健康参考，不构成医疗诊断、治疗或用药建议。所有数据保存在您的设备本地，不上传任何服务器。
        </text>
      </view>

      <view class="footer">
        <text class="footer-text">© 2025 常来常往工作室</text>
      </view>
    </view>
    <AppTabBar active="my" />
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.page {
  min-height: 100vh;
  padding: 32rpx 0 60rpx;
}

.container {
  width: 100%;
  max-width: $container-max-width;
  margin: 0 auto;
  padding: 0 32rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

// —— 品牌 ——

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx 0 20rpx;
}

.brand-icon {
  width: 120rpx;
  height: 120rpx;
  border-radius: 28rpx;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-light 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
  box-shadow: 0 12rpx 32rpx rgba(42, 141, 127, 0.25);
}

.brand-mark {
  color: #ffffff;
  font-size: 40rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.brand-name {
  font-size: 40rpx;
  font-weight: 700;
  color: $color-text-strong;
  letter-spacing: 2rpx;
}

.brand-version {
  font-size: 22rpx;
  color: $color-text-faint;
  margin-top: 8rpx;
}

// —— 段落 ——

.section {
  background: $color-surface;
  border-radius: $radius-lg;
  padding: 28rpx 32rpx;
  box-shadow: $shadow-sm;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $color-text-strong;
}

.section-text {
  font-size: 26rpx;
  color: $color-text;
  line-height: 1.8;
}

.qr-hint {
  margin-top: 8rpx;
  color: $color-text-muted;
}

.qr-wrap {
  display: flex;
  justify-content: center;
  margin-top: 12rpx;
}

.qr-img {
  width: 360rpx;
  height: 360rpx;
  border-radius: $radius-md;
}

// —— 版权 ——

.copyright {
  border-left: 6rpx solid $color-text-faint;
}

// —— 免责 ——

.disclaimer {
  background: rgba(42, 141, 127, 0.06);
  border-radius: $radius-md;
  padding: 20rpx 24rpx;
}

.disclaimer-text {
  font-size: 22rpx;
  color: $color-text-muted;
  line-height: 1.7;
}

// —— 底部 ——

.footer {
  text-align: center;
  padding: 24rpx 0;
}

.footer-text {
  font-size: 22rpx;
  color: $color-text-faint;
}
</style>

<script setup lang="ts">
// 公共底部菜单：所有页面统一使用，禁用系统 tabBar 以保证三端图标一致

interface Props {
  /** 当前激活的 tab，不传则不高亮 */
  active?: 'home' | 'records' | 'analysis' | 'my' | '';
}

withDefaults(defineProps<Props>(), { active: '' });

const items = [
  { key: 'home', label: '首页', path: '/pages/home/home', icon: '🏠' },
  { key: 'records', label: '记录', path: '/pages/records/records', icon: '📋' },
  { key: 'analysis', label: '评估', path: '/pages/analysis/analysis', icon: '📊' },
  { key: 'my', label: '我的', path: '/pages/my/my', icon: '👤' },
] as const;

function go(item: (typeof items)[number]) {
  // reLaunch 关闭所有页面再打开目标页，避免页面栈无限累积
  uni.reLaunch({ url: item.path });
}
</script>

<template>
  <view class="app-tabbar-wrap">
    <view class="app-tabbar">
      <view
        v-for="item in items"
        :key="item.key"
        class="app-tabbar-item"
        :class="{ active: item.key === active }"
        @click="go(item)"
      >
        <text class="app-tabbar-icon">{{ item.icon }}</text>
        <text class="app-tabbar-label">{{ item.label }}</text>
      </view>
    </view>
    <!-- 占位元素，避免内容被 fixed 底栏遮挡 -->
    <view class="app-tabbar-spacer" />
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.app-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: $color-surface;
  display: flex;
  /* 与内容区同宽，居中 */
  width: 100%;
  max-width: 720rpx;
  margin: 0 auto;
  border-top: 1rpx solid $color-border;
  border-radius: 24rpx 24rpx 0 0;
  box-shadow: 0 -8rpx 24rpx rgba(20, 30, 50, 0.06);
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 100;
}

.app-tabbar-item {
  flex: 1;
  padding: 12rpx 0 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: $color-text-muted;
}

.app-tabbar-item.active {
  color: $color-primary;
}

.app-tabbar-icon {
  font-size: 36rpx;
  line-height: 1;
  margin-bottom: 4rpx;
  filter: grayscale(0.4);
}

.app-tabbar-item.active .app-tabbar-icon {
  filter: none;
}

.app-tabbar-label {
  font-size: 22rpx;
  line-height: 1.2;
}

.app-tabbar-spacer {
  height: calc(100rpx + env(safe-area-inset-bottom));
}
</style>

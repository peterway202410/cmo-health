<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app';
import { useProfileStore } from './stores/profile';

onLaunch(() => {
  const profileStore = useProfileStore();
  profileStore.load();
  // 未填基础档案 → 跳到欢迎页（reLaunch 到非 tab 页）
  if (!profileStore.isInitialized) {
    uni.reLaunch({ url: '/pages/welcome/welcome' });
  }
});
</script>

<style lang="scss">
@import './styles/variables.scss';
@import './styles/base.scss';
</style>

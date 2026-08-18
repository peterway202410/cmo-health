<script setup lang="ts">
import AppTabBar from '@/components/AppTabBar.vue';
import { exportToJSON, defaultExportFilename } from '@/infra/backup/exporter';
import { saveTextFile } from '@/infra/backup/download';
import { pickJsonFile } from '@/infra/backup/pickFile';
import { importFromText } from '@/infra/backup/importer';
import { useProfileStore } from '@/stores/profile';
import { useMetricsStore } from '@/stores/metrics';
import { useQuestionnaireStore } from '@/stores/questionnaire';
import { useThresholdsStore } from '@/stores/thresholds';
import { useAssessmentStore } from '@/stores/assessment';
import { storage } from '@/infra/storage/StorageAdapter';

function goProfile() {
  uni.navigateTo({ url: '/pages/profile/profile' });
}

function goThresholds() {
  uni.navigateTo({ url: '/pages/settings/thresholds/thresholds' });
}

function goAbout() {
  uni.navigateTo({ url: '/pages/about/about' });
}

async function exportData() {
  try {
    const data = exportToJSON();
    const json = JSON.stringify(data, null, 2);
    const filename = defaultExportFilename();
    await saveTextFile(filename, json);
    uni.showToast({ title: '已导出', icon: 'success' });
  } catch (e) {
    console.error('[export] failed', e);
    uni.showToast({ title: '导出失败', icon: 'none' });
  }
}

function reloadAllStores() {
  useProfileStore().load();
  useMetricsStore().load();
  useQuestionnaireStore().load();
  useThresholdsStore().load();
  useAssessmentStore().recompute();
}

async function importData() {
  const strategy = await new Promise<'merge' | 'overwrite' | null>((resolve) => {
    uni.showActionSheet({
      itemList: ['合并去重（推荐）', '完全覆盖（清空后写入）'],
      success: ({ tapIndex }) => {
        if (tapIndex === 0) resolve('merge');
        else if (tapIndex === 1) resolve('overwrite');
        else resolve(null);
      },
      fail: () => resolve(null),
    });
  });
  if (!strategy) return;

  if (strategy === 'overwrite') {
    const confirmed = await new Promise<boolean>((resolve) => {
      uni.showModal({
        title: '确认完全覆盖？',
        content: '将清空当前全部数据再写入备份文件，无法恢复。',
        confirmText: '继续',
        confirmColor: '#d4584a',
        success: ({ confirm }) => resolve(!!confirm),
        fail: () => resolve(false),
      });
    });
    if (!confirmed) return;
  }

  let text: string;
  try {
    text = await pickJsonFile();
  } catch (e) {
    if ((e as Error).message !== 'cancelled') {
      uni.showToast({ title: '选择文件失败', icon: 'none' });
    }
    return;
  }

  const result = importFromText(text, strategy);
  if (!result.ok) {
    uni.showModal({
      title: '导入失败',
      content: result.errors.join('\n') || '未知错误',
      showCancel: false,
    });
    return;
  }

  reloadAllStores();
  const counts = result.applied?.metricsCount ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  uni.showToast({
    title: `已导入（共 ${total} 条指标）`,
    icon: 'success',
    duration: 2000,
  });
}

async function clearAll() {
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '确认清空',
      content: '将清除全部本地数据，包括基础档案、健康指标、问卷、参考值。无法恢复。',
      confirmText: '清空',
      confirmColor: '#d4584a',
      success: ({ confirm }) => resolve(!!confirm),
      fail: () => resolve(false),
    });
  });
  if (!confirmed) return;

  const reConfirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '再次确认',
      content: '操作不可撤销。建议先「导出数据」备份。',
      confirmText: '我已备份',
      confirmColor: '#d4584a',
      success: ({ confirm }) => resolve(!!confirm),
      fail: () => resolve(false),
    });
  });
  if (!reConfirmed) return;

  storage.clearAllByPrefix('cmo:');
  reloadAllStores();
  uni.showToast({ title: '已清空', icon: 'success' });

  setTimeout(() => {
    uni.reLaunch({ url: '/pages/welcome/welcome' });
  }, 800);
}
</script>

<template>
  <view class="page">
    <view class="group">
      <view class="group-title">个人</view>
      <view class="cell" @click="goProfile">
        <text class="cell-label">基础档案</text>
        <text class="cell-arrow">›</text>
      </view>
      <view class="cell" @click="goThresholds">
        <text class="cell-label">参考值设置</text>
        <text class="cell-arrow">›</text>
      </view>
    </view>

    <view class="group">
      <view class="group-title">数据</view>
      <view class="cell" @click="exportData">
        <text class="cell-label">导出数据</text>
        <text class="cell-arrow">›</text>
      </view>
      <view class="cell" @click="importData">
        <text class="cell-label">导入数据</text>
        <text class="cell-arrow">›</text>
      </view>
      <view class="cell danger" @click="clearAll">
        <text class="cell-label">清空全部数据</text>
        <text class="cell-arrow">›</text>
      </view>
    </view>

    <view class="group">
      <view class="group-title">关于</view>
      <view class="cell" @click="goAbout">
        <text class="cell-label">关于首席代谢官</text>
        <text class="cell-arrow">›</text>
      </view>
      <view class="cell">
        <text class="cell-label">版本</text>
        <text class="cell-value">v0.1.0</text>
      </view>
      <view class="about-text">
        本应用仅用于个人代谢健康参考，不构成医疗诊断、治疗或用药建议。所有数据保存在你的设备本地，不上传任何服务器。
      </view>
    </view>
    <AppTabBar active="my" />
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.page {
  min-height: 100vh;
  width: 100%;
  max-width: $container-max-width;
  margin: 0 auto;
  padding: 24rpx 32rpx 80rpx;
}

.group {
  background: $color-surface;
  border-radius: $radius-lg;
  margin-bottom: 32rpx;
  overflow: hidden;
}

.group-title {
  padding: 24rpx 32rpx 12rpx;
  font-size: 24rpx;
  color: $color-text-muted;
}

.cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  border-top: 1rpx solid $color-border;
}

.cell-label {
  font-size: 28rpx;
  color: $color-text;
}

.cell.danger .cell-label {
  color: $color-danger;
}

.cell-arrow {
  font-size: 32rpx;
  color: $color-text-faint;
}

.cell-value {
  font-size: 26rpx;
  color: $color-text-muted;
}

.about-text {
  padding: 24rpx 32rpx 32rpx;
  font-size: 24rpx;
  color: $color-text-muted;
  line-height: 1.7;
  border-top: 1rpx solid $color-border;
}
</style>

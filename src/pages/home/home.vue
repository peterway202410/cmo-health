<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useProfileStore } from '@/stores/profile';
import { useMetricsStore } from '@/stores/metrics';
import { useQuestionnaireStore } from '@/stores/questionnaire';
import { useThresholdsStore } from '@/stores/thresholds';
import { computeBMI, classifyBMI } from '@/domain/assessment/bmi';
import { computeComprehensive } from '@/domain/comprehensive';
import { formatDateTime, nowIso } from '@/utils/date';
import AppTabBar from '@/components/AppTabBar.vue';

const profileStore = useProfileStore();
const metricsStore = useMetricsStore();
const qStore = useQuestionnaireStore();
const tStore = useThresholdsStore();

function refresh() {
  profileStore.load();
  metricsStore.load();
  qStore.load();
  tStore.load();
}

onMounted(refresh);
onShow(refresh);

// —— 派生 UI 状态 ——

// 是否处于"无数据空状态"
const isEmptyState = computed(() => metricsStore.totalCount === 0);

const result = computed(() => {
  const profile = profileStore.profile;
  if (!profile) return null;
  return computeComprehensive({
    profile,
    bp: metricsStore.bp,
    glucose: metricsStore.glucose,
    lipid: metricsStore.lipid,
    uric: metricsStore.uric,
    weight: metricsStore.weight,
    questionnaire: qStore.current,
    thresholds: tStore.thresholds,
    now: nowIso(),
  });
});

const scoreText = computed<string>(() => {
  const r = result.value;
  if (!r || r.mode === 'unavailable') return '--';
  return String(r.score);
});

const isReferenceMode = computed(() => result.value?.mode === 'reference');
const coverageText = computed(() => {
  if (!result.value) return '';
  return `数据完整度 ${Math.round(result.value.coverage * 100)}%`;
});

const offsetText = computed(() => {
  const r = result.value;
  if (!r || r.mode === 'unavailable') return '';
  const o = r.riskOffsetYears;
  if (o === 0) return '与同龄人代谢风险相当';
  if (o > 0) return `代谢风险相当于 +${o} 岁`;
  return `代谢风险优于同龄 (${o} 岁)`;
});

const cardLevelClass = computed(() => {
  const c = result.value?.levelInfo.color;
  if (c === 'warn') return 'level-warn';
  if (c === 'bad') return 'level-bad';
  return 'level-good';
});

// 最新数据卡片：每个指标带 status (good/warn/bad) + hint（一句话解读）
type ItemStatus = 'good' | 'warn' | 'bad';

interface LatestItem {
  label: string;
  value: string;
  unit: string;
  time: string;
  status: ItemStatus;
  hint: string;
}

const latestItems = computed<LatestItem[]>(() => {
  const items: LatestItem[] = [];
  const t = tStore.thresholds;
  const isMale = profileStore.profile?.gender !== 'female';
  const height = profileStore.profile?.height_cm ?? 0;

  // —— 体重（按 BMI 评色）——
  const weightRec = [...metricsStore.weight].reverse().find((r) => r.weight_kg != null);
  if (weightRec?.weight_kg != null && height > 0) {
    const bmi = computeBMI(weightRec.weight_kg, height);
    const level = classifyBMI(bmi, t);
    let status: ItemStatus = 'good';
    let hint = `BMI ${bmi.toFixed(1)}，体重正常`;
    if (level === 'overweight') {
      status = 'warn';
      hint = `BMI ${bmi.toFixed(1)}，体重偏高`;
    } else if (level === 'obese') {
      status = 'bad';
      hint = `BMI ${bmi.toFixed(1)}，已属肥胖`;
    }
    items.push({
      label: '体重',
      value: weightRec.weight_kg.toFixed(1),
      unit: 'kg',
      time: formatDateTime(weightRec.created_at),
      status,
      hint,
    });
  }

  // —— 血压（用评估引擎的窗口判定结果，与代谢综合征逻辑一致）——
  if (metricsStore.latestBP) {
    const last = metricsStore.latestBP;
    // 优先看代谢综合征 hypertension 项的判定结果
    const metsHyp = assessmentStore.result?.metsResult.items.find(
      (it) => it.key === 'hypertension',
    );
    let status: ItemStatus = 'good';
    let hint = `本次 ${last.systolic_mmHg}/${last.diastolic_mmHg}，正常`;
    if (metsHyp?.matched) {
      status = 'bad';
      hint =
        metsHyp.source === 'diagnosed'
          ? '已确诊高血压，请遵医嘱'
          : `近 ${t.bp_window_days} 天反复偏高`;
    } else if (
      last.systolic_mmHg >= t.bp_sys_mmHg ||
      last.diastolic_mmHg >= t.bp_dia_mmHg
    ) {
      status = 'warn';
      hint = '本次偏高，建议持续监测';
    }
    items.push({
      label: '血压',
      value: `${last.systolic_mmHg}/${last.diastolic_mmHg}`,
      unit: 'mmHg',
      time: formatDateTime(last.created_at),
      status,
      hint,
    });
  }

  // —— 血糖（显示最近一条记录中的值，优先空腹 > 餐后 > HbA1c）——
  if (metricsStore.glucose.length > 0) {
    const lastGlucose = metricsStore.glucose[metricsStore.glucose.length - 1];
    let label = '血糖';
    let value = '';
    let unit = 'mmol/L';
    let v = 0;

    if (lastGlucose.fpg_mmol_per_l != null) {
      v = lastGlucose.fpg_mmol_per_l;
      value = v.toFixed(1);
      label = '血糖（空腹）';
    } else if (lastGlucose.pp2h_mmol_per_l != null) {
      v = lastGlucose.pp2h_mmol_per_l;
      value = v.toFixed(1);
      label = '血糖（餐后2h）';
    } else if (lastGlucose.hba1c_pct != null) {
      v = lastGlucose.hba1c_pct;
      value = v.toFixed(1);
      label = '血糖（HbA1c）';
      unit = '%';
    }

    if (value) {
      let status: ItemStatus = 'good';
      let hint = '血糖正常';
      if (label.includes('空腹')) {
        if (v >= 7.0) { status = 'bad'; hint = '空腹血糖超过糖尿病诊断线'; }
        else if (v >= t.fpg_mmol) { status = 'warn'; hint = '空腹血糖偏高'; }
      } else if (label.includes('餐后')) {
        if (v >= 11.1) { status = 'bad'; hint = '餐后血糖超过糖尿病诊断线'; }
        else if (v >= 7.8) { status = 'warn'; hint = '餐后血糖偏高（糖耐量减低）'; }
      } else if (label.includes('HbA1c')) {
        if (v >= 6.5) { status = 'bad'; hint = 'HbA1c 达到糖尿病标准'; }
        else if (v >= 5.7) { status = 'warn'; hint = 'HbA1c 偏高（糖尿病前期）'; }
      }
      if (profileStore.profile?.has_diabetes) {
        status = status === 'good' ? 'warn' : status;
        hint = '已确诊糖尿病，请遵医嘱';
      }
      items.push({
        label,
        value,
        unit,
        time: formatDateTime(lastGlucose.created_at),
        status,
        hint,
      });
    }
  }

  // —— 血脂（显示最近一条记录中的值，优先 TG > HDL > LDL > TC）——
  if (metricsStore.lipid.length > 0) {
    const lastLipid = metricsStore.lipid[metricsStore.lipid.length - 1];
    let label = '血脂';
    let value = '';
    let unit = 'mmol/L';
    let v = 0;

    if (lastLipid.tg_mmol_per_l != null) {
      v = lastLipid.tg_mmol_per_l;
      value = v.toFixed(2);
      label = '血脂（TG）';
    } else if (lastLipid.hdl_mmol_per_l != null) {
      v = lastLipid.hdl_mmol_per_l;
      value = v.toFixed(2);
      label = '血脂（HDL）';
    } else if (lastLipid.ldl_mmol_per_l != null) {
      v = lastLipid.ldl_mmol_per_l;
      value = v.toFixed(2);
      label = '血脂（LDL）';
    } else if (lastLipid.tc_mmol_per_l != null) {
      v = lastLipid.tc_mmol_per_l;
      value = v.toFixed(2);
      label = '血脂（TC）';
    }

    if (value) {
      let status: ItemStatus = 'good';
      let hint = '血脂正常';
      if (label.includes('TG')) {
        if (v >= 2.3) { status = 'bad'; hint = '甘油三酯明显偏高'; }
        else if (v >= t.tg_mmol) { status = 'warn'; hint = '甘油三酯偏高'; }
      } else if (label.includes('HDL')) {
        if (v < 0.9) { status = 'bad'; hint = 'HDL 明显偏低'; }
        else if (v < t.hdl_mmol) { status = 'warn'; hint = 'HDL 偏低'; }
      } else if (label.includes('LDL')) {
        if (v >= 4.1) { status = 'bad'; hint = 'LDL 升高'; }
        else if (v >= 3.4) { status = 'warn'; hint = 'LDL 边缘升高'; }
      } else if (label.includes('TC')) {
        if (v >= 6.2) { status = 'bad'; hint = '总胆固醇升高'; }
        else if (v >= 5.2) { status = 'warn'; hint = '总胆固醇边缘升高'; }
      }
      items.push({
        label,
        value,
        unit,
        time: formatDateTime(lastLipid.created_at),
        status,
        hint,
      });
    }
  }

  // —— 尿酸 ——
  if (metricsStore.uric.length) {
    const last = metricsStore.uric[metricsStore.uric.length - 1];
    const v = last.uric_umol_per_l;
    const baseT = isMale ? t.uric_male : t.uric_female;
    let status: ItemStatus = 'good';
    let hint = '尿酸正常';
    if (v > baseT * 1.2) {
      status = 'bad';
      hint = '尿酸明显偏高，注意饮食并复查';
    } else if (v > baseT) {
      status = 'warn';
      hint = '尿酸偏高';
    }
    items.push({
      label: '尿酸',
      value: String(v),
      unit: 'μmol/L',
      time: formatDateTime(last.created_at),
      status,
      hint,
    });
  }

  return items;
});

// —— 交互 ——

function goRecords() {
  uni.reLaunch({ url: '/pages/records/records' });
}

function goAnalysis() {
  uni.reLaunch({ url: '/pages/analysis/analysis' });
}
</script>

<template>
  <view class="home">
    <!-- 顶部栏 -->
    <view class="topbar">
      <view class="topbar-title">
        <text class="brand-tag">CMO</text>
        <text class="brand-name">首席代谢官</text>
      </view>
    </view>

    <!-- 评分卡片 / 空状态 -->
    <view v-if="isEmptyState" class="empty-card" @click="goRecords">
      <view class="empty-illustration">
        <text class="empty-icon">＋</text>
      </view>
      <text class="empty-title">立即录入第一条数据</text>
      <text class="empty-hint">完成血压、血糖、体重等记录后，可获得代谢评分与风险分析</text>
      <view class="empty-cta">
        <text class="empty-cta-text">开始录入</text>
        <text class="empty-cta-arrow">→</text>
      </view>
    </view>

    <view v-else class="score-card" :class="cardLevelClass" @click="goAnalysis">
      <view class="score-row">
        <view class="score-num-block">
          <text class="score-num">{{ scoreText }}</text>
          <text class="score-num-unit">/100</text>
        </view>
        <view class="score-info">
          <text class="score-level-text">{{ result?.levelInfo.label ?? '--' }}</text>
          <text v-if="offsetText" class="score-offset">{{ offsetText }}</text>
        </view>
      </view>
      <view class="score-foot">
        <text class="score-foot-text">
          {{ isReferenceMode ? '参考评分 · ' : '综合评分 · ' }}{{ coverageText }}
        </text>
        <text class="score-foot-link">查看详情 →</text>
      </view>
    </view>

    <!-- 最新数据 -->
    <view class="section">
      <view class="section-head">
        <text class="section-title">最新数据</text>
      </view>
      <view v-if="latestItems.length === 0" class="today-empty">暂无记录</view>
      <view v-else class="latest-list">
        <view
          v-for="item in latestItems"
          :key="item.label"
          class="latest-row"
          :class="`status-${item.status}`"
        >
          <view class="latest-bar" />
          <view class="latest-main">
            <view class="latest-row-head">
              <text class="latest-label">{{ item.label }}</text>
              <view class="latest-value-block">
                <text class="latest-value">{{ item.value }}</text>
                <text class="latest-unit">{{ item.unit }}</text>
              </view>
            </view>
            <text class="latest-hint">{{ item.hint }}</text>
            <text class="latest-time">{{ item.time }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="footer-disclaimer">
      <text>本应用仅用于个人参考，不构成医疗诊断</text>
      <text class="footer-studio">常来常往工作室</text>
    </view>
    <AppTabBar active="home" />
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.home {
  min-height: 100vh;
  width: 100%;
  max-width: $container-max-width;
  margin: 0 auto;
  padding: 0 32rpx 48rpx;
}

// —— 顶部栏 ——

.topbar {
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: env(safe-area-inset-top);
}

.topbar-title {
  display: flex;
  align-items: center;
}

.brand-tag {
  font-size: 22rpx;
  font-weight: 700;
  color: $color-primary;
  background: rgba(42, 141, 127, 0.1);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  margin-right: 12rpx;
  letter-spacing: 1rpx;
}

.brand-name {
  font-size: 32rpx;
  font-weight: 600;
  color: $color-text-strong;
}

.topbar-action {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: $color-surface;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-sm;
}

.settings-icon {
  font-size: 36rpx;
  color: $color-text;
}

// —— 评分卡片 ——

.score-card {
  background: linear-gradient(135deg, #2a8d7f 0%, #4fb3a5 100%);
  border-radius: $radius-lg;
  padding: 36rpx 36rpx 24rpx;
  color: #ffffff;
  box-shadow: 0 16rpx 40rpx rgba(42, 141, 127, 0.25);
}

.score-card.level-warn {
  background: linear-gradient(135deg, #d99745 0%, #e9b76d 100%);
  box-shadow: 0 16rpx 40rpx rgba(224, 159, 62, 0.28);
}

.score-card.level-bad {
  background: linear-gradient(135deg, #c64f43 0%, #e07c6f 100%);
  box-shadow: 0 16rpx 40rpx rgba(212, 88, 74, 0.28);
}

.score-row {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.score-num-block {
  display: flex;
  align-items: baseline;
  flex-shrink: 0;
}

.score-num {
  font-size: 100rpx;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -2rpx;
}

.score-num-unit {
  font-size: 26rpx;
  opacity: 0.78;
  margin-left: 4rpx;
}

.score-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.score-level-text {
  font-size: 36rpx;
  font-weight: 700;
  line-height: 1.2;
}

.score-offset {
  font-size: 22rpx;
  opacity: 0.9;
  line-height: 1.4;
}

.score-foot {
  border-top: 1rpx solid rgba(255, 255, 255, 0.2);
  padding-top: 14rpx;
  margin-top: 18rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.score-foot-text {
  font-size: 22rpx;
  opacity: 0.85;
}

.score-foot-link {
  font-size: 22rpx;
  opacity: 0.95;
}

// —— 空状态卡片 ——

.empty-card {
  background: $color-surface;
  border-radius: $radius-lg;
  padding: 56rpx 36rpx 48rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: $shadow-md;
  border: 2rpx dashed rgba(42, 141, 127, 0.25);
}

.empty-illustration {
  width: 144rpx;
  height: 144rpx;
  border-radius: 36rpx;
  background: rgba(42, 141, 127, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 28rpx;
}

.empty-icon {
  font-size: 64rpx;
  font-weight: 300;
  color: $color-primary;
}

.empty-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $color-text-strong;
  margin-bottom: 12rpx;
}

.empty-hint {
  font-size: 26rpx;
  color: $color-text-muted;
  text-align: center;
  line-height: 1.6;
  margin-bottom: 28rpx;
  padding: 0 20rpx;
}

.empty-cta {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-light 100%);
  padding: 20rpx 44rpx;
  border-radius: 999rpx;
}

.empty-cta-text {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
  margin-right: 8rpx;
}

.empty-cta-arrow {
  color: #ffffff;
  font-size: 28rpx;
}

// —— 通用 section ——

.section {
  margin-top: 40rpx;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $color-text-strong;
}

.section-action {
  font-size: 24rpx;
  color: $color-primary;
}

// —— 今日数据 ——

.today-empty {
  background: $color-surface;
  border-radius: $radius-md;
  padding: 36rpx;
  text-align: center;
  color: $color-text-faint;
  font-size: 26rpx;
}

// —— 最新数据列表 ——

.latest-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.latest-row {
  background: $color-surface;
  border-radius: $radius-md;
  padding: 20rpx 24rpx 20rpx 0;
  display: flex;
  align-items: stretch;
  box-shadow: $shadow-sm;
  overflow: hidden;
}

.latest-bar {
  width: 8rpx;
  flex-shrink: 0;
  border-radius: 0 $radius-sm $radius-sm 0;
  margin-right: 24rpx;
}

.latest-row.status-good .latest-bar {
  background: $color-success;
}

.latest-row.status-warn .latest-bar {
  background: $color-warning;
}

.latest-row.status-bad .latest-bar {
  background: $color-danger;
}

.latest-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.latest-row-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4rpx;
}

.latest-label {
  font-size: 28rpx;
  font-weight: 600;
  color: $color-text-strong;
}

.latest-value-block {
  display: flex;
  align-items: baseline;
}

.latest-value {
  font-size: 36rpx;
  font-weight: 700;
  color: $color-text-strong;
}

.latest-row.status-good .latest-value {
  color: $color-success;
}

.latest-row.status-warn .latest-value {
  color: $color-warning;
}

.latest-row.status-bad .latest-value {
  color: $color-danger;
}

.latest-unit {
  font-size: 22rpx;
  color: $color-text-muted;
  margin-left: 6rpx;
}

.latest-hint {
  font-size: 24rpx;
  color: $color-text-muted;
}

.latest-time {
  font-size: 20rpx;
  color: $color-text-faint;
}

// —— 底部 ——

.footer-disclaimer {
  margin-top: 60rpx;
  text-align: center;
  font-size: 22rpx;
  color: $color-text-faint;
}

.footer-studio {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $color-text-faint;
}
</style>

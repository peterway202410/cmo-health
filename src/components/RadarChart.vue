<script setup lang="ts">
// 简洁 SVG 雷达图：N 个轴 0-100 评分
import { computed } from 'vue';

interface Axis {
  label: string;
  /** 0-100，null 表示无数据（用虚线） */
  score: number | null;
}

interface Props {
  axes: Axis[];
  size?: number; // viewBox 边长
}

const props = withDefaults(defineProps<Props>(), {
  size: 320,
});

const cx = computed(() => props.size / 2);
const cy = computed(() => props.size / 2);
const R = computed(() => props.size * 0.36); // 半径
const labelR = computed(() => props.size * 0.45); // 文字距离

// 各点角度（顶部为 -90°）
function angleOf(i: number): number {
  return (-Math.PI / 2) + (2 * Math.PI * i) / props.axes.length;
}

function pointAt(i: number, ratio: number): { x: number; y: number } {
  const a = angleOf(i);
  return {
    x: cx.value + Math.cos(a) * R.value * ratio,
    y: cy.value + Math.sin(a) * R.value * ratio,
  };
}

function labelPos(i: number): { x: number; y: number; anchor: string } {
  const a = angleOf(i);
  const x = cx.value + Math.cos(a) * labelR.value;
  const y = cy.value + Math.sin(a) * labelR.value;
  let anchor = 'middle';
  if (Math.cos(a) > 0.2) anchor = 'start';
  else if (Math.cos(a) < -0.2) anchor = 'end';
  return { x, y, anchor };
}

// 多边形：等比例环（25%、50%、75%、100%）
const grid = computed(() => {
  return [0.25, 0.5, 0.75, 1].map((ratio) => {
    return props.axes
      .map((_, i) => {
        const p = pointAt(i, ratio);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(' ');
  });
});

// 数据多边形 + 各点
const dataPolygon = computed(() => {
  return props.axes
    .map((a, i) => {
      const ratio = (a.score ?? 0) / 100;
      const p = pointAt(i, ratio);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');
});

const dataPoints = computed(() => {
  return props.axes.map((a, i) => {
    const ratio = (a.score ?? 0) / 100;
    return { ...pointAt(i, ratio), score: a.score };
  });
});
</script>

<template>
  <view class="radar-wrap">
    <svg :viewBox="`0 0 ${size} ${size}`" class="radar-svg">
      <!-- 网格环 -->
      <polygon
        v-for="(g, i) in grid"
        :key="`g-${i}`"
        :points="g"
        fill="none"
        :stroke="'#e6e8ec'"
        :stroke-width="i === grid.length - 1 ? 1.5 : 0.8"
      />
      <!-- 轴线 -->
      <line
        v-for="(_, i) in axes"
        :key="`ax-${i}`"
        :x1="cx"
        :y1="cy"
        :x2="pointAt(i, 1).x"
        :y2="pointAt(i, 1).y"
        stroke="#e6e8ec"
        stroke-width="0.8"
      />
      <!-- 数据多边形 -->
      <polygon
        :points="dataPolygon"
        fill="rgba(42, 141, 127, 0.18)"
        stroke="#2a8d7f"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <!-- 数据点 -->
      <circle
        v-for="(p, i) in dataPoints"
        :key="`dp-${i}`"
        :cx="p.x"
        :cy="p.y"
        :r="p.score === null ? 2.5 : 4"
        :fill="p.score === null ? '#9ca3af' : '#ffffff'"
        :stroke="p.score === null ? '#9ca3af' : '#2a8d7f'"
        stroke-width="2"
      />
      <!-- 标签 -->
      <text
        v-for="(a, i) in axes"
        :key="`lb-${i}`"
        :x="labelPos(i).x"
        :y="labelPos(i).y"
        :text-anchor="labelPos(i).anchor"
        font-size="11"
        fill="#2c3038"
        dominant-baseline="middle"
      >
        {{ a.label }} {{ a.score === null ? '' : a.score }}
      </text>
    </svg>
  </view>
</template>

<style lang="scss" scoped>
.radar-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
}

.radar-svg {
  width: 100%;
  max-width: 600rpx;
  height: auto;
  display: block;
}
</style>

<script setup lang="ts">
// 简洁好看的 SVG 折线图：平滑曲线 + 区域渐变 + 阈值色带
import { computed } from 'vue';

interface Point {
  x: number; // ms timestamp
  y: number;
}

interface Props {
  points: Point[];
  unit?: string;
  /** 阈值线：lt 表示 y < t 异常（如 HDL），gt 表示 y > t 异常 */
  thresholdLine?: { value: number; mode: 'gt' | 'lt'; label?: string } | null;
  decimals?: number;
  /** 主色，默认 primary 绿 */
  color?: string;
}

const props = withDefaults(defineProps<Props>(), {
  unit: '',
  thresholdLine: null,
  decimals: 1,
  color: '#2a8d7f',
});

// SVG 视图坐标系
const VB_W = 600;
const VB_H = 240;
const PAD_L = 56;
const PAD_R = 24;
const PAD_T = 24;
const PAD_B = 32;

const innerW = VB_W - PAD_L - PAD_R;
const innerH = VB_H - PAD_T - PAD_B;

// 给 gradient/clipPath 一个唯一 id（防止多图共存时冲突）
const uid = `c${Math.floor(Math.random() * 1e9).toString(36)}`;

const stat = computed(() => {
  const ps = props.points;
  if (ps.length === 0) return null;
  const xs = ps.map((p) => p.x);
  const ys = ps.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMinRaw = Math.min(...ys);
  const yMaxRaw = Math.max(...ys);
  const tv = props.thresholdLine?.value;
  const yLo = tv != null ? Math.min(yMinRaw, tv) : yMinRaw;
  const yHi = tv != null ? Math.max(yMaxRaw, tv) : yMaxRaw;
  const ySpan = Math.max(yHi - yLo, Math.abs(yHi) * 0.05 || 1);
  const yPad = ySpan * 0.18 || 1;
  const yMin = yLo - yPad;
  const yMax = yHi + yPad;
  const xSpan = xMax - xMin || 1;
  return { xMin, xMax, yMin, yMax, xSpan, ySpan: yMax - yMin, yMinRaw, yMaxRaw };
});

function px(p: Point): { cx: number; cy: number } {
  const s = stat.value!;
  const cx = PAD_L + ((p.x - s.xMin) / s.xSpan) * innerW;
  const cy = PAD_T + (1 - (p.y - s.yMin) / s.ySpan) * innerH;
  return { cx, cy };
}

const screenPoints = computed(() => (props.points.length ? props.points.map(px) : []));

// Catmull-Rom → Bezier 平滑路径
const linePath = computed(() => {
  const pts = screenPoints.value;
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].cx},${pts[0].cy}`;
  if (pts.length === 2) return `M ${pts[0].cx},${pts[0].cy} L ${pts[1].cx},${pts[1].cy}`;
  let d = `M ${pts[0].cx},${pts[0].cy}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    // Catmull-Rom 到 Bezier，张力 0.5
    const c1x = p1.cx + (p2.cx - p0.cx) / 6;
    const c1y = p1.cy + (p2.cy - p0.cy) / 6;
    const c2x = p2.cx - (p3.cx - p1.cx) / 6;
    const c2y = p2.cy - (p3.cy - p1.cy) / 6;
    d += ` C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.cx.toFixed(2)},${p2.cy.toFixed(2)}`;
  }
  return d;
});

// 区域填充路径：曲线 + 底边封口
const areaPath = computed(() => {
  const line = linePath.value;
  const pts = screenPoints.value;
  if (!line || pts.length === 0) return '';
  const last = pts[pts.length - 1];
  const first = pts[0];
  const baseY = PAD_T + innerH;
  return `${line} L ${last.cx.toFixed(2)},${baseY} L ${first.cx.toFixed(2)},${baseY} Z`;
});

// 阈值线在屏幕上的 y
const thresholdY = computed(() => {
  if (!stat.value || !props.thresholdLine) return null;
  const s = stat.value;
  return PAD_T + (1 - (props.thresholdLine.value - s.yMin) / s.ySpan) * innerH;
});

// 阈值色带（异常区）
const thresholdBand = computed<{ y: number; height: number } | null>(() => {
  if (!stat.value || !props.thresholdLine || thresholdY.value === null) return null;
  const ty = thresholdY.value;
  if (props.thresholdLine.mode === 'gt') {
    // y < threshold 区是安全；y > threshold 异常 → 绘制 PAD_T 到 ty
    const top = PAD_T;
    const height = Math.max(0, ty - top);
    return { y: top, height };
  } else {
    // y > threshold 安全；y < threshold 异常 → 绘制 ty 到 PAD_T+innerH
    const bottom = PAD_T + innerH;
    const height = Math.max(0, bottom - ty);
    return { y: ty, height };
  }
});

// Y 轴刻度（数据范围内 3 个）
const yTicks = computed(() => {
  if (!stat.value) return [];
  const { yMinRaw, yMaxRaw } = stat.value;
  const mid = (yMinRaw + yMaxRaw) / 2;
  return [yMaxRaw, mid, yMinRaw].map((v) => {
    const cy =
      PAD_T + (1 - (v - stat.value!.yMin) / stat.value!.ySpan) * innerH;
    return { val: v, cy };
  });
});

// X 轴刻度
const xTicks = computed(() => {
  const ps = props.points;
  if (ps.length === 0) return [];
  const fmt = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  if (ps.length === 1) {
    return [{ x: PAD_L + innerW / 2, label: fmt(ps[0].x) }];
  }
  return [
    { x: PAD_L + 8, label: fmt(ps[0].x), anchor: 'start' as const },
    { x: PAD_L + innerW - 8, label: fmt(ps[ps.length - 1].x), anchor: 'end' as const },
  ];
});

// 突出点：首尾 + 异常点
const highlightDots = computed(() => {
  const pts = props.points;
  if (pts.length === 0) return [];
  const result: { cx: number; cy: number; abnormal: boolean }[] = [];
  pts.forEach((p, i) => {
    const screen = px(p);
    const th = props.thresholdLine;
    let abnormal = false;
    if (th) {
      abnormal = th.mode === 'gt' ? p.y > th.value : p.y < th.value;
    }
    const isFirst = i === 0;
    const isLast = i === pts.length - 1;
    if (isFirst || isLast || abnormal) {
      result.push({ ...screen, abnormal });
    }
  });
  return result;
});

// 末尾标签：最近一次值
const lastLabel = computed(() => {
  if (props.points.length === 0) return null;
  const last = props.points[props.points.length - 1];
  const screen = px(last);
  return {
    cx: screen.cx,
    cy: screen.cy,
    text: last.y.toFixed(props.decimals),
  };
});

function fmtY(v: number): string {
  return v.toFixed(props.decimals);
}
</script>

<template>
  <view class="chart-wrap">
    <view v-if="points.length === 0" class="chart-empty">
      <text class="chart-empty-text">数据不足</text>
    </view>
    <svg
      v-else
      :viewBox="`0 0 ${VB_W} ${VB_H}`"
      class="chart-svg"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient :id="`grad-${uid}`" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" :stop-color="color" stop-opacity="0.28" />
          <stop offset="100%" :stop-color="color" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- 异常区色带 -->
      <rect
        v-if="thresholdBand"
        :x="PAD_L"
        :y="thresholdBand.y"
        :width="innerW"
        :height="thresholdBand.height"
        fill="#d4584a"
        opacity="0.06"
      />

      <!-- 横向网格线 -->
      <g>
        <line
          v-for="(t, i) in yTicks"
          :key="`gl-${i}`"
          :x1="PAD_L"
          :y1="t.cy"
          :x2="PAD_L + innerW"
          :y2="t.cy"
          stroke="#e6e8ec"
          stroke-width="1"
          stroke-dasharray="3,4"
        />
      </g>

      <!-- 阈值虚线 -->
      <line
        v-if="thresholdY !== null"
        :x1="PAD_L"
        :y1="thresholdY"
        :x2="PAD_L + innerW"
        :y2="thresholdY"
        stroke="#d4584a"
        stroke-width="1.2"
        stroke-dasharray="6,4"
        opacity="0.55"
      />
      <text
        v-if="thresholdLine && thresholdY !== null"
        :x="PAD_L + innerW - 4"
        :y="thresholdY - 6"
        fill="#d4584a"
        font-size="14"
        text-anchor="end"
        opacity="0.85"
      >
        {{ thresholdLine.label || `${thresholdLine.mode === 'gt' ? '≤' : '≥'}${thresholdLine.value}` }}
      </text>

      <!-- 区域填充 -->
      <path :d="areaPath" :fill="`url(#grad-${uid})`" />

      <!-- 折线 -->
      <path
        :d="linePath"
        fill="none"
        :stroke="color"
        stroke-width="3"
        stroke-linejoin="round"
        stroke-linecap="round"
      />

      <!-- 高亮数据点 -->
      <g>
        <circle
          v-for="(d, i) in highlightDots"
          :key="`d-${i}`"
          :cx="d.cx"
          :cy="d.cy"
          :r="d.abnormal ? 5 : 4"
          :fill="d.abnormal ? '#d4584a' : '#ffffff'"
          :stroke="d.abnormal ? '#ffffff' : color"
          stroke-width="2.5"
        />
      </g>

      <!-- 末尾值标签 -->
      <g v-if="lastLabel">
        <rect
          :x="lastLabel.cx - 26"
          :y="lastLabel.cy - 28"
          width="52"
          height="20"
          rx="6"
          ry="6"
          :fill="color"
        />
        <text
          :x="lastLabel.cx"
          :y="lastLabel.cy - 14"
          fill="#ffffff"
          font-size="13"
          font-weight="600"
          text-anchor="middle"
        >
          {{ lastLabel.text }}
        </text>
      </g>

      <!-- Y 轴标签 -->
      <g>
        <text
          v-for="(t, i) in yTicks"
          :key="`yt-${i}`"
          :x="PAD_L - 10"
          :y="t.cy + 4"
          fill="#9ca3af"
          font-size="13"
          text-anchor="end"
        >
          {{ fmtY(t.val) }}
        </text>
      </g>

      <!-- X 轴标签 -->
      <g>
        <text
          v-for="(t, i) in xTicks"
          :key="`xt-${i}`"
          :x="t.x"
          :y="VB_H - 8"
          fill="#9ca3af"
          font-size="13"
          :text-anchor="t.anchor || 'middle'"
        >
          {{ t.label }}
        </text>
      </g>
    </svg>
  </view>
</template>

<style lang="scss" scoped>
.chart-wrap {
  width: 100%;
  position: relative;
}

.chart-svg {
  width: 100%;
  height: auto; /* 保持 viewBox 比例 */
  display: block;
}

.chart-empty {
  width: 100%;
  height: 200rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f6f7f9;
  border-radius: 16rpx;
}

.chart-empty-text {
  font-size: 24rpx;
  color: #9ca3af;
}
</style>

import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

interface Slice { value: number; color: string; }

function arc(cx: number, cy: number, r: number, innerR: number, startDeg: number, endDeg: number) {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const ix1 = cx + innerR * Math.cos(toRad(endDeg));
  const iy1 = cy + innerR * Math.sin(toRad(endDeg));
  const ix2 = cx + innerR * Math.cos(toRad(startDeg));
  const iy2 = cy + innerR * Math.sin(toRad(startDeg));
  const lg = endDeg - startDeg > 180 ? 1 : 0;
  return `M${x1},${y1} A${r},${r},0,${lg},1,${x2},${y2} L${ix1},${iy1} A${innerR},${innerR},0,${lg},0,${ix2},${iy2} Z`;
}

export default function DonutChart({ data, size = 180, thickness = 36 }: {
  data: Slice[];
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 4;
  const innerR = r - thickness;
  let angle = 0;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {total === 0 ? (
          <Circle cx={cx} cy={cy} r={r} fill="none" stroke="#E2E8F0" strokeWidth={thickness} />
        ) : (
          data.filter(d => d.value > 0).map((d, i) => {
            const sweep = (d.value / total) * 358; // 358 avoids full-circle path bug
            const path = arc(cx, cy, r, innerR, angle, angle + sweep);
            angle += sweep;
            return <Path key={i} d={path} fill={d.color} />;
          })
        )}
      </Svg>
    </View>
  );
}

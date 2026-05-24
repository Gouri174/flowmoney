import React from 'react';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

interface Bar { label: string; value: number; color?: string; onPress?: () => void; }

export default function SvgBarChart({ data, width = 320, height = 140, color = '#0F62FE' }: {
  data: Bar[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const padBottom = 22;
  const padTop = 8;
  const chartH = height - padBottom - padTop;
  const slotW = width / data.length;
  const barW = Math.max(8, slotW * 0.55);

  return (
    <Svg width={width} height={height}>
      {data.map((d, i) => {
        const barH = Math.max(3, (d.value / max) * chartH);
        const x = slotW * i + (slotW - barW) / 2;
        const y = padTop + chartH - barH;
        return (
          <React.Fragment key={i}>
            {/* Invisible full-height hit area for easy tapping */}
            <Rect
              x={x} y={padTop} width={barW} height={chartH}
              fill="transparent"
              onPress={d.onPress}
            />
            <Rect x={x} y={y} width={barW} height={barH} rx={4} fill={d.color ?? color} opacity={0.9} onPress={d.onPress} />
            <SvgText x={x + barW / 2} y={height - 5} textAnchor="middle" fontSize={10} fill="#64748B">
              {d.label}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

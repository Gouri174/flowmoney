import React from 'react';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';

interface Bar { label: string; value: number; color?: string; onPress?: () => void; }
interface RefLine { value: number; color?: string; label?: string; }

export default function SvgBarChart({ data, width = 320, height = 140, color = '#0F62FE', referenceLine }: {
  data: Bar[];
  width?: number;
  height?: number;
  color?: string;
  referenceLine?: RefLine;
}) {
  const max = Math.max(...data.map((d) => d.value), referenceLine?.value ?? 0, 1);
  const padBottom = 22;
  const padTop = 8;
  const chartH = height - padBottom - padTop;
  const slotW = width / data.length;
  const barW = Math.max(8, slotW * 0.55);

  const refY = referenceLine
    ? padTop + chartH - (referenceLine.value / max) * chartH
    : null;

  return (
    <Svg width={width} height={height}>
      {data.map((d, i) => {
        const barH = Math.max(3, (d.value / max) * chartH);
        const x = slotW * i + (slotW - barW) / 2;
        const y = padTop + chartH - barH;
        return (
          <React.Fragment key={i}>
            <Rect x={x} y={padTop} width={barW} height={chartH} fill="transparent" onPress={d.onPress} />
            <Rect x={x} y={y} width={barW} height={barH} rx={4} fill={d.color ?? color} opacity={0.9} onPress={d.onPress} />
            <SvgText x={x + barW / 2} y={height - 5} textAnchor="middle" fontSize={10} fill="#64748B">
              {d.label}
            </SvgText>
          </React.Fragment>
        );
      })}
      {refY !== null && referenceLine && (
        <>
          <Line
            x1={0} y1={refY} x2={width} y2={refY}
            stroke={referenceLine.color ?? '#EF4444'}
            strokeWidth={1.5}
            strokeDasharray="5,4"
          />
          {referenceLine.label && (
            <SvgText x={width - 4} y={refY - 4} textAnchor="end" fontSize={9} fill={referenceLine.color ?? '#EF4444'}>
              {referenceLine.label}
            </SvgText>
          )}
        </>
      )}
    </Svg>
  );
}

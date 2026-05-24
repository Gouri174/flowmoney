import React from 'react';
import Svg, { Path, Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';

interface Point { label: string; value: number; onPress?: () => void; }

export default function SvgLineChart({ data, width = 320, height = 140, color = '#0F62FE' }: {
  data: Point[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const padBottom = 22;
  const padTop = 12;
  const padLeft = 4;
  const padRight = 4;
  const chartW = width - padLeft - padRight;
  const chartH = height - padBottom - padTop;
  const step = chartW / (data.length - 1);

  const pts = data.map((d, i) => ({
    x: padLeft + i * step,
    y: padTop + chartH - (d.value / max) * chartH,
    label: d.label,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${pts[pts.length - 1].x},${padTop + chartH} L${pts[0].x},${padTop + chartH} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.25" />
          <Stop offset="1" stopColor={color} stopOpacity="0.02" />
        </LinearGradient>
      </Defs>
      <Path d={areaPath} fill="url(#grad)" />
      <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <React.Fragment key={i}>
          <Circle cx={p.x} cy={p.y} r={14} fill="transparent" onPress={data[i].onPress} />
          <Circle cx={p.x} cy={p.y} r={4} fill={color} onPress={data[i].onPress} />
          <Circle cx={p.x} cy={p.y} r={2.5} fill="#fff" />
          <SvgText x={p.x} y={height - 5} textAnchor="middle" fontSize={10} fill="#64748B">
            {p.label}
          </SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
}

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Transaction } from '@/types/index';
import { COLORS, FONT, RADIUS } from '@/constants/theme';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function heatBg(ratio: number): string {
  if (ratio <= 0) return COLORS.card;
  if (ratio < 0.33) return '#DCFCE7'; // light green
  if (ratio < 0.66) return '#FEF9C3'; // light amber
  return '#FEE2E2';                   // light red
}
function heatText(ratio: number): string {
  if (ratio <= 0) return COLORS.textMuted;
  if (ratio < 0.33) return '#166534';
  if (ratio < 0.66) return '#92400E';
  return '#991B1B';
}

export default function SpendCalendar({
  transactions, month, year, onDayPress,
}: {
  transactions: Transaction[];
  month: number;   // 0-indexed
  year: number;
  onDayPress: (label: string, txns: Transaction[]) => void;
}) {
  const today = new Date();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build per-day spend map
  const daySpend: Record<number, number> = {};
  const dayTxns: Record<number, Transaction[]> = {};
  transactions.filter((t) => t.is_debit).forEach((t) => {
    const d = new Date(t.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const n = d.getDate();
      daySpend[n] = (daySpend[n] ?? 0) + t.amount;
      (dayTxns[n] = dayTxns[n] ?? []).push(t);
    }
  });
  const maxSpend = Math.max(...Object.values(daySpend), 1);

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View>
      {/* Weekday headers */}
      <View style={s.headerRow}>
        {DOW.map((d, i) => (
          <View key={i} style={s.hCell}><Text style={s.hText}>{d}</Text></View>
        ))}
      </View>

      {/* Day grid */}
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={s.row}>
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (!day) return <View key={col} style={s.cell} />;
            const cellDate = new Date(year, month, day);
            const isFuture = cellDate > today;
            const isToday = cellDate.toDateString() === today.toDateString();
            const spend = daySpend[day] ?? 0;
            const ratio = spend / maxSpend;
            const txns = dayTxns[day] ?? [];

            return (
              <TouchableOpacity
                key={col}
                style={[
                  s.cell,
                  { backgroundColor: isFuture ? 'transparent' : heatBg(ratio) },
                  isToday && s.todayRing,
                ]}
                onPress={() => txns.length > 0 && onDayPress(
                  cellDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }),
                  txns
                )}
                activeOpacity={txns.length > 0 && !isFuture ? 0.7 : 1}
                disabled={isFuture}
              >
                <Text style={[
                  s.dayNum,
                  { color: isFuture ? COLORS.border : isToday ? COLORS.primary : heatText(ratio) },
                  isToday && { fontWeight: '800' },
                ]}>
                  {day}
                </Text>
                {spend > 0 && !isFuture && (
                  <Text style={[s.dayAmt, { color: heatText(ratio) }]} numberOfLines={1}>
                    {spend >= 10000
                      ? `${Math.round(spend / 1000)}k`
                      : spend >= 1000
                      ? `${(spend / 1000).toFixed(1)}k`
                      : Math.round(spend)}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View style={s.legend}>
        {[
          { bg: COLORS.card, label: 'No spend', border: true },
          { bg: '#DCFCE7', label: 'Low' },
          { bg: '#FEF9C3', label: 'Mid' },
          { bg: '#FEE2E2', label: 'High' },
        ].map((item) => (
          <View key={item.label} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: item.bg }, item.border && { borderWidth: 1, borderColor: COLORS.border }]} />
            <Text style={s.legendLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', marginBottom: 6 },
  hCell: { flex: 1, alignItems: 'center' },
  hText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  row: { flexDirection: 'row', marginBottom: 3 },
  cell: { flex: 1, aspectRatio: 1, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', marginHorizontal: 2 },
  todayRing: { borderWidth: 1.5, borderColor: COLORS.primary },
  dayNum: { fontSize: 11, fontWeight: '600' },
  dayAmt: { fontSize: 8, fontWeight: '600', marginTop: 1 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { fontSize: 10, color: COLORS.textMuted },
});

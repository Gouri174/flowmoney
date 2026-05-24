import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrendingUp, TrendingDown, Zap, Calendar, ArrowUpRight, ArrowDownLeft } from 'lucide-react-native';
import { useApp } from '@/context/AppContext';
import { COLORS, SPACING, RADIUS, FONT, CATEGORY_COLORS } from '@/constants/theme';
import { formatCurrency, getMonthStart } from '@/utils/format';
import DonutChart from '@/components/DonutChart';
import SvgBarChart from '@/components/SvgBarChart';
import SvgLineChart from '@/components/SvgLineChart';

type Period = 'this' | 'last' | '3m';

export default function InsightsScreen() {
  const { transactions } = useApp();
  const { width } = useWindowDimensions();
  const chartWidth = width - SPACING.md * 2 - 32;
  const [period, setPeriod] = useState<Period>('this');

  const now = new Date();

  const periodRange = useMemo(() => {
    if (period === 'this') {
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    }
    if (period === 'last') {
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
      };
    }
    return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end: now };
  }, [period]);

  const periodTxns = useMemo(
    () => transactions.filter((t) => {
      const d = new Date(t.date);
      return d >= periodRange.start && d <= periodRange.end;
    }),
    [transactions, periodRange]
  );

  const debitTxns = useMemo(() => periodTxns.filter((t) => t.is_debit), [periodTxns]);
  const creditTxns = useMemo(() => periodTxns.filter((t) => !t.is_debit), [periodTxns]);

  const totalSpent = debitTxns.reduce((s, t) => s + t.amount, 0);
  const totalReceived = creditTxns.reduce((s, t) => s + t.amount, 0);

  // Category breakdown
  const catBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    debitTxns.forEach((t) => { map[t.category_name] = (map[t.category_name] ?? 0) + t.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [debitTxns]);

  // Donut slices
  const donutData = catBreakdown.slice(0, 6).map(([cat, value]) => ({
    value,
    color: CATEGORY_COLORS[cat] ?? '#94A3B8',
    label: cat,
  }));

  // 6-month trend line
  const monthlyTrend = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const amount = transactions
        .filter((t) => t.is_debit && new Date(t.date) >= start && new Date(t.date) <= end)
        .reduce((s, t) => s + t.amount, 0);
      return { label: d.toLocaleDateString('en-IN', { month: 'short' }), value: amount };
    }),
    [transactions]
  );

  // Daily spending for current period (last 14 days max)
  const dailyBars = useMemo(() => {
    const days = Math.min(14, Math.ceil((periodRange.end.getTime() - periodRange.start.getTime()) / 86400000) + 1);
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(periodRange.end);
      d.setDate(d.getDate() - (days - 1 - i));
      const s = new Date(d); s.setHours(0, 0, 0, 0);
      const e = new Date(d); e.setHours(23, 59, 59, 999);
      const amount = debitTxns.filter((t) => {
        const td = new Date(t.date);
        return td >= s && td <= e;
      }).reduce((sum, t) => sum + t.amount, 0);
      return {
        label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).split(' ')[0],
        value: amount,
      };
    });
  }, [debitTxns, periodRange]);

  // Day of week
  const dowBars = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const map: Record<string, number> = {};
    days.forEach((d) => { map[d] = 0; });
    debitTxns.forEach((t) => { const d = days[new Date(t.date).getDay()]; map[d] += t.amount; });
    return days.map((d) => ({ label: d.slice(0, 3), value: map[d] }));
  }, [debitTxns]);

  // Smart insights
  const prevMonthTxns = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return transactions.filter((t) => t.is_debit && new Date(t.date) >= start && new Date(t.date) <= end);
  }, [transactions]);
  const prevTotal = prevMonthTxns.reduce((s, t) => s + t.amount, 0);

  const insights = useMemo(() => {
    const list: { icon: string; text: string; type: 'good' | 'bad' | 'neutral' }[] = [];
    if (prevTotal > 0 && period === 'this') {
      const delta = ((totalSpent - prevTotal) / prevTotal) * 100;
      if (delta > 10) list.push({ icon: 'up', text: `Spending up ${Math.round(delta)}% vs last month.`, type: 'bad' });
      else if (delta < -10) list.push({ icon: 'down', text: `Spending down ${Math.round(Math.abs(delta))}% vs last month — great job!`, type: 'good' });
    }
    if (catBreakdown[0]) {
      const pct = totalSpent > 0 ? Math.round((catBreakdown[0][1] / totalSpent) * 100) : 0;
      list.push({ icon: 'zap', text: `${catBreakdown[0][0]} is your top spend at ${pct}% of total.`, type: 'neutral' });
    }
    const topDow = [...dowBars].sort((a, b) => b.value - a.value)[0];
    if (topDow?.value > 0) list.push({ icon: 'cal', text: `${topDow.label} is your heaviest spending day.`, type: 'neutral' });
    if (totalReceived > totalSpent) list.push({ icon: 'down', text: `You received more than you spent this period — surplus of ${formatCurrency(totalReceived - totalSpent)}.`, type: 'good' });
    return list;
  }, [totalSpent, prevTotal, catBreakdown, dowBars, totalReceived, period]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Insights</Text>

        {/* Period selector */}
        <View style={styles.periodRow}>
          {(['this', 'last', '3m'] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                {p === 'this' ? 'This Month' : p === 'last' ? 'Last Month' : '3 Months'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Income vs Expense summary */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: COLORS.error }]}>
            <View style={styles.summaryIcon}>
              <ArrowUpRight color={COLORS.error} size={16} />
            </View>
            <Text style={styles.summaryLabel}>Spent</Text>
            <Text style={[styles.summaryAmt, { color: COLORS.error }]}>{formatCurrency(totalSpent)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: COLORS.success }]}>
            <View style={styles.summaryIcon}>
              <ArrowDownLeft color={COLORS.success} size={16} />
            </View>
            <Text style={styles.summaryLabel}>Received</Text>
            <Text style={[styles.summaryAmt, { color: COLORS.success }]}>{formatCurrency(totalReceived)}</Text>
          </View>
        </View>

        {/* Smart Insights */}
        {insights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Smart Insights</Text>
            {insights.map((ins, i) => (
              <View key={i} style={[styles.insightCard, ins.type === 'bad' && styles.cardBad, ins.type === 'good' && styles.cardGood]}>
                {ins.icon === 'up' && <TrendingUp color={ins.type === 'bad' ? COLORS.error : COLORS.success} size={18} />}
                {ins.icon === 'down' && <TrendingDown color={COLORS.success} size={18} />}
                {ins.icon === 'zap' && <Zap color={COLORS.primary} size={18} />}
                {ins.icon === 'cal' && <Calendar color={COLORS.textMuted} size={18} />}
                <Text style={[styles.insightText, ins.type === 'bad' && { color: COLORS.error }, ins.type === 'good' && { color: '#065F46' }]}>
                  {ins.text}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Donut chart + category legend */}
        {catBreakdown.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Spending by Category</Text>
            <View style={styles.card}>
              <View style={styles.donutRow}>
                <DonutChart data={donutData} size={160} thickness={34} />
                <View style={styles.legend}>
                  {catBreakdown.slice(0, 6).map(([cat, amt]) => (
                    <View key={cat} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: CATEGORY_COLORS[cat] ?? '#94A3B8' }]} />
                      <Text style={styles.legendLabel} numberOfLines={1}>{cat}</Text>
                      <Text style={styles.legendAmt}>{formatCurrency(amt)}</Text>
                    </View>
                  ))}
                </View>
              </View>
              {/* Category progress bars */}
              <View style={{ marginTop: SPACING.sm }}>
                {catBreakdown.map(([cat, amt]) => {
                  const pct = totalSpent > 0 ? amt / totalSpent : 0;
                  const color = CATEGORY_COLORS[cat] ?? '#94A3B8';
                  return (
                    <View key={cat} style={styles.catRow}>
                      <Text style={styles.catName} numberOfLines={1}>{cat}</Text>
                      <View style={styles.catTrack}>
                        <View style={[styles.catFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
                      </View>
                      <Text style={styles.catAmt}>{Math.round(pct * 100)}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* 6-month trend line chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6-Month Spending Trend</Text>
          <View style={styles.card}>
            <SvgLineChart data={monthlyTrend} width={chartWidth} height={150} color={COLORS.primary} />
          </View>
        </View>

        {/* Daily spending bar chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Spending</Text>
          <View style={styles.card}>
            <SvgBarChart data={dailyBars} width={chartWidth} height={140} color={COLORS.primary} />
          </View>
        </View>

        {/* Day of week bar chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spending by Day of Week</Text>
          <View style={styles.card}>
            <SvgBarChart data={dowBars} width={chartWidth} height={130} color={COLORS.secondary} />
          </View>
        </View>

        {transactions.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Import or sync transactions to see insights.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.md, paddingBottom: 100 },
  heading: { fontSize: FONT.sizes.xl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  periodRow: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.md },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  periodBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  periodText: { fontSize: FONT.sizes.xs, color: COLORS.textMuted, fontWeight: '600' },
  periodTextActive: { color: '#fff' },
  summaryRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  summaryCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4, gap: 4 },
  summaryIcon: { marginBottom: 2 },
  summaryLabel: { fontSize: FONT.sizes.xs, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  summaryAmt: { fontSize: FONT.sizes.lg, fontWeight: '700' },
  section: { marginBottom: SPACING.lg },
  sectionTitle: { fontSize: FONT.sizes.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  insightCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.xs },
  cardBad: { backgroundColor: COLORS.errorLight, borderColor: COLORS.error + '40' },
  cardGood: { backgroundColor: COLORS.successLight, borderColor: COLORS.success + '40' },
  insightText: { flex: 1, fontSize: FONT.sizes.sm, color: COLORS.text, lineHeight: 20 },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm },
  legend: { flex: 1, gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { flex: 1, fontSize: FONT.sizes.xs, color: COLORS.text },
  legendAmt: { fontSize: FONT.sizes.xs, fontWeight: '700', color: COLORS.text },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 8 },
  catName: { fontSize: FONT.sizes.xs, color: COLORS.text, width: 100 },
  catTrack: { flex: 1, height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  catFill: { height: '100%', borderRadius: 3 },
  catAmt: { fontSize: FONT.sizes.xs, fontWeight: '700', color: COLORS.textMuted, width: 34, textAlign: 'right' },
  empty: { padding: SPACING.xxl, alignItems: 'center' },
  emptyText: { fontSize: FONT.sizes.sm, color: COLORS.textMuted, textAlign: 'center' },
});

import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, TrendingDown, Wallet, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { COLORS, SPACING, RADIUS, FONT, CATEGORY_COLORS } from '@/constants/theme';
import { formatCurrency, formatShortDate, getMonthStart, getWeekStart } from '@/utils/format';
import MerchantIcon from '@/components/MerchantIcon';
import CategoryBadge from '@/components/CategoryBadge';
import SvgBarChart from '@/components/SvgBarChart';

export default function DashboardScreen() {
  const { profile } = useAuth();
  const { transactions, budgets, unreadCount } = useApp();
  const { width } = useWindowDimensions();
  const chartWidth = width - SPACING.md * 2 - SPACING.md * 2; // padding both sides

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthStart = getMonthStart();
  const weekStart = getWeekStart();

  const monthTxns = useMemo(
    () => transactions.filter((t) => t.is_debit && new Date(t.date) >= monthStart),
    [transactions, monthStart]
  );
  const weekSpend = useMemo(
    () => transactions.filter((t) => t.is_debit && new Date(t.date) >= weekStart).reduce((s, t) => s + t.amount, 0),
    [transactions, weekStart]
  );
  const monthSpend = useMemo(() => monthTxns.reduce((s, t) => s + t.amount, 0), [monthTxns]);

  const totalBudget = useMemo(
    () => budgets.filter((b) => b.month === month && b.year === year).reduce((s, b) => s + b.amount, 0),
    [budgets, month, year]
  );
  const remaining = totalBudget > 0 ? Math.max(0, totalBudget - monthSpend) : null;

  const categorySpend = useMemo(() => {
    const map: Record<string, number> = {};
    monthTxns.forEach((t) => { map[t.category_name] = (map[t.category_name] ?? 0) + t.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [monthTxns]);

  const alerts = useMemo(
    () => budgets.filter((b) => {
      if (b.month !== month || b.year !== year) return false;
      const spent = categorySpend.find(([c]) => c === b.category_name)?.[1] ?? 0;
      return spent / b.amount >= 0.8;
    }),
    [budgets, categorySpend, month, year]
  );

  const weeklyBars = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
      const s = new Date(d); s.setHours(0, 0, 0, 0);
      const e = new Date(d); e.setHours(23, 59, 59, 999);
      const value = transactions
        .filter((t) => t.is_debit && new Date(t.date) >= s && new Date(t.date) <= e)
        .reduce((sum, t) => sum + t.amount, 0);
      return { label, value };
    });
  }, [transactions]);

  const recentTxns = transactions.slice(0, 5);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {profile?.name?.split(' ')[0] ?? 'there'}</Text>
            <Text style={styles.sub}>Your spending overview</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(tabs)/notifications')}>
              <Bell color={COLORS.text} size={20} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Budget alert */}
        {alerts.length > 0 && (
          <View style={styles.alertCard}>
            <AlertTriangle color={COLORS.warning} size={16} />
            <Text style={styles.alertText}>
              {alerts[0].category_name} budget {Math.round(
                ((categorySpend.find(([c]) => c === alerts[0].category_name)?.[1] ?? 0) / alerts[0].amount) * 100
              )}% used
            </Text>
          </View>
        )}

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>This Week</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(weekSpend)}</Text>
            <TrendingDown color={COLORS.error} size={14} />
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>This Month</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(monthSpend)}</Text>
            <TrendingDown color={COLORS.error} size={14} />
          </View>
        </View>

        {remaining !== null && (
          <View style={styles.remainingCard}>
            <View>
              <Text style={styles.summaryLabel}>Remaining Budget</Text>
              <Text style={[styles.summaryAmountLg, { color: remaining > 0 ? COLORS.success : COLORS.error }]}>
                {formatCurrency(remaining)}
              </Text>
            </View>
            <Wallet color={remaining > 0 ? COLORS.success : COLORS.error} size={36} />
          </View>
        )}

        {/* 7-day bar chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last 7 Days</Text>
          <View style={styles.chartCard}>
            <SvgBarChart data={weeklyBars} width={chartWidth} height={110} color={COLORS.primary} />
          </View>
        </View>

        {/* Top categories */}
        {categorySpend.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Categories</Text>
            {categorySpend.slice(0, 5).map(([cat, amount]) => {
              const pct = monthSpend > 0 ? amount / monthSpend : 0;
              const color = CATEGORY_COLORS[cat] ?? COLORS.textMuted;
              return (
                <View key={cat} style={styles.catRow}>
                  <View style={[styles.catDot, { backgroundColor: color }]} />
                  <Text style={styles.catName}>{cat}</Text>
                  <View style={styles.catBarTrack}>
                    <View style={[styles.catBarFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
                  </View>
                  <Text style={styles.catAmount}>{formatCurrency(amount)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Recent transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {recentTxns.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No transactions yet. Tap the sync button above.</Text>
            </View>
          ) : (
            recentTxns.map((t) => (
              <View key={t.id} style={styles.txnCard}>
                <MerchantIcon merchant={t.merchant} category={t.category_name} />
                <View style={styles.txnInfo}>
                  <Text style={styles.txnMerchant}>{t.merchant}</Text>
                  <CategoryBadge category={t.category_name} small />
                </View>
                <View style={styles.txnRight}>
                  <Text style={[styles.txnAmount, { color: t.is_debit ? COLORS.error : COLORS.success }]}>
                    -{formatCurrency(t.amount)}
                  </Text>
                  <Text style={styles.txnDate}>{formatShortDate(t.date)}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.md, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  greeting: { fontSize: FONT.sizes.xl, fontWeight: '700', color: COLORS.text },
  sub: { fontSize: FONT.sizes.sm, color: COLORS.textMuted, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: SPACING.sm },
  iconBtn: { width: 40, height: 40, borderRadius: RADIUS.full, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  badge: { position: 'absolute', top: -2, right: -2, backgroundColor: COLORS.error, borderRadius: RADIUS.full, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  alertCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.warningLight, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderLeftWidth: 3, borderLeftColor: COLORS.warning },
  alertText: { fontSize: FONT.sizes.sm, color: '#92400E', fontWeight: '600' },
  summaryRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  summaryCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  summaryLabel: { fontSize: FONT.sizes.xs, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryAmount: { fontSize: FONT.sizes.lg, fontWeight: '700', color: COLORS.text },
  summaryAmountLg: { fontSize: FONT.sizes.xl, fontWeight: '700' },
  remainingCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md },
  section: { marginBottom: SPACING.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  sectionTitle: { fontSize: FONT.sizes.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  seeAll: { fontSize: FONT.sizes.sm, color: COLORS.primary, fontWeight: '600' },
  chartCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { fontSize: FONT.sizes.sm, color: COLORS.text, width: 110 },
  catBarTrack: { flex: 1, height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 3 },
  catAmount: { fontSize: FONT.sizes.sm, fontWeight: '600', color: COLORS.text, width: 70, textAlign: 'right' },
  emptyState: { padding: SPACING.xl, alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  emptyText: { fontSize: FONT.sizes.sm, color: COLORS.textMuted, textAlign: 'center' },
  txnCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.xs, borderWidth: 1, borderColor: COLORS.border },
  txnInfo: { flex: 1, gap: 3 },
  txnMerchant: { fontSize: FONT.sizes.sm, fontWeight: '600', color: COLORS.text },
  txnRight: { alignItems: 'flex-end', gap: 3 },
  txnAmount: { fontSize: FONT.sizes.sm, fontWeight: '700' },
  txnDate: { fontSize: FONT.sizes.xs, color: COLORS.textMuted },
});

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell, TrendingDown, TrendingUp, Wallet,
  TriangleAlert as AlertTriangle, X, Repeat2, Target,
  ChevronLeft, ChevronRight, Flame,
} from 'lucide-react-native';
import type { Transaction } from '@/types/index';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { COLORS, SPACING, RADIUS, FONT, CATEGORY_COLORS } from '@/constants/theme';
import { formatCurrency, formatShortDate, getMonthStart, getWeekStart } from '@/utils/format';
import MerchantIcon from '@/components/MerchantIcon';
import CategoryBadge from '@/components/CategoryBadge';
import SvgBarChart from '@/components/SvgBarChart';
import SpendCalendar from '@/components/SpendCalendar';

// ── helpers ──────────────────────────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function deltaTag(current: number, prev: number): { text: string; color: string } | null {
  if (prev === 0 || current === 0) return null;
  const pct = Math.round(((current - prev) / prev) * 100);
  if (Math.abs(pct) < 3) return { text: '≈ same', color: COLORS.textMuted };
  return {
    text: pct > 0 ? `↑${pct}%` : `↓${Math.abs(pct)}%`,
    color: pct > 0 ? COLORS.error : COLORS.success,
  };
}

// ── component ─────────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { profile } = useAuth();
  const { transactions, budgets, unreadCount } = useApp();
  const { width } = useWindowDimensions();
  const chartWidth = width - SPACING.md * 4;
  const [drill, setDrill] = useState<{ title: string; txns: Transaction[] } | null>(null);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // Calendar navigation
  const [calMonth, setCalMonth] = useState(now.getMonth());   // 0-indexed
  const [calYear, setCalYear] = useState(now.getFullYear());
  function shiftCal(delta: number) {
    setCalMonth((m) => {
      const nm = m + delta;
      if (nm < 0) { setCalYear((y) => y - 1); return 11; }
      if (nm > 11) { setCalYear((y) => y + 1); return 0; }
      return nm;
    });
  }
  const calAtCurrent = calYear === now.getFullYear() && calMonth === now.getMonth();

  const monthStart = getMonthStart();
  const weekStart = getWeekStart();

  // ── core spend ─────────────────────────────────────────────────────────────
  const monthTxns = useMemo(
    () => transactions.filter((t) => t.is_debit && new Date(t.date) >= monthStart),
    [transactions, monthStart]
  );
  const monthSpend = useMemo(() => monthTxns.reduce((s, t) => s + t.amount, 0), [monthTxns]);
  const weekSpend = useMemo(
    () => transactions.filter((t) => t.is_debit && new Date(t.date) >= weekStart).reduce((s, t) => s + t.amount, 0),
    [transactions, weekStart]
  );

  const todayS = new Date(); todayS.setHours(0, 0, 0, 0);
  const todayE = new Date(); todayE.setHours(23, 59, 59, 999);
  const todaySpend = useMemo(
    () => transactions.filter((t) => t.is_debit && new Date(t.date) >= todayS && new Date(t.date) <= todayE).reduce((s, t) => s + t.amount, 0),
    [transactions]
  );

  // ── delta vs previous periods ──────────────────────────────────────────────
  const prevWeekStart = useMemo(() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); return d; }, [weekStart]);
  const prevWeekEnd = useMemo(() => { const d = new Date(weekStart); d.setTime(d.getTime() - 1); return d; }, [weekStart]);
  const lastWeekSpend = useMemo(
    () => transactions.filter((t) => t.is_debit && new Date(t.date) >= prevWeekStart && new Date(t.date) <= prevWeekEnd).reduce((s, t) => s + t.amount, 0),
    [transactions, prevWeekStart, prevWeekEnd]
  );
  const lastMonthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth() - 1, 1), []);
  const lastMonthEnd = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59), []);
  const lastMonthSpend = useMemo(
    () => transactions.filter((t) => t.is_debit && new Date(t.date) >= lastMonthStart && new Date(t.date) <= lastMonthEnd).reduce((s, t) => s + t.amount, 0),
    [transactions, lastMonthStart, lastMonthEnd]
  );

  // ── budget & alerts ────────────────────────────────────────────────────────
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

  // ── projection ────────────────────────────────────────────────────────────
  const projection = useMemo(() => {
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (dayOfMonth === 0 || monthSpend === 0) return null;
    const dailyAvg = monthSpend / dayOfMonth;
    const projected = Math.round(dailyAvg * daysInMonth);
    const isOver = totalBudget > 0 && projected > totalBudget;
    const spentPct = totalBudget > 0 ? Math.min(1, monthSpend / totalBudget) : null;
    const projPct = totalBudget > 0 ? Math.min(1, projected / totalBudget) : null;
    return { projected, isOver, dailyAvg, daysLeft: daysInMonth - dayOfMonth, spentPct, projPct };
  }, [monthSpend, totalBudget]);

  const dailyBudgetLimit = useMemo(() => {
    if (totalBudget <= 0) return undefined;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return totalBudget / daysInMonth;
  }, [totalBudget]);

  // ── no-spend streak ────────────────────────────────────────────────────────
  const noSpendStreak = useMemo(() => {
    let streak = 0;
    const d = new Date(); d.setDate(d.getDate() - 1);
    for (let i = 0; i < 60; i++) {
      const s = new Date(d); s.setHours(0, 0, 0, 0);
      const e = new Date(d); e.setHours(23, 59, 59, 999);
      const spent = transactions.filter((t) => t.is_debit && new Date(t.date) >= s && new Date(t.date) <= e).reduce((sum, t) => sum + t.amount, 0);
      if (spent > 0) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }, [transactions]);

  // ── 7-day chart data ──────────────────────────────────────────────────────
  const weeklyBars = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
      const s = new Date(d); s.setHours(0, 0, 0, 0);
      const e = new Date(d); e.setHours(23, 59, 59, 999);
      const dayTxns = transactions.filter((t) => t.is_debit && new Date(t.date) >= s && new Date(t.date) <= e);
      const value = dayTxns.reduce((sum, t) => sum + t.amount, 0);
      const title = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
      return { label, value, onPress: dayTxns.length > 0 ? () => setDrill({ title, txns: dayTxns }) : undefined };
    });
  }, [transactions]);

  // ── recurring merchants ───────────────────────────────────────────────────
  const recurringMerchants = useMemo(() => {
    const merchantMonths: Record<string, Set<string>> = {};
    const merchantTotal: Record<string, number> = {};
    const merchantCount: Record<string, number> = {};
    transactions.filter((t) => t.is_debit).forEach((t) => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!merchantMonths[t.merchant]) merchantMonths[t.merchant] = new Set();
      merchantMonths[t.merchant].add(key);
      merchantTotal[t.merchant] = (merchantTotal[t.merchant] ?? 0) + t.amount;
      merchantCount[t.merchant] = (merchantCount[t.merchant] ?? 0) + 1;
    });
    return Object.entries(merchantMonths)
      .filter(([, months]) => months.size >= 2)
      .map(([merchant, months]) => ({
        merchant,
        monthCount: months.size,
        avgAmount: merchantTotal[merchant] / merchantCount[merchant],
        totalAmount: merchantTotal[merchant],
      }))
      .sort((a, b) => b.monthCount - a.monthCount)
      .slice(0, 3);
  }, [transactions]);

  const recentTxns = transactions.slice(0, 5);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()}, {profile?.name?.split(' ')[0] ?? 'there'} 👋</Text>
            <Text style={styles.sub}>
              {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {noSpendStreak >= 2 && (
              <View style={styles.streakBadge}>
                <Flame color="#F97316" size={13} />
                <Text style={styles.streakText}>{noSpendStreak}d</Text>
              </View>
            )}
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(tabs)/notifications')}>
              <Bell color={COLORS.text} size={20} />
              {unreadCount > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Budget alert ── */}
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

        {/* ── Summary cards ── */}
        <View style={styles.summaryRow}>
          {[
            { label: 'Today', value: todaySpend, delta: null },
            { label: 'This Week', value: weekSpend, delta: deltaTag(weekSpend, lastWeekSpend) },
            { label: 'This Month', value: monthSpend, delta: deltaTag(monthSpend, lastMonthSpend) },
          ].map((card) => (
            <View key={card.label} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{card.label}</Text>
              <Text style={styles.summaryAmount} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(card.value)}</Text>
              {card.delta ? (
                <Text style={[styles.summaryDelta, { color: card.delta.color }]}>{card.delta.text} vs prev</Text>
              ) : (
                <TrendingDown color={card.value > 0 ? COLORS.error : COLORS.textMuted} size={12} />
              )}
            </View>
          ))}
        </View>

        {/* ── Remaining budget ── */}
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

        {/* ── Projection card with progress bar ── */}
        {projection && (
          <View style={[styles.projCard, { borderLeftColor: projection.isOver ? COLORS.error : COLORS.success }]}>
            <View style={styles.projTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.projLabel}>
                  {projection.isOver ? '⚠️ On track to overspend' : '✅ On track this month'}
                </Text>
                <Text style={[styles.projAmount, { color: projection.isOver ? COLORS.error : COLORS.success }]}>
                  {formatCurrency(projection.projected)} projected
                </Text>
              </View>
              {projection.isOver
                ? <TrendingUp color={COLORS.error} size={26} />
                : <Target color={COLORS.success} size={26} />}
            </View>
            {projection.spentPct !== null && (
              <View style={styles.projBarTrack}>
                {/* Actual spent */}
                <View style={[styles.projBarSpent, {
                  width: `${projection.spentPct * 100}%`,
                  backgroundColor: projection.isOver ? COLORS.error : COLORS.primary,
                }]} />
                {/* Projected extension */}
                {!projection.isOver && projection.projPct !== null && (
                  <View style={[styles.projBarProjected, {
                    width: `${Math.max(0, (projection.projPct - projection.spentPct) * 100)}%`,
                  }]} />
                )}
              </View>
            )}
            <Text style={styles.projSub}>
              ₹{Math.round(projection.dailyAvg).toLocaleString('en-IN')}/day avg · {projection.daysLeft} days left
              {projection.projPct !== null ? ` · ${Math.round(projection.projPct * 100)}% of budget` : ''}
            </Text>
          </View>
        )}

        {/* ── 7-day bar chart ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last 7 Days</Text>
          <View style={styles.card}>
            <SvgBarChart
              data={weeklyBars}
              width={chartWidth}
              height={110}
              color={COLORS.primary}
              referenceLine={dailyBudgetLimit
                ? { value: dailyBudgetLimit, color: '#EF4444', label: 'Daily limit' }
                : undefined}
            />
          </View>
        </View>

        {/* ── Cash flow calendar ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>
              {new Date(calYear, calMonth, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </Text>
            <View style={styles.calNav}>
              <TouchableOpacity onPress={() => shiftCal(-1)} style={styles.calNavBtn}>
                <ChevronLeft color={COLORS.primary} size={18} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => shiftCal(1)}
                style={styles.calNavBtn}
                disabled={calAtCurrent}
              >
                <ChevronRight color={calAtCurrent ? COLORS.border : COLORS.primary} size={18} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.card}>
            <SpendCalendar
              transactions={transactions}
              month={calMonth}
              year={calYear}
              onDayPress={(label, txns) => setDrill({ title: label, txns })}
            />
          </View>
        </View>

        {/* ── Top categories ── */}
        {categorySpend.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Categories — {now.toLocaleDateString('en-IN', { month: 'short' })}</Text>
            {categorySpend.slice(0, 5).map(([cat, amount]) => {
              const pct = monthSpend > 0 ? amount / monthSpend : 0;
              const color = CATEGORY_COLORS[cat] ?? COLORS.textMuted;
              const catTxns = monthTxns.filter((t) => t.category_name === cat);
              return (
                <TouchableOpacity key={cat} style={styles.catRow} onPress={() => setDrill({ title: cat, txns: catTxns })} activeOpacity={0.7}>
                  <View style={[styles.catDot, { backgroundColor: color }]} />
                  <Text style={styles.catName} numberOfLines={1}>{cat}</Text>
                  <View style={styles.catBarTrack}>
                    <View style={[styles.catBarFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
                  </View>
                  <Text style={styles.catAmount}>{formatCurrency(amount)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Recurring expenses ── */}
        {recurringMerchants.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Recurring Expenses</Text>
              <Repeat2 color={COLORS.textMuted} size={15} />
            </View>
            {recurringMerchants.map((r) => (
              <TouchableOpacity
                key={r.merchant}
                style={styles.recurringCard}
                onPress={() => setDrill({ title: r.merchant, txns: transactions.filter((t) => t.is_debit && t.merchant === r.merchant) })}
                activeOpacity={0.75}
              >
                <View style={styles.recurringIcon}><Repeat2 color={COLORS.primary} size={15} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recurringName}>{r.merchant}</Text>
                  <Text style={styles.recurringMeta}>{r.monthCount} months in a row</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.recurringAmt}>{formatCurrency(r.avgAmount)}<Text style={styles.muted}> avg</Text></Text>
                  <Text style={styles.recurringTotal}>{formatCurrency(r.totalAmount)} total</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Recent transactions ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {recentTxns.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No transactions yet. Import a CSV to get started.</Text>
            </View>
          ) : (
            recentTxns.map((t) => (
              <View key={t.id} style={styles.txnCard}>
                <MerchantIcon merchant={t.merchant} category={t.category_name} />
                <View style={styles.txnInfo}>
                  <Text style={styles.txnMerchant} numberOfLines={1}>{t.merchant}</Text>
                  <CategoryBadge category={t.category_name} small />
                </View>
                <View style={styles.txnRight}>
                  <Text style={[styles.txnAmount, { color: t.is_debit ? COLORS.error : COLORS.success }]}>
                    {t.is_debit ? '-' : '+'}{formatCurrency(t.amount)}
                  </Text>
                  <Text style={styles.txnDate}>{formatShortDate(t.date)}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* ── Drill-down sheet ── */}
      <Modal visible={!!drill} transparent animationType="slide" onRequestClose={() => setDrill(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setDrill(null)} />
        {drill && (
          <View style={styles.drillSheet}>
            <View style={styles.drillHandle} />
            <View style={styles.drillHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.drillTitle}>{drill.title}</Text>
                <Text style={styles.drillSub}>
                  {drill.txns.length} transactions ·{' '}
                  <Text style={{ color: COLORS.error, fontWeight: '700' }}>
                    {formatCurrency(drill.txns.filter((t) => t.is_debit).reduce((s, t) => s + t.amount, 0))}
                  </Text>
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDrill(null)}><X color={COLORS.textMuted} size={18} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[...drill.txns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((t) => (
                <View key={t.id} style={styles.drillRow}>
                  <MerchantIcon merchant={t.merchant} category={t.category_name} />
                  <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                    <Text style={styles.drillMerchant} numberOfLines={1}>{t.merchant}</Text>
                    <Text style={styles.drillTime}>{formatShortDate(t.date)}</Text>
                  </View>
                  <Text style={[styles.drillAmt, { color: t.is_debit ? COLORS.error : COLORS.success }]}>
                    {t.is_debit ? '-' : '+'}{formatCurrency(t.amount)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.md, paddingBottom: 110 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  greeting: { fontSize: FONT.sizes.xl, fontWeight: '700', color: COLORS.text },
  sub: { fontSize: FONT.sizes.sm, color: COLORS.textMuted, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFF7ED', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#FED7AA' },
  streakText: { fontSize: 11, fontWeight: '700', color: '#C2410C' },
  iconBtn: { width: 40, height: 40, borderRadius: RADIUS.full, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  badge: { position: 'absolute', top: -2, right: -2, backgroundColor: COLORS.error, borderRadius: RADIUS.full, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  // Alert
  alertCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.warningLight, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderLeftWidth: 3, borderLeftColor: COLORS.warning },
  alertText: { fontSize: FONT.sizes.sm, color: '#92400E', fontWeight: '600' },

  // Summary cards
  summaryRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  summaryCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, gap: 3 },
  summaryLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  summaryAmount: { fontSize: FONT.sizes.md, fontWeight: '700', color: COLORS.text },
  summaryDelta: { fontSize: 9, fontWeight: '600' },
  summaryAmountLg: { fontSize: FONT.sizes.xl, fontWeight: '700' },
  remainingCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md },

  // Projection
  projCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4, marginBottom: SPACING.md },
  projTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.sm },
  projLabel: { fontSize: FONT.sizes.xs, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  projAmount: { fontSize: FONT.sizes.lg, fontWeight: '700' },
  projBarTrack: { height: 7, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden', flexDirection: 'row', marginBottom: 6 },
  projBarSpent: { height: '100%', borderRadius: 4 },
  projBarProjected: { height: '100%', backgroundColor: COLORS.primary + '40', borderRadius: 4 },
  projSub: { fontSize: FONT.sizes.xs, color: COLORS.textMuted },

  // Sections
  section: { marginBottom: SPACING.lg },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  sectionTitle: { fontSize: FONT.sizes.md, fontWeight: '700', color: COLORS.text },
  seeAll: { fontSize: FONT.sizes.sm, color: COLORS.primary, fontWeight: '600' },
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },

  // Calendar nav
  calNav: { flexDirection: 'row', gap: 2 },
  calNavBtn: { padding: 4 },

  // Categories
  catRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { fontSize: FONT.sizes.sm, color: COLORS.text, width: 100 },
  catBarTrack: { flex: 1, height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 3 },
  catAmount: { fontSize: FONT.sizes.sm, fontWeight: '600', color: COLORS.text, width: 70, textAlign: 'right' },

  // Recurring
  recurringCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.xs, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  recurringIcon: { width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: COLORS.primary + '15', alignItems: 'center', justifyContent: 'center' },
  recurringName: { fontSize: FONT.sizes.sm, fontWeight: '600', color: COLORS.text },
  recurringMeta: { fontSize: FONT.sizes.xs, color: COLORS.textMuted, marginTop: 1 },
  recurringAmt: { fontSize: FONT.sizes.sm, fontWeight: '700', color: COLORS.text },
  recurringTotal: { fontSize: FONT.sizes.xs, color: COLORS.textMuted, marginTop: 1 },
  muted: { fontWeight: '400', color: COLORS.textMuted },

  // Recent txns
  emptyState: { padding: SPACING.xl, alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  emptyText: { fontSize: FONT.sizes.sm, color: COLORS.textMuted, textAlign: 'center' },
  txnCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.xs, borderWidth: 1, borderColor: COLORS.border },
  txnInfo: { flex: 1, gap: 3 },
  txnMerchant: { fontSize: FONT.sizes.sm, fontWeight: '600', color: COLORS.text },
  txnRight: { alignItems: 'flex-end', gap: 3 },
  txnAmount: { fontSize: FONT.sizes.sm, fontWeight: '700' },
  txnDate: { fontSize: FONT.sizes.xs, color: COLORS.textMuted },

  // Drill modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  drillSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: 40, maxHeight: '78%' },
  drillHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  drillHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.md },
  drillTitle: { fontSize: FONT.sizes.lg, fontWeight: '700', color: COLORS.text },
  drillSub: { fontSize: FONT.sizes.sm, color: COLORS.textMuted, marginTop: 2 },
  drillRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  drillMerchant: { fontSize: FONT.sizes.sm, fontWeight: '600', color: COLORS.text },
  drillTime: { fontSize: FONT.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
  drillAmt: { fontSize: FONT.sizes.sm, fontWeight: '700' },
});

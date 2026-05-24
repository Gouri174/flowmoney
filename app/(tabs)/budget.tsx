import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useApp } from '@/context/AppContext';
import { COLORS, SPACING, RADIUS, FONT, ALL_CATEGORIES, CATEGORY_COLORS } from '@/constants/theme';
import { formatCurrency } from '@/utils/format';

export default function BudgetScreen() {
  const { transactions, budgets, upsertBudget } = useApp();
  const now = new Date();

  // Month navigation state (1-indexed month)
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewYear, setViewYear] = useState(now.getFullYear());

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCat, setSelectedCat] = useState(ALL_CATEGORIES[0]);
  const [budgetInput, setBudgetInput] = useState('');

  function shiftMonth(delta: number) {
    setViewMonth((m) => {
      let nm = m + delta;
      if (nm < 1) { setViewYear((y) => y - 1); return 12; }
      if (nm > 12) { setViewYear((y) => y + 1); return 1; }
      return nm;
    });
  }

  const isCurrentOrFuture = viewYear > now.getFullYear() ||
    (viewYear === now.getFullYear() && viewMonth >= now.getMonth() + 1);

  const monthBudgets = useMemo(
    () => budgets.filter((b) => b.month === viewMonth && b.year === viewYear),
    [budgets, viewMonth, viewYear]
  );

  const categorySpend = useMemo(() => {
    const map: Record<string, number> = {};
    const start = new Date(viewYear, viewMonth - 1, 1);
    const end = new Date(viewYear, viewMonth, 0, 23, 59, 59);
    transactions
      .filter((t) => t.is_debit && new Date(t.date) >= start && new Date(t.date) <= end)
      .forEach((t) => { map[t.category_name] = (map[t.category_name] ?? 0) + t.amount; });
    return map;
  }, [transactions, viewMonth, viewYear]);

  const totalBudgeted = monthBudgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = Object.values(categorySpend).reduce((s, v) => s + v, 0);
  const overallPct = totalBudgeted > 0 ? totalSpent / totalBudgeted : 0;
  const monthName = new Date(viewYear, viewMonth - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  function openEdit(cat: string) {
    const existing = monthBudgets.find((b) => b.category_name === cat);
    setSelectedCat(cat);
    setBudgetInput(existing ? String(existing.amount) : '');
    setModalVisible(true);
  }

  async function saveBudget() {
    const amount = parseFloat(budgetInput);
    if (!isNaN(amount) && amount > 0) {
      await upsertBudget(selectedCat, amount, viewMonth, viewYear);
    }
    setModalVisible(false);
    setBudgetInput('');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.heading}>Budget</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => { setSelectedCat(ALL_CATEGORIES[0]); setBudgetInput(''); setModalVisible(true); }}>
            <Plus color="#fff" size={20} />
          </TouchableOpacity>
        </View>

        {/* Month navigator */}
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.monthNavBtn} onPress={() => shiftMonth(-1)}>
            <ChevronLeft color={COLORS.primary} size={20} />
          </TouchableOpacity>
          <Text style={styles.monthNavLabel}>{monthName}</Text>
          <TouchableOpacity
            style={styles.monthNavBtn}
            onPress={() => shiftMonth(1)}
            disabled={isCurrentOrFuture}
          >
            <ChevronRight color={isCurrentOrFuture ? COLORS.border : COLORS.primary} size={20} />
          </TouchableOpacity>
        </View>

        {totalBudgeted > 0 && (
          <View style={styles.overviewCard}>
            <View style={styles.overviewRow}>
              <View>
                <Text style={styles.overviewLabel}>Budgeted</Text>
                <Text style={styles.overviewAmount}>{formatCurrency(totalBudgeted)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.overviewLabel}>Spent</Text>
                <Text style={[styles.overviewAmount, { color: overallPct > 1 ? COLORS.error : COLORS.text }]}>
                  {formatCurrency(totalSpent)}
                </Text>
              </View>
            </View>
            <View style={styles.bigBarTrack}>
              <View style={[styles.bigBarFill, {
                width: `${Math.min(100, overallPct * 100)}%`,
                backgroundColor: overallPct >= 1 ? COLORS.error : overallPct >= 0.8 ? COLORS.warning : COLORS.success,
              }]} />
            </View>
            <Text style={styles.overviewPct}>{Math.round(overallPct * 100)}% of total budget used</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Categories</Text>

        {ALL_CATEGORIES.map((cat) => {
          const budget = monthBudgets.find((b) => b.category_name === cat);
          const spent = categorySpend[cat] ?? 0;
          const pct = budget ? Math.min(1, spent / budget.amount) : 0;
          const color = CATEGORY_COLORS[cat] ?? COLORS.textMuted;
          const status = budget ? (pct >= 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok') : 'none';

          return (
            <TouchableOpacity key={cat} style={styles.catCard} onPress={() => openEdit(cat)}>
              <View style={styles.catHeader}>
                <View style={[styles.catDot, { backgroundColor: color }]} />
                <Text style={styles.catName}>{cat}</Text>
                {status === 'over' && <View style={[styles.statusDot, { backgroundColor: COLORS.error }]} />}
                {status === 'warn' && <View style={[styles.statusDot, { backgroundColor: COLORS.warning }]} />}
              </View>
              {budget ? (
                <>
                  <View style={styles.amtRow}>
                    <Text style={[styles.spentAmt, { color: status === 'over' ? COLORS.error : COLORS.text }]}>
                      {formatCurrency(spent)}
                    </Text>
                    <Text style={styles.budgetAmt}>/ {formatCurrency(budget.amount)}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, {
                      width: `${pct * 100}%`,
                      backgroundColor: status === 'over' ? COLORS.error : status === 'warn' ? COLORS.warning : color,
                    }]} />
                  </View>
                  <Text style={styles.pctText}>{Math.round(pct * 100)}% used</Text>
                </>
              ) : (
                <View style={styles.noBudgetRow}>
                  <Text style={styles.noBudgetText}>Tap to set budget</Text>
                  {spent > 0 && <Text style={styles.untracked}>Spent: {formatCurrency(spent)}</Text>}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Set Monthly Budget</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X color={COLORS.textMuted} size={22} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
              <View style={{ flexDirection: 'row', gap: SPACING.xs }}>
                {ALL_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, selectedCat === cat && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                    onPress={() => setSelectedCat(cat)}
                  >
                    <Text style={[styles.catChipText, selectedCat === cat && { color: '#fff' }]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.fieldLabel}>Monthly Limit (₹)</Text>
            <TextInput
              style={styles.amtInput}
              value={budgetInput} onChangeText={setBudgetInput}
              placeholder="e.g. 5000" placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveBudget}>
              <Text style={styles.saveBtnText}>Save Budget</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.md, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  heading: { fontSize: FONT.sizes.xl, fontWeight: '700', color: COLORS.text },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.sm, paddingVertical: 8, marginBottom: SPACING.md },
  monthNavBtn: { padding: 4 },
  monthNavLabel: { fontSize: FONT.sizes.md, fontWeight: '700', color: COLORS.text },
  overviewCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md, gap: SPACING.sm },
  overviewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  overviewLabel: { fontSize: FONT.sizes.xs, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  overviewAmount: { fontSize: FONT.sizes.xl, fontWeight: '700', color: COLORS.text },
  bigBarTrack: { height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden' },
  bigBarFill: { height: '100%', borderRadius: 4 },
  overviewPct: { fontSize: FONT.sizes.xs, color: COLORS.textMuted },
  sectionTitle: { fontSize: FONT.sizes.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  catCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm, gap: 6 },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  catDot: { width: 12, height: 12, borderRadius: 6 },
  catName: { flex: 1, fontSize: FONT.sizes.md, fontWeight: '600', color: COLORS.text },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  amtRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  spentAmt: { fontSize: FONT.sizes.lg, fontWeight: '700' },
  budgetAmt: { fontSize: FONT.sizes.sm, color: COLORS.textMuted },
  barTrack: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  pctText: { fontSize: FONT.sizes.xs, color: COLORS.textMuted },
  noBudgetRow: { flexDirection: 'row', justifyContent: 'space-between' },
  noBudgetText: { fontSize: FONT.sizes.sm, color: COLORS.textMuted },
  untracked: { fontSize: FONT.sizes.sm, color: COLORS.text, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sheetTitle: { fontSize: FONT.sizes.lg, fontWeight: '700', color: COLORS.text },
  fieldLabel: { fontSize: FONT.sizes.sm, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs },
  catChip: { paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  catChipText: { fontSize: FONT.sizes.xs, color: COLORS.textMuted, fontWeight: '600' },
  amtInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, fontSize: FONT.sizes.xl, color: COLORS.text, marginBottom: SPACING.md },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: FONT.sizes.md, fontWeight: '700' },
});

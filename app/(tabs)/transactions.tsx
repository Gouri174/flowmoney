import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X, ChevronDown, Upload, AlertCircle, CheckCircle, Calendar } from 'lucide-react-native';
import { useApp } from '@/context/AppContext';
import { COLORS, SPACING, RADIUS, FONT, ALL_CATEGORIES, CATEGORY_COLORS } from '@/constants/theme';
import { formatCurrency, formatDate, formatTime } from '@/utils/format';
import MerchantIcon from '@/components/MerchantIcon';
import CategoryBadge from '@/components/CategoryBadge';
import type { Transaction } from '@/types/index';
import type { ParsedRow } from '@/services/csvImporter';

type ImportStep = 'idle' | 'picking' | 'preview' | 'importing' | 'done';
type DateRange = '7d' | '30d' | '90d' | 'all';

export default function TransactionsScreen() {
  const { transactions, updateTransactionCategory, pickCsvAndPreview, pickTakeoutAndPreview, importCsvTransactions, importing } = useApp();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [catPickerVisible, setCatPickerVisible] = useState(false);

  // CSV import state
  const [importStep, setImportStep] = useState<ImportStep>('idle');
  const [csvPreview, setCsvPreview] = useState<{ rows: ParsedRow[]; errors: string[]; fileName: string } | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  async function handlePickCsv() {
    setImportStep('picking');
    try {
      const result = await pickCsvAndPreview();
      if (!result) { setImportStep('idle'); return; }
      setCsvPreview(result);
      setImportStep('preview');
    } catch (e) {
      Alert.alert('Error', 'Could not read the file. Please try again.');
      setImportStep('idle');
    }
  }

  async function handlePickTakeout() {
    setImportStep('picking');
    try {
      const result = await pickTakeoutAndPreview();
      if (!result) { setImportStep('idle'); return; }
      setCsvPreview(result);
      setImportStep('preview');
    } catch (e) {
      Alert.alert('Error', 'Could not read the file. Please try again.');
      setImportStep('idle');
    }
  }

  async function handleConfirmImport() {
    if (!csvPreview) return;
    setImportStep('importing');
    const result = await importCsvTransactions(csvPreview.rows);
    setImportResult(result);
    setImportStep('done');
  }

  function closeImport() {
    setImportStep('idle');
    setCsvPreview(null);
    setImportResult(null);
  }

  const filtered = useMemo(() => {
    const now = new Date();
    const cutoff = dateRange === '7d'
      ? new Date(now.getTime() - 7 * 86400000)
      : dateRange === '30d'
      ? new Date(now.getTime() - 30 * 86400000)
      : dateRange === '90d'
      ? new Date(now.getTime() - 90 * 86400000)
      : null;
    return transactions.filter((t) => {
      const matchSearch = !search || t.merchant.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
      const matchCat = !filterCat || t.category_name === filterCat;
      const matchDate = !cutoff || new Date(t.date) >= cutoff;
      return matchSearch && matchCat && matchDate;
    });
  }, [transactions, search, filterCat, dateRange]);

  const methodColor: Record<string, string> = {
    UPI: COLORS.secondary, Card: COLORS.primary, Wallet: COLORS.warning, Bank: COLORS.success,
  };

  async function handleCategoryChange(cat: string) {
    if (!selectedTxn) return;
    await updateTransactionCategory(selectedTxn.id, cat);
    setSelectedTxn((prev) => prev ? { ...prev, category_name: cat } : null);
    setCatPickerVisible(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Transactions</Text>
          <Text style={styles.count}>{filtered.length} records</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity style={styles.importBtn} onPress={handlePickTakeout} disabled={importStep !== 'idle'}>
            <Upload color="#fff" size={14} />
            <Text style={styles.importBtnText}>GPay</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.importBtn, { backgroundColor: COLORS.secondary }]} onPress={handlePickCsv} disabled={importStep !== 'idle'}>
            <Upload color="#fff" size={14} />
            <Text style={styles.importBtnText}>CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Search color={COLORS.textMuted} size={16} />
        <TextInput
          style={styles.searchInput}
          value={search} onChangeText={setSearch}
          placeholder="Search merchant..." placeholderTextColor={COLORS.textMuted}
        />
        {!!search && <TouchableOpacity onPress={() => setSearch('')}><X color={COLORS.textMuted} size={16} /></TouchableOpacity>}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {(['7d', '30d', '90d', 'all'] as DateRange[]).map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, dateRange === r && styles.chipDate]}
            onPress={() => setDateRange(r)}
          >
            <Calendar color={dateRange === r ? '#fff' : COLORS.textMuted} size={10} />
            <Text style={[styles.chipText, dateRange === r && styles.chipTextActive]}>
              {r === '7d' ? '7 days' : r === '30d' ? '30 days' : r === '90d' ? '90 days' : 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {ALL_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, filterCat === cat && styles.chipActive]}
            onPress={() => setFilterCat(filterCat === cat ? null : cat)}
          >
            <Text style={[styles.chipText, filterCat === cat && styles.chipTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No transactions found.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.txnCard} onPress={() => setSelectedTxn(item)}>
            <MerchantIcon merchant={item.merchant} category={item.category_name} />
            <View style={styles.txnInfo}>
              <Text style={styles.txnMerchant} numberOfLines={1}>{item.merchant}</Text>
              <View style={styles.txnMeta}>
                <CategoryBadge category={item.category_name} small />
                <View style={[styles.methodBadge, { borderColor: methodColor[item.payment_method] ?? COLORS.border }]}>
                  <Text style={[styles.methodText, { color: methodColor[item.payment_method] ?? COLORS.textMuted }]}>{item.payment_method}</Text>
                </View>
              </View>
            </View>
            <View style={styles.txnRight}>
              <Text style={[styles.txnAmount, { color: item.is_debit ? COLORS.error : COLORS.success }]}>
                {item.is_debit ? '-' : '+'}{formatCurrency(item.amount)}
              </Text>
              <Text style={styles.txnDate}>{formatDate(item.date)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Detail sheet */}
      <Modal visible={!!selectedTxn} transparent animationType="slide" onRequestClose={() => setSelectedTxn(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSelectedTxn(null)} />
        {selectedTxn && (
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <MerchantIcon merchant={selectedTxn.merchant} category={selectedTxn.category_name} size={56} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetMerchant}>{selectedTxn.merchant}</Text>
                <Text style={styles.sheetDesc} numberOfLines={2}>{selectedTxn.description}</Text>
              </View>
            </View>
            <Text style={[styles.sheetAmount, { color: selectedTxn.is_debit ? COLORS.error : COLORS.success }]}>
              {selectedTxn.is_debit ? '-' : '+'}{formatCurrency(selectedTxn.amount)}
            </Text>
            <View style={styles.detailGrid}>
              {[
                ['Date', formatDate(selectedTxn.date)],
                ['Time', formatTime(selectedTxn.date)],
                ['Method', selectedTxn.payment_method],
                ['Currency', selectedTxn.currency],
              ].map(([label, value]) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{value}</Text>
                </View>
              ))}
            </View>
            <View style={styles.catRow}>
              <Text style={styles.detailLabel}>Category</Text>
              <TouchableOpacity style={styles.catEditBtn} onPress={() => setCatPickerVisible(true)}>
                <CategoryBadge category={selectedTxn.category_name} />
                <ChevronDown color={COLORS.textMuted} size={14} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* Category picker */}
      <Modal visible={catPickerVisible} transparent animationType="slide" onRequestClose={() => setCatPickerVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setCatPickerVisible(false)} />
        <View style={[styles.sheet, { maxHeight: '70%' }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Change Category</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {ALL_CATEGORIES.map((cat) => (
              <TouchableOpacity key={cat} style={styles.catOption} onPress={() => handleCategoryChange(cat)}>
                <View style={[styles.catDot, { backgroundColor: CATEGORY_COLORS[cat] ?? '#999' }]} />
                <Text style={styles.catOptionText}>{cat}</Text>
                {selectedTxn?.category_name === cat && <View style={styles.catCheck} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* CSV Import modal */}
      <Modal
        visible={importStep === 'preview' || importStep === 'importing' || importStep === 'done' || importStep === 'picking'}
        transparent
        animationType="slide"
        onRequestClose={closeImport}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={importStep === 'preview' || importStep === 'done' ? closeImport : undefined} />
        <View style={[styles.sheet, { maxHeight: '80%' }]}>
          <View style={styles.handle} />

          {importStep === 'picking' && (
            <View style={styles.importCenter}>
              <ActivityIndicator color={COLORS.primary} size="large" />
              <Text style={styles.importStatusText}>Reading file…</Text>
            </View>
          )}

          {importStep === 'preview' && csvPreview && (
            <>
              <Text style={styles.sheetTitle}>Import Bank Statement</Text>
              <Text style={styles.importFileName}>{csvPreview.fileName}</Text>

              {csvPreview.errors.length > 0 && (
                <View style={styles.importErrorBox}>
                  <AlertCircle color={COLORS.error} size={16} />
                  <View style={{ flex: 1 }}>
                    {csvPreview.errors.map((e, i) => (
                      <Text key={i} style={styles.importErrorText}>{e}</Text>
                    ))}
                  </View>
                </View>
              )}

              {csvPreview.rows.length > 0 ? (
                <>
                  <Text style={styles.importSummary}>
                    Found <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{csvPreview.rows.length}</Text> transactions
                  </Text>

                  <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                    {csvPreview.rows.slice(0, 10).map((r, i) => (
                      <View key={i} style={styles.previewRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.previewMerchant} numberOfLines={1}>{r.merchant}</Text>
                          <Text style={styles.previewDesc} numberOfLines={1}>{r.description}</Text>
                          <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
                            <View style={[styles.catChip, { backgroundColor: CATEGORY_COLORS[r.category] ?? '#999' }]}>
                              <Text style={styles.catChipText}>{r.category}</Text>
                            </View>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.previewAmt, { color: r.isDebit ? COLORS.error : COLORS.success }]}>
                            {r.isDebit ? '-' : '+'}{formatCurrency(r.amount)}
                          </Text>
                          <Text style={styles.previewDate}>{formatDate(r.date)}</Text>
                        </View>
                      </View>
                    ))}
                    {csvPreview.rows.length > 10 && (
                      <Text style={styles.moreText}>…and {csvPreview.rows.length - 10} more</Text>
                    )}
                  </ScrollView>

                  <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmImport}>
                    <Text style={styles.confirmBtnText}>Import {csvPreview.rows.length} Transactions</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.importCenter}>
                  <AlertCircle color={COLORS.warning} size={32} />
                  <Text style={styles.importStatusText}>No transactions could be parsed from this file.</Text>
                  <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border }]} onPress={closeImport}>
                    <Text style={[styles.confirmBtnText, { color: COLORS.text }]}>Close</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {importStep === 'importing' && (
            <View style={styles.importCenter}>
              <ActivityIndicator color={COLORS.primary} size="large" />
              <Text style={styles.importStatusText}>Importing transactions…</Text>
            </View>
          )}

          {importStep === 'done' && importResult && (
            <View style={styles.importCenter}>
              <CheckCircle color={COLORS.success} size={48} />
              <Text style={[styles.importStatusText, { fontSize: FONT.sizes.lg, fontWeight: '700', color: COLORS.text }]}>
                Import Complete
              </Text>
              <Text style={styles.importStatusText}>
                {importResult.imported} imported · {importResult.skipped} skipped (duplicates)
              </Text>
              <TouchableOpacity style={styles.confirmBtn} onPress={closeImport}>
                <Text style={styles.confirmBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, marginBottom: SPACING.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontSize: FONT.sizes.xl, fontWeight: '700', color: COLORS.text },
  count: { fontSize: FONT.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
  importBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: SPACING.sm, paddingVertical: 7, borderRadius: RADIUS.md },
  importBtnText: { fontSize: FONT.sizes.xs, color: '#fff', fontWeight: '700' },
  importCenter: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxl, gap: SPACING.md },
  importStatusText: { fontSize: FONT.sizes.sm, color: COLORS.textMuted, textAlign: 'center' },
  importFileName: { fontSize: FONT.sizes.sm, color: COLORS.textMuted, marginBottom: SPACING.sm },
  importErrorBox: { flexDirection: 'row', gap: SPACING.xs, backgroundColor: '#2d1515', padding: SPACING.sm, borderRadius: RADIUS.md, marginBottom: SPACING.sm },
  importErrorText: { fontSize: FONT.sizes.xs, color: COLORS.error },
  importSummary: { fontSize: FONT.sizes.sm, color: COLORS.textMuted, marginBottom: SPACING.sm },
  previewRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm },
  previewMerchant: { fontSize: FONT.sizes.sm, fontWeight: '600', color: COLORS.text },
  previewDesc: { fontSize: FONT.sizes.xs, color: COLORS.textMuted },
  previewAmt: { fontSize: FONT.sizes.sm, fontWeight: '700' },
  previewDate: { fontSize: FONT.sizes.xs, color: COLORS.textMuted },
  catChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm },
  catChipText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  moreText: { fontSize: FONT.sizes.xs, color: COLORS.textMuted, textAlign: 'center', paddingVertical: SPACING.sm },
  confirmBtn: { marginTop: SPACING.md, backgroundColor: COLORS.primary, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, alignItems: 'center' },
  confirmBtnText: { fontSize: FONT.sizes.md, color: '#fff', fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, marginHorizontal: SPACING.md, marginBottom: SPACING.sm },
  searchInput: { flex: 1, fontSize: FONT.sizes.sm, color: COLORS.text },
  filterRow: { marginBottom: SPACING.sm, height: 36 },
  filterContent: { gap: SPACING.xs, paddingHorizontal: SPACING.md, alignItems: 'center' },
  chip: { paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipDate: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  chipText: { fontSize: FONT.sizes.xs, color: COLORS.textMuted, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  list: { padding: SPACING.md, paddingBottom: 100, gap: SPACING.xs },
  empty: { padding: SPACING.xxl, alignItems: 'center' },
  emptyText: { fontSize: FONT.sizes.sm, color: COLORS.textMuted },
  txnCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  txnInfo: { flex: 1, gap: 4 },
  txnMerchant: { fontSize: FONT.sizes.sm, fontWeight: '600', color: COLORS.text },
  txnMeta: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  methodBadge: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm },
  methodText: { fontSize: 10, fontWeight: '600' },
  txnRight: { alignItems: 'flex-end', gap: 3 },
  txnAmount: { fontSize: FONT.sizes.sm, fontWeight: '700' },
  txnDate: { fontSize: FONT.sizes.xs, color: COLORS.textMuted },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm },
  sheetMerchant: { fontSize: FONT.sizes.lg, fontWeight: '700', color: COLORS.text },
  sheetDesc: { fontSize: FONT.sizes.sm, color: COLORS.textMuted, marginTop: 2 },
  sheetAmount: { fontSize: FONT.sizes.xxxl, fontWeight: '700', marginBottom: SPACING.md },
  sheetTitle: { fontSize: FONT.sizes.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  detailGrid: { gap: SPACING.xs, marginBottom: SPACING.md },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.xs, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailLabel: { fontSize: FONT.sizes.sm, color: COLORS.textMuted },
  detailValue: { fontSize: FONT.sizes.sm, fontWeight: '600', color: COLORS.text },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  catOption: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  catDot: { width: 12, height: 12, borderRadius: 6 },
  catOptionText: { flex: 1, fontSize: FONT.sizes.md, color: COLORS.text },
  catCheck: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
});

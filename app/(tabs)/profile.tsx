import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, LogOut, Landmark, RefreshCw, ChevronRight, X } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { COLORS, SPACING, RADIUS, FONT } from '@/constants/theme';
import { formatDate } from '@/utils/format';

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const { accounts, syncing, syncTransactions } = useApp();
  const [editVisible, setEditVisible] = useState(false);
  const [nameInput, setNameInput] = useState(profile?.name ?? '');
  const [dailyInput, setDailyInput] = useState(String(profile?.daily_alert_threshold ?? 2000));
  const [largeInput, setLargeInput] = useState(String(profile?.large_expense_threshold ?? 5000));
  const [saving, setSaving] = useState(false);

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    await supabase.from('profiles').update({
      name: nameInput.trim(),
      daily_alert_threshold: parseFloat(dailyInput) || 2000,
      large_expense_threshold: parseFloat(largeInput) || 5000,
    }).eq('id', profile.id);
    await refreshProfile();
    setSaving(false);
    setEditVisible(false);
  }

  const initials = profile?.name ? profile.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '?';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.profileName}>{profile?.name ?? 'User'}</Text>
          <TouchableOpacity style={styles.editProfileBtn} onPress={() => { setNameInput(profile?.name ?? ''); setEditVisible(true); }}>
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Alert settings */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Alert Settings</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Daily Spend Alert</Text>
            <Text style={styles.settingValue}>₹{profile?.daily_alert_threshold?.toLocaleString('en-IN') ?? 2000}</Text>
          </View>
          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.settingLabel}>Large Expense Alert</Text>
            <Text style={styles.settingValue}>₹{profile?.large_expense_threshold?.toLocaleString('en-IN') ?? 5000}</Text>
          </View>
        </View>

        {/* Connected accounts */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Connected Accounts</Text>
            <TouchableOpacity style={styles.syncBtn} onPress={syncTransactions} disabled={syncing}>
              {syncing ? <ActivityIndicator size={14} color={COLORS.primary} /> : <RefreshCw color={COLORS.primary} size={14} />}
              <Text style={styles.syncText}>{syncing ? 'Syncing...' : 'Sync Now'}</Text>
            </TouchableOpacity>
          </View>
          {accounts.length === 0 ? (
            <Text style={styles.noAccounts}>No accounts connected yet. Tap Sync Now to connect.</Text>
          ) : (
            accounts.map((acc) => (
              <View key={acc.id} style={styles.accountRow}>
                <View style={styles.accountIcon}>
                  <Landmark color={COLORS.primary} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accountName}>{acc.account_name}</Text>
                  <Text style={styles.accountMeta}>
                    {acc.masked_number} · Last synced: {acc.last_synced ? formatDate(acc.last_synced) : 'Never'}
                  </Text>
                </View>
                <View style={[styles.accountStatus, { backgroundColor: COLORS.successLight }]}>
                  <Text style={[styles.accountStatusText, { color: COLORS.success }]}>Active</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
          <LogOut color={COLORS.error} size={18} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setEditVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditVisible(false)}><X color={COLORS.textMuted} size={22} /></TouchableOpacity>
            </View>

            {[
              { label: 'Full Name', value: nameInput, setter: setNameInput, kb: 'default' as const },
              { label: 'Daily Spend Alert (₹)', value: dailyInput, setter: setDailyInput, kb: 'numeric' as const },
              { label: 'Large Expense Alert (₹)', value: largeInput, setter: setLargeInput, kb: 'numeric' as const },
            ].map(({ label, value, setter, kb }) => (
              <View key={label} style={styles.field}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={value} onChangeText={setter}
                  keyboardType={kb}
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
            ))}

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saveProfile} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
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
  avatarSection: { alignItems: 'center', marginBottom: SPACING.xl, gap: SPACING.sm },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: FONT.sizes.xxl, fontWeight: '700' },
  profileName: { fontSize: FONT.sizes.xl, fontWeight: '700', color: COLORS.text },
  editProfileBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.primary },
  editProfileText: { fontSize: FONT.sizes.sm, color: COLORS.primary, fontWeight: '600' },
  sectionCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  sectionTitle: { fontSize: FONT.sizes.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  settingLabel: { fontSize: FONT.sizes.sm, color: COLORS.textMuted },
  settingValue: { fontSize: FONT.sizes.sm, fontWeight: '600', color: COLORS.text },
  syncBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.primary + '40', backgroundColor: COLORS.primary + '10' },
  syncText: { fontSize: FONT.sizes.xs, color: COLORS.primary, fontWeight: '600' },
  noAccounts: { fontSize: FONT.sizes.sm, color: COLORS.textMuted, textAlign: 'center', paddingVertical: SPACING.md },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  accountIcon: { width: 36, height: 36, borderRadius: RADIUS.sm, backgroundColor: COLORS.primary + '15', alignItems: 'center', justifyContent: 'center' },
  accountName: { fontSize: FONT.sizes.sm, fontWeight: '600', color: COLORS.text },
  accountMeta: { fontSize: FONT.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
  accountStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  accountStatusText: { fontSize: 10, fontWeight: '700' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.errorLight, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.error + '40' },
  signOutText: { fontSize: FONT.sizes.md, color: COLORS.error, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sheetTitle: { fontSize: FONT.sizes.lg, fontWeight: '700', color: COLORS.text },
  field: { gap: SPACING.xs, marginBottom: SPACING.md },
  fieldLabel: { fontSize: FONT.sizes.sm, fontWeight: '600', color: COLORS.text },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, fontSize: FONT.sizes.md, color: COLORS.text },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: FONT.sizes.md, fontWeight: '700' },
});

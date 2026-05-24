import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Link, router } from 'expo-router';
import { TrendingUp } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { COLORS, SPACING, RADIUS, FONT } from '@/constants/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    setError(null);
    const err = await signIn(email.trim(), password);
    setLoading(false);
    if (err) setError(err);
    else router.replace('/(tabs)');
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <TrendingUp color="#fff" size={28} strokeWidth={2.5} />
          </View>
          <Text style={styles.logoText}>FlowMoney</Text>
        </View>

        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.sub}>Sign in to continue tracking</Text>

        {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail}
            placeholder="you@example.com" placeholderTextColor={COLORS.textMuted}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword}
            placeholder="Your password" placeholderTextColor={COLORS.textMuted} secureTextEntry />
        </View>

        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign In</Text>}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity><Text style={styles.link}>Sign Up</Text></TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.bg },
  container: { flexGrow: 1, padding: SPACING.lg, paddingTop: 72, justifyContent: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xxl },
  logoIcon: { width: 52, height: 52, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: FONT.sizes.xxl, fontWeight: '700', color: COLORS.text },
  heading: { fontSize: FONT.sizes.xxl, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  sub: { fontSize: FONT.sizes.md, color: COLORS.textMuted, marginBottom: SPACING.xl },
  errorBox: { backgroundColor: COLORS.errorLight, borderRadius: RADIUS.sm, padding: SPACING.md, marginBottom: SPACING.md },
  errorText: { color: COLORS.error, fontSize: FONT.sizes.sm },
  field: { gap: SPACING.xs, marginBottom: SPACING.md },
  label: { fontSize: FONT.sizes.sm, fontWeight: '600', color: COLORS.text },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, fontSize: FONT.sizes.md, color: COLORS.text, backgroundColor: COLORS.card },
  btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', marginTop: SPACING.sm },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: FONT.sizes.md, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.lg },
  footerText: { fontSize: FONT.sizes.sm, color: COLORS.textMuted },
  link: { fontSize: FONT.sizes.sm, fontWeight: '700', color: COLORS.primary },
});

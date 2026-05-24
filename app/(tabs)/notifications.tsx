import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, CheckCheck, TriangleAlert as AlertTriangle, CircleCheck, Info, CircleAlert as AlertCircle } from 'lucide-react-native';
import { useApp } from '@/context/AppContext';
import { COLORS, SPACING, RADIUS, FONT } from '@/constants/theme';
import type { AppNotification } from '@/types/index';

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; bg: string; border: string }> = {
  success: { icon: <CircleCheck color={COLORS.success} size={20} />, bg: COLORS.successLight, border: COLORS.success + '40' },
  warning: { icon: <AlertTriangle color={COLORS.warning} size={20} />, bg: COLORS.warningLight, border: COLORS.warning + '40' },
  alert: { icon: <AlertCircle color={COLORS.error} size={20} />, bg: COLORS.errorLight, border: COLORS.error + '40' },
  info: { icon: <Info color={COLORS.primary} size={20} />, bg: COLORS.primary + '15', border: COLORS.primary + '40' },
};

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsScreen() {
  const { notifications, markAllRead, unreadCount } = useApp();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Notifications</Text>
          {unreadCount > 0 && <Text style={styles.unread}>{unreadCount} unread</Text>}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
            <CheckCheck color={COLORS.primary} size={16} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Bell color={COLORS.textLight} size={48} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyText}>Sync your accounts to start receiving alerts.</Text>
          </View>
        }
        renderItem={({ item }: { item: AppNotification }) => {
          const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.info;
          return (
            <View style={[styles.notifCard, !item.is_read && styles.notifUnread, { borderColor: config.border }]}>
              <View style={[styles.notifIcon, { backgroundColor: config.bg }]}>
                {config.icon}
              </View>
              <View style={styles.notifContent}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                <Text style={styles.notifBody}>{item.body}</Text>
                <Text style={styles.notifTime}>{timeSince(item.created_at)}</Text>
              </View>
              {!item.is_read && <View style={styles.unreadDot} />}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, marginBottom: SPACING.xs },
  heading: { fontSize: FONT.sizes.xl, fontWeight: '700', color: COLORS.text },
  unread: { fontSize: FONT.sizes.xs, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.primary + '40', backgroundColor: COLORS.primary + '10' },
  markAllText: { fontSize: FONT.sizes.xs, color: COLORS.primary, fontWeight: '600' },
  list: { padding: SPACING.md, paddingBottom: 100, gap: SPACING.sm },
  empty: { paddingTop: 80, alignItems: 'center', gap: SPACING.sm },
  emptyTitle: { fontSize: FONT.sizes.lg, fontWeight: '700', color: COLORS.text },
  emptyText: { fontSize: FONT.sizes.sm, color: COLORS.textMuted, textAlign: 'center' },
  notifCard: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1 },
  notifUnread: { borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  notifIcon: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  notifContent: { flex: 1, gap: 2 },
  notifTitle: { fontSize: FONT.sizes.sm, fontWeight: '700', color: COLORS.text },
  notifBody: { fontSize: FONT.sizes.sm, color: COLORS.textMuted, lineHeight: 18 },
  notifTime: { fontSize: FONT.sizes.xs, color: COLORS.textLight, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 4 },
});

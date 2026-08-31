// The staff conversations list — shared by the pushed /chat/admin-conversations
// screen (dual-role: a real patient whose Google identity is also bound to a
// web_access_contacts staff row, see CLAUDE.md) and the (staff) tab shell's
// Chat tab (purely-staff TheraHOME accounts). Same query either way —
// useAdminChatThreads is already role-generic via current_web_roles().
import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { useAdminChatThreads, type AdminChatThreadRow } from '@/hooks/useChat';
import { AvatarImg } from '@/components/AvatarImg';
import { timeAgo } from '@/lib/timeAgo';
import { useI18n } from '@/lib/i18n';

export function AdminThreadsList() {
  const theme = useTheme();
  const { t } = useI18n();
  const threadsQuery = useAdminChatThreads();
  const threads = threadsQuery.data ?? [];

  function renderItem({ item }: { item: AdminChatThreadRow }) {
    const unread = item.unreadCount > 0;
    return (
      <Pressable
        onPress={() => router.push({ pathname: '/chat/admin-thread/[threadId]', params: { threadId: item.threadId } })}
        style={[styles.row, { borderBottomColor: theme.colors.divider }]}
      >
        <AvatarImg size={48} uri={item.avatarUrl} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, flex: 1 }, unread ? { fontFamily: theme.fontFamily.bold } : null]}>
              {item.fullName}
            </Text>
            <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>{timeAgo(item.lastMessageAt, t)}</Text>
          </View>
          <View style={styles.previewRow}>
            <Text
              numberOfLines={1}
              style={[
                theme.type.caption,
                { flex: 1, color: unread ? theme.colors.textPrimary : theme.colors.textSecondary },
                unread ? { fontFamily: theme.fontFamily.semiBold } : null,
              ]}
            >
              {item.lastMessage || 'Ảnh'}
            </Text>
            {unread ? (
              <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.badgeText}>{item.unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  }

  if (threadsQuery.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={threads}
      keyExtractor={(item) => item.threadId}
      renderItem={renderItem}
      contentContainerStyle={threads.length ? undefined : styles.center}
      ListEmptyComponent={<Text style={[theme.type.body, { color: theme.colors.textMuted }]}>Chưa có cuộc hội thoại nào.</Text>}
      refreshing={threadsQuery.isRefetching}
      onRefresh={() => void threadsQuery.refetch()}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontFamily: 'System', fontWeight: '700' },
});

// CSKH "Thông báo" tab — broadcast composer + recent campaigns. Mirrors
// TheraHOME WEB's NotificationsAdminView, simplified: no per-product
// targeting (always "all users") for this first mobile pass. See CLAUDE.md.
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/theme';
import {
  useNotificationCampaigns,
  useSendNotificationBroadcast,
  type BroadcastNotificationType,
  type NotificationCampaign,
} from '@/hooks/useNotifications';
import { Button } from '@/components/ui/Button';

const TYPE_OPTIONS: { key: BroadcastNotificationType; label: string }[] = [
  { key: 'blog', label: 'Bài viết' },
  { key: 'schedule', label: 'Lịch tập' },
  { key: 'ad', label: 'Khuyến mãi' },
];

function ComposeForm({ onSent }: { onSent: () => void }) {
  const theme = useTheme();
  const [type, setType] = useState<BroadcastNotificationType>('blog');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const sendBroadcast = useSendNotificationBroadcast();

  async function submit() {
    if (!title.trim() || !body.trim() || sendBroadcast.isPending) return;
    await sendBroadcast.mutateAsync({ type, title: title.trim(), body: body.trim() });
    setTitle('');
    setBody('');
    onSent();
  }

  return (
    <View style={[styles.composeCard, { backgroundColor: theme.colors.bgCard, borderColor: theme.colors.borderLight }]}>
      <View style={styles.typeRow}>
        {TYPE_OPTIONS.map((opt) => {
          const active = type === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setType(opt.key)}
              style={[styles.typeChip, { backgroundColor: active ? theme.colors.primary : theme.colors.bgCardAlt }]}
            >
              <Text style={[theme.type.captionSm, { color: active ? '#fff' : theme.colors.textSecondary, fontFamily: theme.fontFamily.semiBold }]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Tiêu đề thông báo"
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, { borderColor: theme.colors.borderInput, color: theme.colors.textPrimary, backgroundColor: theme.colors.bgApp }]}
      />
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Nội dung thông báo"
        placeholderTextColor={theme.colors.textMuted}
        multiline
        numberOfLines={3}
        style={[styles.input, styles.textArea, { borderColor: theme.colors.borderInput, color: theme.colors.textPrimary, backgroundColor: theme.colors.bgApp }]}
      />
      <Button loading={sendBroadcast.isPending} disabled={!title.trim() || !body.trim()} onPress={submit} style={{ marginTop: 12 }}>
        Gửi đến tất cả người dùng
      </Button>
    </View>
  );
}

function CampaignRow({ campaign }: { campaign: NotificationCampaign }) {
  const theme = useTheme();
  const typeLabel = TYPE_OPTIONS.find((t) => t.key === campaign.type)?.label ?? campaign.type;
  return (
    <View style={[styles.campaignRow, { borderBottomColor: theme.colors.divider }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]} numberOfLines={1}>{campaign.title}</Text>
        <Text style={[theme.type.caption, { color: theme.colors.textSecondary, marginTop: 2 }]} numberOfLines={2}>{campaign.body}</Text>
        <Text style={[theme.type.captionSm, { color: theme.colors.textMuted, marginTop: 4 }]}>
          {typeLabel} · {new Date(campaign.createdAt).toLocaleString('vi-VN')} · {campaign.reach} người nhận
        </Text>
      </View>
    </View>
  );
}

export default function StaffNotificationsTab() {
  const theme = useTheme();
  const campaignsQuery = useNotificationCampaigns();
  const campaigns = campaignsQuery.data ?? [];
  const [composing, setComposing] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bgApp }}>
      <View style={styles.headerRow}>
        <Text style={[theme.type.h2, { color: theme.colors.textPrimary }]}>Thông báo đã gửi</Text>
        <Pressable onPress={() => setComposing((v) => !v)}>
          <Text style={[theme.type.bodyStrong, { color: theme.colors.primary }]}>{composing ? 'Đóng' : '+ Soạn thông báo'}</Text>
        </Pressable>
      </View>
      {composing ? <ComposeForm onSent={() => setComposing(false)} /> : null}
      {campaignsQuery.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => <CampaignRow campaign={item} />}
          contentContainerStyle={campaigns.length ? undefined : styles.center}
          ListEmptyComponent={<Text style={[theme.type.body, { color: theme.colors.textMuted, padding: 16 }]}>Chưa có thông báo nào được gửi.</Text>}
          refreshing={campaignsQuery.isRefetching}
          onRefresh={() => void campaignsQuery.refetch()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  composeCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginHorizontal: 16, marginBottom: 12 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 10 },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  campaignRow: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});

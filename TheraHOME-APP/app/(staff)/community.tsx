// CSKH "Cộng đồng" tab — the content_reports queue (view + resolve/dismiss
// only; hide/delete post/comment and locking a user are admin-only RLS, not
// offered here). See CLAUDE.md and useCommunity.ts's useContentReports.
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { useContentReports, useResolveContentReport, type ContentReportRow } from '@/hooks/useCommunity';
import { Button } from '@/components/ui/Button';

const REPORT_REASON_LABEL: Record<string, string> = {
  spam: 'Spam',
  inappropriate: 'Nội dung không phù hợp',
  harassment: 'Quấy rối',
  other: 'Khác',
};

const STATUS_FILTERS: { key: ContentReportRow['status'] | 'all'; label: string }[] = [
  { key: 'pending', label: 'Đang chờ' },
  { key: 'resolved', label: 'Đã xử lý' },
  { key: 'dismissed', label: 'Đã bỏ qua' },
  { key: 'all', label: 'Tất cả' },
];

function ReportRow({ report }: { report: ContentReportRow }) {
  const theme = useTheme();
  const resolveReport = useResolveContentReport();

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.bgCard, borderColor: theme.colors.borderLight }]}>
      <View style={styles.rowTop}>
        <Text style={[theme.type.captionSm, { color: theme.colors.error, fontFamily: theme.fontFamily.semiBold }]}>
          {REPORT_REASON_LABEL[report.reason] ?? report.reason}
        </Text>
        <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>
          {report.contentType === 'post' ? 'Bài viết' : 'Bình luận'}
        </Text>
      </View>
      <Text numberOfLines={3} style={[theme.type.body, { color: theme.colors.textPrimary, marginTop: 6 }]}>
        {report.contentText ?? 'Nội dung đã bị xoá'}
      </Text>
      {report.contentAuthorName ? (
        <Text style={[theme.type.captionSm, { color: theme.colors.textMuted, marginTop: 4 }]}>
          Tác giả: {report.contentAuthorName}
        </Text>
      ) : null}
      {report.note ? (
        <Text style={[theme.type.caption, { color: theme.colors.textSecondary, marginTop: 4 }]}>Ghi chú: {report.note}</Text>
      ) : null}
      {report.status === 'pending' ? (
        <View style={styles.actionsRow}>
          <Button
            variant="secondary"
            style={{ flex: 1 }}
            loading={resolveReport.isPending}
            onPress={() => resolveReport.mutate({ id: report.id, status: 'dismissed' })}
          >
            Bỏ qua
          </Button>
          <Button
            style={{ flex: 1 }}
            loading={resolveReport.isPending}
            onPress={() => resolveReport.mutate({ id: report.id, status: 'resolved' })}
          >
            Đã xử lý
          </Button>
        </View>
      ) : (
        <Text style={[theme.type.captionSm, { color: theme.colors.textMuted, marginTop: 10 }]}>
          {report.status === 'resolved' ? 'Đã xử lý' : 'Đã bỏ qua'}
        </Text>
      )}
    </View>
  );
}

export default function StaffCommunityTab() {
  const theme = useTheme();
  const reportsQuery = useContentReports();
  const reports = reportsQuery.data ?? [];
  const [filter, setFilter] = useState<ContentReportRow['status'] | 'all'>('pending');

  const filtered = filter === 'all' ? reports : reports.filter((r) => r.status === filter);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bgApp }}>
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Text
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                theme.type.captionSm,
                styles.filterChip,
                {
                  color: active ? '#fff' : theme.colors.textSecondary,
                  backgroundColor: active ? theme.colors.primary : theme.colors.bgCardAlt,
                },
              ]}
            >
              {f.label}
            </Text>
          );
        })}
      </View>
      {reportsQuery.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ReportRow report={item} />}
          contentContainerStyle={filtered.length ? styles.list : styles.center}
          ListEmptyComponent={<Text style={[theme.type.body, { color: theme.colors.textMuted }]}>Không có báo cáo nào.</Text>}
          refreshing={reportsQuery.isRefetching}
          onRefresh={() => void reportsQuery.refetch()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, overflow: 'hidden', fontWeight: '600' },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
});

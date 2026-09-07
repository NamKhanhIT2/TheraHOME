import React from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { useTheme } from '@/theme';
import { useI18n } from '@/lib/i18n';
import { Icon } from '@/components/icons/Icon';
import { ChatMedia } from '@/components/chat/ChatMedia';
import { useChatConnected } from '@/lib/chatConnection';
import type { ChatMessageRow } from '@/hooks/useChat';

/**
 * One message, for both the AI thread and the specialist thread.
 *
 * The two screens had grown separate bubbles: the specialist one with
 * grouping, media, reactions and delivery state, the AI one a plain rounded
 * rectangle with none of it. Same conversation, two different products. This
 * is the one both now render, so anything fixed here is fixed in both.
 *
 * The parts a thread does not use simply are not passed — the AI thread has
 * no reactions and no reply quotes, and nothing here draws them if they are
 * absent.
 */
export function ChatMessageBubble({
  message,
  own,
  quoted,
  emojis,
  showStatus,
  joinsNewer,
  joinsOlder,
  onPress,
  onLongPress,
  onPressReactions,
  onOpenMedia,
  onRetry,
}: {
  message: ChatMessageRow;
  own: boolean;
  /** The message this one replies to, already looked up by the screen. */
  quoted?: ChatMessageRow | null;
  emojis?: string[];
  showStatus?: boolean;
  joinsNewer?: boolean;
  joinsOlder?: boolean;
  onPress?: () => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  onPressReactions?: (event: GestureResponderEvent) => void;
  onOpenMedia?: (uri: string, kind: 'image' | 'video') => void;
  onRetry?: (outboxId: string) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const connected = useChatConnected();

  const sending = message.sendStatus === 'sending';
  const failed = message.sendStatus === 'failed';
  const mediaOnly = !!message.imageUrl && !message.body && !message.replyToMessageId;
  const hasReactions = !!emojis?.length;

  // A send that cannot even start because the socket is down is waiting, not
  // in progress — saying "sending…" for minutes is the wrong promise.
  const statusText = failed
    ? t('msgFailed')
    : sending
      ? (connected ? t('sending') : t('msgQueued'))
      : message.readAt
        ? t('seen')
        : t('delivered');

  return (
    <View style={[styles.wrap, { alignSelf: own ? 'flex-end' : 'flex-start' }]}>
      <View style={[styles.group, hasReactions ? styles.groupWithReaction : undefined]}>
        <Pressable
          onPress={onPress}
          onLongPress={onLongPress}
          delayLongPress={300}
          style={[
            styles.bubble,
            mediaOnly
              ? styles.mediaOnly
              : {
                  backgroundColor: own ? theme.colors.primary : theme.colors.bgCardAlt,
                  borderRadius: 18,
                },
            failed ? { borderWidth: 1, borderColor: theme.colors.error } : null,
            joinsNewer && !mediaOnly ? (own ? styles.joinOwnTop : styles.joinOtherTop) : null,
            joinsOlder && !mediaOnly ? (own ? styles.joinOwnBottom : styles.joinOtherBottom) : null,
          ]}
        >
          {message.replyToMessageId ? (
            <View style={[styles.quote, { borderLeftColor: own ? '#ffffffaa' : theme.colors.primary }]}>
              <Text numberOfLines={2} style={[styles.quoteText, { color: own ? '#ffffffbb' : theme.colors.textSecondary }]}>
                {quoted?.deletedAt ? t('msgDeletedShort') : quoted?.body || (quoted?.imageUrl ? t('image') : t('msgRepliedFallback'))}
              </Text>
            </View>
          ) : null}

          {message.deletedAt ? (
            <Text style={{ color: own ? '#ffffffaa' : theme.colors.textMuted, fontStyle: 'italic' }}>{t('msgDeleted')}</Text>
          ) : (
            <>
              {message.imageUrl ? (
                <View style={message.body ? styles.mediaWithText : undefined}>
                  <ChatMedia
                    uri={message.imageUrl}
                    kind={message.attachmentKind ?? 'image'}
                    cacheKey={sending || failed ? message.imageUrl : message.imageUrl.split('?')[0]}
                    pending={sending}
                    onPress={onOpenMedia ? () => onOpenMedia(message.imageUrl!, message.attachmentKind ?? 'image') : undefined}
                  />
                </View>
              ) : null}
              {message.body ? (
                <Text style={[theme.type.body, { color: own ? '#fff' : theme.colors.textPrimary }]}>{message.body}</Text>
              ) : null}
            </>
          )}
        </Pressable>

        {hasReactions ? (
          <Pressable
            onPress={onPressReactions}
            style={[
              styles.reactions,
              own ? styles.reactionsOwn : styles.reactionsOther,
              { backgroundColor: theme.colors.bgCard, borderColor: theme.colors.divider },
            ]}
          >
            <Text style={styles.reactionText}>{emojis!.join(' ')}</Text>
          </Pressable>
        ) : null}
      </View>

      {own && (showStatus || sending || failed) ? (
        <View style={styles.statusRow}>
          <Text style={[styles.status, { color: failed ? theme.colors.error : theme.colors.textMuted }]}>
            {statusText}
            {message.editedAt && !failed && !sending ? ` · ${t('edited')}` : ''}
          </Text>
          {failed && message.outboxId && onRetry ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('a11yRetrySend')}
              hitSlop={8}
              onPress={() => onRetry(message.outboxId!)}
              style={styles.retry}
            >
              <Icon name="refresh-cw" size={11} color={theme.colors.primary} />
              <Text style={[styles.status, { color: theme.colors.primary }]}>{t('retry')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { maxWidth: '82%', marginVertical: 1, alignItems: 'flex-start' },
  group: { position: 'relative', alignSelf: 'flex-start' },
  groupWithReaction: { paddingBottom: 14 },
  bubble: { alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 13 },
  mediaOnly: { paddingHorizontal: 0, paddingVertical: 0, backgroundColor: 'transparent', borderRadius: 16, overflow: 'hidden' },
  mediaWithText: { marginBottom: 5 },
  joinOwnTop: { borderTopRightRadius: 5 },
  joinOwnBottom: { borderBottomRightRadius: 5 },
  joinOtherTop: { borderTopLeftRadius: 5 },
  joinOtherBottom: { borderBottomLeftRadius: 5 },
  quote: { borderLeftWidth: 3, paddingLeft: 8, marginBottom: 7 },
  quoteText: { fontSize: 12, lineHeight: 16 },
  reactions: { position: 'absolute', bottom: 0, borderWidth: 1, borderRadius: 11, paddingHorizontal: 5, paddingVertical: 1 },
  reactionsOwn: { right: 8 },
  reactionsOther: { left: 8 },
  reactionText: { fontSize: 11 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-end', paddingRight: 2 },
  status: { fontSize: 10, lineHeight: 14 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});

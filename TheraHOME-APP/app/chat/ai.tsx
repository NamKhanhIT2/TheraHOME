import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useChatThread, useChatMessages, useAISuggestedReplies, type ChatMessageRow } from '@/hooks/useChat';
import { useChatOutbox } from '@/hooks/useChatOutbox';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Icon } from '@/components/icons/Icon';
import { Button } from '@/components/ui/Button';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { ChatComposer, type ChatComposerHandle } from '@/components/chat/ChatComposer';
import { ChatOfflineBanner } from '@/components/chat/ChatOfflineBanner';
import { resetChatChannelStatus } from '@/lib/chatConnection';
import { useAppStore } from '@/store/useAppStore';
import { useI18n } from '@/lib/i18n';
import { CHAT_FOLLOW_NEW_MESSAGES } from '@/lib/chatListProps';

// Localized at render — see t('aiGreeting').
const AI_ASSISTANT_IMAGE = require('../../assets/ai-assistant.png');

export default function AIChatScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { session } = useSession();
  const userId = session?.user.id;
  // App Review: chat content is processed by a third-party AI service, so
  // the user must be told what is sent and agree before first use. The
  // flag is persisted — the notice shows exactly once.
  const aiConsentAccepted = useAppStore((state) => state.aiConsentAccepted);
  const acceptAiConsent = useAppStore((state) => state.acceptAiConsent);

  const threadQuery = useChatThread('ai', userId);
  const threadId = threadQuery.data;
  const messagesQuery = useChatMessages(threadId);
  const messages = useMemo(() => messagesQuery.data?.pages.flatMap((page) => page.messages) ?? [], [messagesQuery.data]);
  const outbox = useChatOutbox(threadId, userId, 'ai');
  const items = useMemo(() => [...outbox.rows, ...messages], [outbox.rows, messages]);
  const suggestions = useAISuggestedReplies().data ?? [];

  const [text, setText] = useState('');
  const composerRef = useRef<ChatComposerHandle>(null);
  const listRef = useRef<FlatList<ChatMessageRow>>(null);
  const latestOwnId = messages.find((message) => message.senderType === 'user' && !message.deletedAt)?.id;

  useEffect(() => resetChatChannelStatus, []);

  /** Queues and returns. The assistant may still be composing an answer to
   * the previous question — that is no reason to refuse this one. */
  function send(value?: string) {
    const body = (value ?? text).trim();
    if (!body || !threadId || !userId) return;
    if (value === undefined) setText('');
    composerRef.current?.closeEmojis();
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
    outbox.send({ body });
  }

  const loading = threadQuery.isPending || messagesQuery.isPending;

  function renderMessage({ item: message, index }: { item: ChatMessageRow; index: number }) {
    const newerMessage = index > 0 ? items[index - 1] : null;
    const olderMessage = index < items.length - 1 ? items[index + 1] : null;
    return (
      <ChatMessageBubble
        message={message}
        own={message.senderType === 'user'}
        showStatus={message.id === latestOwnId}
        joinsNewer={newerMessage?.senderType === message.senderType}
        joinsOlder={olderMessage?.senderType === message.senderType}
        onRetry={outbox.retry}
      />
    );
  }

  const greeting = (
    <View style={[styles.greeting, { backgroundColor: theme.colors.bgCardAlt }]}>
      <Text style={[theme.type.body, { color: theme.colors.textPrimary }]}>{t('aiGreeting')}</Text>
    </View>
  );

  return (
    <ScreenContainer>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={[styles.header, { borderBottomColor: theme.colors.divider }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Icon name="chevron-left" size={22} color={theme.colors.textPrimary} />
          </Pressable>
          <Image source={AI_ASSISTANT_IMAGE} style={styles.avatar} resizeMode="cover" />
          <View>
            <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, fontFamily: theme.fontFamily.bold }]}>
              {t('aiAssistant')}
            </Text>
            <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>
              {outbox.aiReplying ? t('aiTyping') : t('aiInstantNoDoctor')}
            </Text>
          </View>
        </View>

        {aiConsentAccepted ? <ChatOfflineBanner /> : null}

        {!aiConsentAccepted ? (
          <View style={styles.consentBox}>
            <View style={[styles.consentCard, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}>
              <View style={[styles.consentIcon, { backgroundColor: theme.colors.primaryTint10 }]}>
                <Icon name="shield-check" size={24} color={theme.colors.primary} />
              </View>
              <Text style={[theme.type.h2, { color: theme.colors.textPrimary, textAlign: 'center' }]}>{t('aiConsentTitle')}</Text>
              <Text style={[theme.type.caption, { color: theme.colors.textSecondary, lineHeight: 20, marginTop: 8 }]}>
                {t('aiConsentBody')}
              </Text>
              <Pressable onPress={() => router.push({ pathname: '/profile/legal/[doc]', params: { doc: 'privacy' } })} hitSlop={6}>
                <Text style={[theme.type.caption, { color: theme.colors.primary, marginTop: 10, fontFamily: theme.fontFamily.semiBold }]}>
                  {t('viewPrivacy')}
                </Text>
              </Pressable>
              <Button style={{ width: '100%', marginTop: 16 }} onPress={acceptAiConsent}>
                {t('aiConsentAgree')}
              </Button>
            </View>
          </View>
        ) : loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            inverted
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.body}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            maintainVisibleContentPosition={CHAT_FOLLOW_NEW_MESSAGES}
            onTouchStart={() => composerRef.current?.closeEmojis()}
            onScrollBeginDrag={() => composerRef.current?.closeEmojis()}
            onEndReached={() => {
              if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) void messagesQuery.fetchNextPage();
            }}
            onEndReachedThreshold={0.2}
            ListHeaderComponent={
              outbox.aiReplying ? (
                <View style={[styles.typing, { backgroundColor: theme.colors.bgCardAlt }]}>
                  {[0, 1, 2].map((i) => (
                    <View key={i} style={[styles.typingDot, { backgroundColor: theme.colors.textMuted }]} />
                  ))}
                  <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>{t('aiTyping')}</Text>
                </View>
              ) : outbox.aiFailed ? (
                <Pressable onPress={() => void outbox.retryAIReply()} style={[styles.typing, { backgroundColor: theme.colors.errorTint }]}>
                  <Text style={[theme.type.captionSm, { color: theme.colors.error }]}>{t('aiReplyFailed')}</Text>
                  <Icon name="refresh-cw" size={12} color={theme.colors.error} />
                  <Text style={[theme.type.captionSm, { color: theme.colors.error, fontFamily: theme.fontFamily.semiBold }]}>{t('retry')}</Text>
                </Pressable>
              ) : null
            }
            ListFooterComponent={
              messagesQuery.isFetchingNextPage ? (
                <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 8 }} />
              ) : !messagesQuery.hasNextPage && items.length > 0 ? (
                greeting
              ) : null
            }
            ListEmptyComponent={
              <View style={{ gap: 10 }}>
                {greeting}
                <View style={styles.suggestions}>
                  {suggestions.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => send(s.text)}
                      style={[styles.suggestionChip, { borderColor: theme.colors.borderInput, backgroundColor: theme.colors.bgCard }]}
                    >
                      <Text style={[theme.type.captionSm, { color: theme.colors.primary }]}>{s.text}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            }
          />
        )}

        {aiConsentAccepted ? (
          <>
            <Pressable onPress={() => router.push('/chat/human')} style={styles.escalateBtn}>
              <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary, textDecorationLine: 'underline' }]}>
                {t('aiNeedHuman')}
              </Text>
            </Pressable>
            <ChatComposer
              ref={composerRef}
              value={text}
              onChangeValue={setText}
              onSend={() => send()}
              placeholder={t('aiInputPlaceholder')}
            />
          </>
        ) : null}
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  consentBox: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  consentCard: {
    alignItems: 'center',
    padding: 22,
  },
  consentIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 4,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 2,
    flexGrow: 1,
    // 'flex-end' on an inverted list is the visual TOP — see human.tsx.
    justifyContent: 'flex-end',
  },
  greeting: {
    alignSelf: 'flex-start',
    maxWidth: '82%',
    borderRadius: 18,
    paddingVertical: 9,
    paddingHorizontal: 13,
    marginTop: 6,
  },
  typing: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 18,
    paddingVertical: 9,
    paddingHorizontal: 13,
    marginBottom: 6,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.5,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  escalateBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
});

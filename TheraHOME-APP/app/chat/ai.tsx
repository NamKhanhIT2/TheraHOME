import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useChatThread, useChatMessages, useSendChatMessage, useAISuggestedReplies, type ChatMessageRow } from '@/hooks/useChat';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Icon } from '@/components/icons/Icon';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/useAppStore';
import { useI18n } from '@/lib/i18n';

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
  const sendMessage = useSendChatMessage(threadId, userId, 'ai');
  const suggestions = useAISuggestedReplies().data ?? [];

  const [text, setText] = useState('');

  function send(value?: string) {
    const v = (value ?? text).trim();
    if (!v || sendMessage.isPending) return;
    setText('');
    sendMessage.mutate(v);
  }

  const loading = threadQuery.isPending || messagesQuery.isPending;

  function renderMessage({ item: m }: { item: ChatMessageRow }) {
    const own = m.senderType === 'user';
    return (
      <View
        style={[
          styles.bubble,
          theme.shadows.card,
          {
            alignSelf: own ? 'flex-end' : 'flex-start',
            backgroundColor: own ? theme.colors.primary : theme.colors.bgCard,
            borderRadius: theme.radius.md,
          },
        ]}
      >
        <Text style={[theme.type.body, { color: own ? '#fff' : theme.colors.textPrimary }]}>{m.body}</Text>
      </View>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { borderBottomColor: theme.colors.divider }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Icon name="chevron-left" size={22} color={theme.colors.textPrimary} />
          </Pressable>
          <Image source={AI_ASSISTANT_IMAGE} style={styles.avatar} resizeMode="cover" />
          <View>
            <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, fontFamily: theme.fontFamily.bold }]}>
              Trợ lý AI TheraHOME
            </Text>
            <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>Trả lời tức thì · Không thay thế bác sĩ</Text>
          </View>
        </View>

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
            inverted
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.body}
            onEndReached={() => {
              if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) void messagesQuery.fetchNextPage();
            }}
            onEndReachedThreshold={0.2}
            ListHeaderComponent={
              sendMessage.isPending ? (
                <View style={[styles.bubble, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.md, flexDirection: 'row', gap: 4, alignSelf: 'flex-start' }]}>
                  {[0, 1, 2].map((i) => (
                    <View key={i} style={[styles.typingDot, { backgroundColor: theme.colors.textMuted }]} />
                  ))}
                </View>
              ) : null
            }
            ListFooterComponent={
              messagesQuery.isFetchingNextPage ? (
                <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 8 }} />
              ) : !messagesQuery.hasNextPage && messages.length > 0 ? (
                <View
                  style={[
                    styles.bubble,
                    theme.shadows.card,
                    { alignSelf: 'flex-start', backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.md },
                  ]}
                >
                  <Text style={[theme.type.body, { color: theme.colors.textPrimary }]}>{t('aiGreeting')}</Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={{ gap: 10 }}>
                <View
                  style={[
                    styles.bubble,
                    theme.shadows.card,
                    { alignSelf: 'flex-start', backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.md },
                  ]}
                >
                  <Text style={[theme.type.body, { color: theme.colors.textPrimary }]}>{t('aiGreeting')}</Text>
                </View>
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
            Cần hỗ trợ trực tiếp? Chat với đội ngũ TheraHOME
          </Text>
        </Pressable>

        <View style={[styles.inputRow, { borderTopColor: theme.colors.divider }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => send()}
            placeholder="Nhập câu hỏi..."
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.input, { borderColor: theme.colors.borderInput, borderRadius: theme.radius.full, color: theme.colors.textPrimary }]}
          />
          <Pressable onPress={() => send()} style={[styles.sendBtn, { backgroundColor: theme.colors.primary }]}>
            <Icon name="send" size={16} color="#fff" />
          </Pressable>
        </View>
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
    padding: 20,
    gap: 10,
    flexGrow: 1,
  },
  bubble: {
    maxWidth: '78%',
    paddingVertical: 10,
    paddingHorizontal: 14,
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

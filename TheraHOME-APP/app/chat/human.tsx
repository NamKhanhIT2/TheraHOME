import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { markSpecialistMessagesRead, toggleChatReaction, useChatMessages, useChatThread, useSpecialistPresence, type ChatMessageRow } from '@/hooks/useChat';
import { useChatOutbox } from '@/hooks/useChatOutbox';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Icon } from '@/components/icons/Icon';
import { OnlineIndicator } from '@/components/AssistantBubble';
import { useI18n } from '@/lib/i18n';
import { useAppStore } from '@/store/useAppStore';
import { ChatMediaViewer } from '@/components/ChatMediaViewer';
import { ReactionAsset } from '@/components/ReactionAsset';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { ChatComposer, type ChatComposerHandle } from '@/components/chat/ChatComposer';
import { ChatOfflineBanner } from '@/components/chat/ChatOfflineBanner';
import { resetChatChannelStatus } from '@/lib/chatConnection';
import { hapticConfirm, hapticPressHold } from '@/lib/haptics';
import { CHAT_FOLLOW_NEW_MESSAGES } from '@/lib/chatListProps';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const TIME_LOCALE: Record<string, string> = { vi: 'vi-VN', en: 'en-GB', ms: 'ms-MY' };
const timeOf = (value: string) => new Date(value).toLocaleTimeString(TIME_LOCALE[useAppStore.getState().language] ?? 'vi-VN', { hour: '2-digit', minute: '2-digit' });
const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const CHAT_SESSION_GAP_MS = 30 * 60 * 1000;
const SPECIALIST_IMAGE = require('../../assets/therahome-specialist.png');

export default function HumanChatScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const userId = useSession().session?.user.id;
  const specialistOnline = useSpecialistPresence();
  const threadQuery = useChatThread('human', userId);
  const threadId = threadQuery.data;
  const messagesQuery = useChatMessages(threadId);
  const messages = useMemo(() => messagesQuery.data?.pages.flatMap((page) => page.messages) ?? [], [messagesQuery.data]);
  const outbox = useChatOutbox(threadId, userId, 'human');
  // Queued and failed sends sit at the head of the inverted list, exactly
  // where the server row will appear once it lands, so a message never jumps
  // position when it finally goes out.
  const items = useMemo(() => [...outbox.rows, ...messages], [outbox.rows, messages]);
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessageRow | null>(null);
  const [actionMessage, setActionMessage] = useState<ChatMessageRow | null>(null);
  const [actionOrigin, setActionOrigin] = useState<{ x: number; y: number } | null>(null);
  const [reactionOverrides, setReactionOverrides] = useState<Record<string, string | null>>({});
  const [viewer, setViewer] = useState<{ uri: string; kind: 'image' | 'video' } | null>(null);
  const composerRef = useRef<ChatComposerHandle>(null);
  const listRef = useRef<FlatList<ChatMessageRow>>(null);
  const markingReadRef = useRef<string | null>(null);
  const reactionVersionRef = useRef<Record<string, number>>({});
  const lastTapRef = useRef<{ id: string; at: number } | null>(null);
  const lastSendAtRef = useRef(0);
  const latestOwnId = messages.find((message) => message.senderType === 'user' && !message.deletedAt)?.id;
  const unreadSpecialistIds = messages
    .filter((message) => message.senderType === 'specialist' && !message.readAt)
    .map((message) => message.id)
    .join(',');

  useEffect(() => {
    if (!threadId || !unreadSpecialistIds || markingReadRef.current === unreadSpecialistIds) return;
    markingReadRef.current = unreadSpecialistIds;
    markSpecialistMessagesRead(threadId)
      .catch(() => undefined)
      .finally(() => { markingReadRef.current = null; });
  }, [threadId, unreadSpecialistIds]);

  // Leaving the thread must not strand the connection notice for whatever
  // screen mounts next.
  useEffect(() => resetChatChannelStatus, []);

  async function pickMedia() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert(t('photoPermissionTitle'), t('chatPhotoPermissionBody'));
    const options = { mediaTypes: ['images', 'videos'] as ImagePicker.MediaType[], quality: 0.82 };
    const result = await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled) setAttachment(result.assets[0]);
  }

  function scrollToLatest() {
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
  }

  /** Never blocked on a send already in flight: each one queues on its own,
   * so a second message simply lines up behind the first. */
  function submit() {
    const body = text.trim();
    if ((!body && !attachment) || !threadId || !userId) return;
    const selected = attachment;
    setText('');
    setAttachment(null);
    setReplyingTo(null);
    composerRef.current?.closeEmojis();
    lastSendAtRef.current = Date.now();
    scrollToLatest();
    outbox.send({
      body,
      replyToMessageId: replyingTo?.id,
      ...(selected
        ? {
            attachmentLocalUri: selected.uri,
            attachmentKind: selected.type === 'video' ? ('video' as const) : ('image' as const),
            attachmentMimeType: selected.mimeType,
            attachmentWidth: selected.width,
            attachmentHeight: selected.height,
          }
        : {}),
    });
  }

  function sendQuickLike() {
    if (!threadId || !userId) return;
    // The composer empties the instant a message is queued, which turns this
    // same button into the quick-like. A second tap meant as "send" would
    // then post a 👍 nobody asked for — the old code was saved from that only
    // by disabling the button while a send was in flight, which is exactly
    // what had to go so a reply never blocks the next message.
    if (Date.now() - lastSendAtRef.current < 600) return;
    scrollToLatest();
    outbox.send({ body: '👍' });
  }

  async function action(type: 'reply' | 'copy') {
    const message = actionMessage;
    setActionMessage(null);
    setActionOrigin(null);
    if (!message) return;
    if (type === 'reply') { setReplyingTo(message); requestAnimationFrame(() => composerRef.current?.focus()); }
    if (type === 'copy' && message.body) await Clipboard.setStringAsync(message.body);
  }

  function displayedReactions(message: ChatMessageRow): ChatMessageRow['reactions'] {
    if (!userId || !Object.prototype.hasOwnProperty.call(reactionOverrides, message.id)) return message.reactions;
    const ownEmoji = reactionOverrides[message.id];
    const existingOwn = message.reactions.find((item) => item.userId === userId);
    return [
      ...message.reactions.filter((item) => item.userId !== userId),
      ...(ownEmoji ? [{ id: existingOwn?.id ?? `optimistic-${message.id}`, userId, emoji: ownEmoji }] : []),
    ];
  }

  function react(message: ChatMessageRow, emoji: string) {
    if (!userId) return;
    hapticConfirm();
    setActionMessage(null);
    setActionOrigin(null);
    const currentlyDisplayed = displayedReactions(message).find((item) => item.userId === userId);
    const currentServerReaction = message.reactions.find((item) => item.userId === userId);
    const nextEmoji = currentlyDisplayed?.emoji === emoji ? null : emoji;
    const version = (reactionVersionRef.current[message.id] ?? 0) + 1;
    reactionVersionRef.current[message.id] = version;

    // Retain this local choice until the screen is left.  Realtime updates can
    // arrive between deleting the old reaction and inserting the new one; an
    // own-reaction override prevents the UI from briefly reverting to the old
    // emoji during that window.
    setReactionOverrides((previous) => ({ ...previous, [message.id]: nextEmoji }));
    void toggleChatReaction(message.id, userId, emoji, currentServerReaction)
      .then(() => messagesQuery.refetch())
      .catch(() => {
        if (reactionVersionRef.current[message.id] !== version) return;
        setReactionOverrides((previous) => {
          const { [message.id]: _failed, ...remaining } = previous;
          return remaining;
        });
        Alert.alert(t('reactFail'));
      });
  }

  function handleBubbleTap(message: ChatMessageRow) {
    // A message that has not reached the server yet cannot carry a reaction.
    if (message.outboxId) return;
    const now = Date.now();
    if (lastTapRef.current?.id === message.id && now - lastTapRef.current.at < 280) {
      lastTapRef.current = null;
      react(message, '❤️');
      return;
    }
    lastTapRef.current = { id: message.id, at: now };
  }

  function renderMessage({ item: message, index }: { item: ChatMessageRow; index: number }) {
    const own = message.senderType === 'user';
    const quoted = items.find((item) => item.id === message.replyToMessageId) ?? null;
    const visibleReactions = displayedReactions(message);
    const emojis = Array.from(new Set(visibleReactions.map((item) => item.emoji)));
    const newerMessage = index > 0 ? items[index - 1] : null;
    const olderMessage = index < items.length - 1 ? items[index + 1] : null;
    const isSessionEnd = newerMessage
      ? new Date(newerMessage.createdAt).getTime() - new Date(message.createdAt).getTime() >= CHAT_SESSION_GAP_MS
      : Date.now() - new Date(message.createdAt).getTime() >= CHAT_SESSION_GAP_MS;
    return (
      <View style={styles.messageRow}>
        <ChatMessageBubble
          message={message}
          own={own}
          quoted={quoted}
          emojis={emojis}
          showStatus={message.id === latestOwnId}
          joinsNewer={newerMessage?.senderType === message.senderType}
          joinsOlder={olderMessage?.senderType === message.senderType}
          onPress={() => handleBubbleTap(message)}
          onLongPress={message.outboxId ? undefined : (event) => {
            hapticPressHold();
            setActionOrigin({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
            setActionMessage(message);
          }}
          onPressReactions={(event) => {
            setActionOrigin({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
            setActionMessage(message);
          }}
          onOpenMedia={(uri, kind) => setViewer({ uri, kind })}
          onRetry={outbox.retry}
        />
        {isSessionEnd ? <Text style={[styles.messageTime, { color: theme.colors.textMuted }]}>{timeOf(message.createdAt)}</Text> : null}
      </View>
    );
  }

  const actionOwn = actionMessage?.senderType === 'user';
  const actionTop = actionOrigin ? Math.max(30, Math.min(actionOrigin.y - 72, WINDOW_HEIGHT - 240)) : 30;
  const selectedActionEmoji = actionMessage && userId
    ? displayedReactions(actionMessage).find((item) => item.userId === userId)?.emoji
    : null;
  return (
    <ScreenContainer>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={[styles.header, { borderBottomColor: theme.colors.divider }]}><Pressable onPress={() => router.back()}><Icon name="chevron-left" size={22} color={theme.colors.textPrimary} /></Pressable><Image source={SPECIALIST_IMAGE} style={styles.avatar} resizeMode="cover" /><View><Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{t('supportTeamName')}</Text><OnlineIndicator online={specialistOnline} /></View></View>
        <ChatOfflineBanner />
        {threadQuery.isPending || messagesQuery.isPending ? <View style={styles.loading}><ActivityIndicator color={theme.colors.primary} /></View> : <FlatList ref={listRef} inverted data={items} keyExtractor={(item) => item.id} renderItem={renderMessage} contentContainerStyle={styles.body} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" maintainVisibleContentPosition={CHAT_FOLLOW_NEW_MESSAGES} onTouchStart={() => composerRef.current?.closeEmojis()} onScrollBeginDrag={() => composerRef.current?.closeEmojis()} onEndReached={() => { if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) void messagesQuery.fetchNextPage(); }} onEndReachedThreshold={0.2} ListHeaderComponent={<View style={styles.listBottomSpacer} />} ListFooterComponent={messagesQuery.isFetchingNextPage ? <ActivityIndicator color={theme.colors.primary} /> : null} ListEmptyComponent={<Text style={{ color: theme.colors.textMuted, textAlign: 'center' }}>{t('chatEmptyHint')}</Text>} />}
        <ChatComposer
          ref={composerRef}
          value={text}
          onChangeValue={setText}
          onSend={submit}
          placeholder="Aa"
          emptyAction={{ kind: 'like', onPress: sendQuickLike }}
          attachment={attachment ? { uri: attachment.uri, kind: attachment.type === 'video' ? 'video' : 'image' } : null}
          onPickMedia={() => void pickMedia()}
          onRemoveAttachment={() => setAttachment(null)}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
        {viewer ? <ChatMediaViewer uri={viewer.uri} kind={viewer.kind} onClose={() => setViewer(null)} /> : null}
        <Modal visible={!!actionMessage} transparent animationType="none" onRequestClose={() => { setActionMessage(null); setActionOrigin(null); }}><Pressable style={styles.backdrop} onPress={() => { setActionMessage(null); setActionOrigin(null); }}><View style={[styles.actionContent, { top: actionTop, ...(actionOwn ? { right: 16 } : { left: 16 }) }]}><View style={[styles.reactionBar, { backgroundColor: theme.colors.bgCard }]}>{REACTIONS.map((emoji) => <Pressable key={emoji} style={[styles.reactionChoice, selectedActionEmoji === emoji ? { backgroundColor: theme.colors.bgCardAlt } : undefined]} onPress={() => actionMessage && void react(actionMessage, emoji)}><ReactionAsset emoji={emoji} size={29} /></Pressable>)}</View><View style={[styles.sheet, { backgroundColor: theme.colors.bgCard }]}><ActionRow icon="message-circle" text={t('reply')} onPress={() => void action('reply')} /><ActionRow icon="copy" text={t('copyText')} onPress={() => void action('copy')} /></View></View></Pressable></Modal>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function ActionRow({ icon, text, onPress }: { icon: string; text: string; onPress: () => void }) { const theme = useTheme(); return <Pressable style={styles.actionRow} onPress={onPress}><Icon name={icon} size={19} color={theme.colors.textPrimary} /><Text style={[theme.type.body, { color: theme.colors.textPrimary }]}>{text}</Text></Pressable>; }

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10, paddingTop: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#14161F', alignItems: 'center', justifyContent: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // justifyContent on an INVERTED list reads upside down: 'flex-end' is the
  // visual TOP. Without it a short thread sat pinned to the bottom of the
  // screen with a screenful of empty space above it (owner, 2026-09-07).
  // Messages, Telegram and WhatsApp all fill from the top and only start
  // scrolling once the thread outgrows the screen — which is exactly what
  // this gives, since flexGrow/justifyContent stop mattering the moment the
  // content is taller than the viewport.
  body: { paddingHorizontal: 12, paddingVertical: 14, gap: 2, flexGrow: 1, justifyContent: 'flex-end' },
  messageRow: { width: '100%' },
  messageTime: { alignSelf: 'center', fontSize: 10, lineHeight: 14, marginVertical: 3 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.24)' },
  actionContent: { position: 'absolute', gap: 12, alignItems: 'flex-end' },
  reactionBar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 40, paddingHorizontal: 14, paddingVertical: 11 },
  reactionChoice: { borderRadius: 20, padding: 2 },
  sheet: { width: 230, borderRadius: 20, overflow: 'hidden' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D5D9E0' },
  listBottomSpacer: { height: 8 },
});

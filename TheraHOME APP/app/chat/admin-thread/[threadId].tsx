// Admin/cskh side of a patient↔specialist thread — reached from
// /chat/admin-conversations (never from the patient app, which always goes
// straight to /chat/human). Mirrors app/chat/human.tsx's message UI, but
// "own" flips to sender_type: 'specialist' and sending posts as the
// specialist instead of the patient. See CLAUDE.md.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { markUserMessagesRead, toggleChatReaction, uploadChatAttachment, useChatMessages, useChatThreadPatient, useSendChatMessage, type ChatMessageRow } from '@/hooks/useChat';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Icon } from '@/components/icons/Icon';
import { AvatarImg } from '@/components/AvatarImg';
import { ChatMediaViewer } from '@/components/ChatMediaViewer';
import { ReactionAsset } from '@/components/ReactionAsset';
import { hapticConfirm, hapticPressHold } from '@/lib/haptics';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const COMPOSER_EMOJIS = ['😀', '😂', '🥰', '👍', '🙏', '❤️', '🎉', '💪'];
const timeOf = (value: string) => new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const CHAT_SESSION_GAP_MS = 30 * 60 * 1000;

export default function AdminChatThreadScreen() {
  const theme = useTheme();
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const staffUserId = useSession().session?.user.id;
  const patientQuery = useChatThreadPatient(threadId);
  const messagesQuery = useChatMessages(threadId);
  const messages = useMemo(() => messagesQuery.data?.pages.flatMap((page) => page.messages) ?? [], [messagesQuery.data]);
  const sendMessage = useSendChatMessage(threadId, staffUserId, 'human', 'specialist');
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessageRow | null>(null);
  const [actionMessage, setActionMessage] = useState<ChatMessageRow | null>(null);
  const [actionOrigin, setActionOrigin] = useState<{ x: number; y: number } | null>(null);
  const [reactionOverrides, setReactionOverrides] = useState<Record<string, string | null>>({});
  const [showEmojis, setShowEmojis] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewer, setViewer] = useState<{ uri: string; kind: 'image' | 'video' } | null>(null);
  const inputRef = useRef<TextInput>(null);
  const markingReadRef = useRef<string | null>(null);
  const reactionVersionRef = useRef<Record<string, number>>({});
  const latestOwnId = messages.find((message) => message.senderType === 'specialist' && !message.deletedAt)?.id;
  const unreadUserIds = messages
    .filter((message) => message.senderType === 'user' && !message.readAt)
    .map((message) => message.id)
    .join(',');

  useEffect(() => {
    if (!threadId || !unreadUserIds || markingReadRef.current === unreadUserIds) return;
    markingReadRef.current = unreadUserIds;
    markUserMessagesRead(threadId)
      .catch(() => undefined)
      .finally(() => { markingReadRef.current = null; });
  }, [threadId, unreadUserIds]);

  async function pickMedia() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Cần quyền truy cập ảnh', 'Hãy cho phép TheraHOME truy cập thư viện ảnh.');
    const options = { mediaTypes: ['images', 'videos'] as ImagePicker.MediaType[], quality: 0.82 };
    const result = await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled) setAttachment(result.assets[0]);
  }

  async function submit() {
    const body = text.trim();
    if ((!body && !attachment) || saving || !threadId || !staffUserId) return;

    const replyToMessageId = replyingTo?.id;
    if (!attachment) {
      setText('');
      setReplyingTo(null);
      void sendMessage.mutateAsync({ body, replyToMessageId }).catch(() => Alert.alert('Chưa lưu được tin nhắn', 'Vui lòng thử lại.'));
      return;
    }

    setSaving(true);
    try {
      const attachmentPath = await uploadChatAttachment(staffUserId, threadId, attachment.uri, attachment.mimeType);
      await sendMessage.mutateAsync({ body, attachmentPath, replyToMessageId });
      setText(''); setAttachment(null); setReplyingTo(null);
    } catch { Alert.alert('Chưa lưu được tin nhắn', 'Vui lòng thử lại.'); }
    finally { setSaving(false); }
  }

  async function action(type: 'reply' | 'copy') {
    const message = actionMessage;
    setActionMessage(null);
    setActionOrigin(null);
    if (!message) return;
    if (type === 'reply') { setReplyingTo(message); requestAnimationFrame(() => inputRef.current?.focus()); }
    if (type === 'copy' && message.body) await Clipboard.setStringAsync(message.body);
  }

  function displayedReactions(message: ChatMessageRow): ChatMessageRow['reactions'] {
    if (!staffUserId || !Object.prototype.hasOwnProperty.call(reactionOverrides, message.id)) return message.reactions;
    const ownEmoji = reactionOverrides[message.id];
    const existingOwn = message.reactions.find((item) => item.userId === staffUserId);
    return [
      ...message.reactions.filter((item) => item.userId !== staffUserId),
      ...(ownEmoji ? [{ id: existingOwn?.id ?? `optimistic-${message.id}`, userId: staffUserId, emoji: ownEmoji }] : []),
    ];
  }

  function react(message: ChatMessageRow, emoji: string) {
    if (!staffUserId) return;
    hapticConfirm();
    setActionMessage(null);
    setActionOrigin(null);
    const currentlyDisplayed = displayedReactions(message).find((item) => item.userId === staffUserId);
    const currentServerReaction = message.reactions.find((item) => item.userId === staffUserId);
    const nextEmoji = currentlyDisplayed?.emoji === emoji ? null : emoji;
    const version = (reactionVersionRef.current[message.id] ?? 0) + 1;
    reactionVersionRef.current[message.id] = version;

    setReactionOverrides((previous) => ({ ...previous, [message.id]: nextEmoji }));
    void toggleChatReaction(message.id, staffUserId, emoji, currentServerReaction)
      .then(() => messagesQuery.refetch())
      .catch(() => {
        if (reactionVersionRef.current[message.id] !== version) return;
        setReactionOverrides((previous) => {
          const { [message.id]: _failed, ...remaining } = previous;
          return remaining;
        });
        Alert.alert('Không thể thả cảm xúc');
      });
  }

  function renderMessage({ item: message, index }: { item: ChatMessageRow; index: number }) {
    const own = message.senderType === 'specialist';
    const replied = messages.find((item) => item.id === message.replyToMessageId);
    const visibleReactions = displayedReactions(message);
    const emojis = Array.from(new Set(visibleReactions.map((item) => item.emoji)));
    const newerMessage = index > 0 ? messages[index - 1] : null;
    const isSessionEnd = newerMessage
      ? new Date(newerMessage.createdAt).getTime() - new Date(message.createdAt).getTime() >= CHAT_SESSION_GAP_MS
      : Date.now() - new Date(message.createdAt).getTime() >= CHAT_SESSION_GAP_MS;
    return (
      <View style={styles.messageRow}>
        <View style={[styles.messageWrap, { alignSelf: own ? 'flex-end' : 'flex-start' }]}>
          <View style={[styles.bubbleGroup, emojis.length ? styles.bubbleGroupWithReaction : undefined]}>
            <Pressable onLongPress={(event) => { hapticPressHold(); setActionOrigin({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }); setActionMessage(message); }} delayLongPress={300} style={[styles.bubble, theme.shadows.card, { backgroundColor: own ? theme.colors.primary : theme.colors.bgCard, borderRadius: theme.radius.md }]}>
              {message.replyToMessageId ? <View style={[styles.quote, { borderLeftColor: own ? '#ffffffaa' : theme.colors.primary }]}><Text numberOfLines={2} style={[styles.quoteText, { color: own ? '#ffffffbb' : theme.colors.textSecondary }]}>{replied?.deletedAt ? 'Tin nhắn đã xoá' : replied?.body || (replied?.imageUrl ? 'Ảnh' : 'Tin nhắn được trả lời')}</Text></View> : null}
              {message.deletedAt ? <Text style={{ color: own ? '#ffffffaa' : theme.colors.textMuted, fontStyle: 'italic' }}>Tin nhắn đã được xoá</Text> : <>{message.imageUrl ? <Pressable onPress={() => setViewer({ uri: message.imageUrl!, kind: message.attachmentKind ?? 'image' })}>{message.attachmentKind === 'video' ? <View style={styles.videoTile}><Icon name="film" size={34} color="#fff" /><Icon name="play" size={24} color="#fff" /></View> : <Image source={{ uri: message.imageUrl }} style={styles.messageImage} />}</Pressable> : null}{message.body ? <Text style={[theme.type.body, { color: own ? '#fff' : theme.colors.textPrimary }]}>{message.body}</Text> : null}</>}
            </Pressable>
            {emojis.length ? <Pressable onPress={(event) => { setActionOrigin({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }); setActionMessage(message); }} style={[styles.reactions, own ? styles.reactionsOwn : styles.reactionsOther, { backgroundColor: theme.colors.bgCard, borderColor: theme.colors.divider }]}><Text style={styles.reactionText}>{emojis.join(' ')}</Text></Pressable> : null}
          </View>
          {own && message.id === latestOwnId ? <Text style={[styles.deliveryStatus, { color: theme.colors.textMuted }]}>{message.readAt ? 'Đã xem' : 'Đã gửi'}{message.editedAt ? ' · Đã chỉnh sửa' : ''}</Text> : null}
        </View>
        {isSessionEnd ? <Text style={[styles.messageTime, { color: theme.colors.textMuted }]}>{timeOf(message.createdAt)}</Text> : null}
      </View>
    );
  }

  const context = replyingTo;
  const actionOwn = actionMessage?.senderType === 'specialist';
  const actionTop = actionOrigin ? Math.max(30, Math.min(actionOrigin.y - 72, WINDOW_HEIGHT - 240)) : 30;
  const selectedActionEmoji = actionMessage && staffUserId
    ? displayedReactions(actionMessage).find((item) => item.userId === staffUserId)?.emoji
    : null;
  return (
    <ScreenContainer>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { borderBottomColor: theme.colors.divider }]}>
          <Pressable onPress={() => router.back()}><Icon name="chevron-left" size={22} color={theme.colors.textPrimary} /></Pressable>
          <AvatarImg size={36} uri={patientQuery.data?.avatarUrl} />
          <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{patientQuery.data?.fullName ?? '...'}</Text>
        </View>
        {messagesQuery.isPending ? <View style={styles.loading}><ActivityIndicator color={theme.colors.primary} /></View> : <FlatList inverted data={messages} keyExtractor={(item) => item.id} renderItem={renderMessage} contentContainerStyle={styles.body} onTouchStart={() => setShowEmojis(false)} onScrollBeginDrag={() => setShowEmojis(false)} onEndReached={() => { if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) void messagesQuery.fetchNextPage(); }} onEndReachedThreshold={0.2} ListFooterComponent={messagesQuery.isFetchingNextPage ? <ActivityIndicator color={theme.colors.primary} /> : null} ListEmptyComponent={<Text style={{ color: theme.colors.textMuted, textAlign: 'center' }}>Chưa có tin nhắn nào.</Text>} />}
        {context ? <View style={[styles.context, { backgroundColor: theme.colors.bgCardAlt, borderLeftColor: theme.colors.primary }]}><View style={styles.flex}><Text style={[styles.contextTitle, { color: theme.colors.primary }]}>Đang trả lời</Text><Text numberOfLines={1} style={{ color: theme.colors.textSecondary }}>{context.body || 'Ảnh'}</Text></View><Pressable onPress={() => setReplyingTo(null)}><Icon name="x" size={18} color={theme.colors.textMuted} /></Pressable></View> : null}
        {showEmojis ? <View style={[styles.emojiBar, { borderTopColor: theme.colors.divider }]}>{COMPOSER_EMOJIS.map((emoji) => <Pressable key={emoji} onPress={() => setText((value) => value + emoji)}><Text style={styles.composerEmoji}>{emoji}</Text></Pressable>)}</View> : null}
        <View style={[styles.inputRow, { borderTopColor: theme.colors.divider }]}>{attachment ? <View>{attachment.type === 'video' ? <View style={[styles.preview, styles.videoPreview]}><Icon name="film" size={21} color="#fff" /></View> : <Image source={{ uri: attachment.uri }} style={styles.preview} />}<Pressable onPress={() => setAttachment(null)} style={styles.remove}><Icon name="x" size={12} color="#fff" /></Pressable></View> : null}<Pressable onPress={() => void pickMedia()} style={styles.composerTool}><Icon name="image" size={22} color={theme.colors.primary} /></Pressable><Pressable onPress={() => setShowEmojis((value) => !value)} style={styles.composerTool}><Icon name="smile" size={22} color={theme.colors.primary} /></Pressable><TextInput ref={inputRef} value={text} onChangeText={setText} onSubmitEditing={() => void submit()} placeholder="Aa" placeholderTextColor={theme.colors.textMuted} style={[styles.input, { borderColor: theme.colors.borderInput, color: theme.colors.textPrimary }]} /><Pressable disabled={saving} onPress={() => void submit()} style={[styles.send, { backgroundColor: theme.colors.primary, opacity: saving ? 0.55 : 1 }]}><Icon name="send" size={16} color="#fff" /></Pressable></View>
        {viewer ? <ChatMediaViewer uri={viewer.uri} kind={viewer.kind} onClose={() => setViewer(null)} /> : null}
        <Modal visible={!!actionMessage} transparent animationType="none" onRequestClose={() => { setActionMessage(null); setActionOrigin(null); }}><Pressable style={styles.backdrop} onPress={() => { setActionMessage(null); setActionOrigin(null); }}><View style={[styles.actionContent, { top: actionTop, ...(actionOwn ? { right: 16 } : { left: 16 }) }]}><View style={[styles.reactionBar, { backgroundColor: theme.colors.bgCard }]}>{REACTIONS.map((emoji) => <Pressable key={emoji} style={[styles.reactionChoice, selectedActionEmoji === emoji ? { backgroundColor: theme.colors.bgCardAlt } : undefined]} onPress={() => actionMessage && void react(actionMessage, emoji)}><ReactionAsset emoji={emoji} size={29} /></Pressable>)}</View><View style={[styles.sheet, { backgroundColor: theme.colors.bgCard }]}><ActionRow icon="message-circle" text="Trả lời" onPress={() => void action('reply')} /><ActionRow icon="copy" text="Sao chép" onPress={() => void action('copy')} /></View></View></Pressable></Modal>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function ActionRow({ icon, text, onPress }: { icon: string; text: string; onPress: () => void }) { const theme = useTheme(); return <Pressable style={styles.actionRow} onPress={onPress}><Icon name={icon} size={19} color={theme.colors.textPrimary} /><Text style={[theme.type.body, { color: theme.colors.textPrimary }]}>{text}</Text></Pressable>; }

const styles = StyleSheet.create({
  flex: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 12, paddingTop: 4, borderBottomWidth: 1 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, body: { padding: 20, gap: 6, flexGrow: 1 }, messageRow: { width: '100%' }, messageWrap: { maxWidth: '80%', marginVertical: 2, alignItems: 'flex-start' }, bubbleGroup: { position: 'relative', alignSelf: 'flex-start' }, bubbleGroupWithReaction: { paddingBottom: 14 }, bubble: { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 14 }, messageImage: { width: 210, height: 160, borderRadius: 10, marginBottom: 6 }, videoTile: { width: 210, height: 145, borderRadius: 10, backgroundColor: '#202838', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 6 }, quote: { borderLeftWidth: 3, paddingLeft: 8, marginBottom: 7 }, quoteText: { fontSize: 12, lineHeight: 16 }, reactions: { position: 'absolute', bottom: 0, borderWidth: 1, borderRadius: 11, paddingHorizontal: 5, paddingVertical: 1 }, reactionsOwn: { right: 8 }, reactionsOther: { left: 8 }, reactionText: { fontSize: 11 }, deliveryStatus: { alignSelf: 'flex-end', fontSize: 10, lineHeight: 14, paddingRight: 2 }, messageTime: { alignSelf: 'center', fontSize: 10, lineHeight: 14, marginTop: 1 }, context: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9, borderLeftWidth: 3 }, contextTitle: { fontSize: 12, fontWeight: '700' }, emojiBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, borderTopWidth: 1 }, composerEmoji: { fontSize: 24 }, inputRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 }, composerTool: { width: 36, height: 38, alignItems: 'center', justifyContent: 'center' }, input: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, fontSize: 14 }, send: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }, preview: { width: 42, height: 42, borderRadius: 8 }, videoPreview: { backgroundColor: '#202838', alignItems: 'center', justifyContent: 'center' }, remove: { position: 'absolute', right: -5, top: -5, width: 18, height: 18, borderRadius: 9, backgroundColor: '#E5484D', alignItems: 'center', justifyContent: 'center' }, backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.24)' }, actionContent: { position: 'absolute', gap: 12, alignItems: 'flex-end' }, reactionBar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 40, paddingHorizontal: 14, paddingVertical: 11 }, reactionChoice: { borderRadius: 20, padding: 2 }, sheet: { width: 230, borderRadius: 20, overflow: 'hidden' }, actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D5D9E0' },
});

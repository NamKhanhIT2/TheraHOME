import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import Reanimated from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useAddComment, useDeleteComment, useDeletePost, useHideCommunityComment, useHideCommunityPost, useHiddenCommunityComments, useMyCommentReactions, useMyPostReactions, useMyPostSaves, usePost, usePostComments, useReportContent, useSetCommentReaction, useSetPostReaction, useTogglePostSave, useUpdateComment, useUpdatePost, friendlyCommunityError, DEFAULT_COMMENTS_PAGE_SIZE, type CommentRow, type PostReaction, type ReportReason } from '@/hooks/useCommunity';
import { timeAgo } from '@/lib/timeAgo';
import { CommunityAvatar } from '@/components/CommunityAvatar';
import { CommunityPostImage } from '@/components/CommunityPostImage';
import { MediaGrid } from '@/components/community/MediaGrid';
import { ProgressShareCard } from '@/components/ProgressShareCard';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';
import { ReactionButton } from '@/components/community/ReactionButton';
import { ReactionPicker } from '@/components/community/ReactionPicker';
import { ReactionSummary } from '@/components/community/ReactionSummary';
import { PostActionBar } from '@/components/community/PostActionBar';
import { getReactionTrayFrame, pickerReactionAt } from '@/components/community/reactionPickerGeometry';
import { hapticConfirm } from '@/lib/haptics';
import { fadeUpEntering, staggerDelay } from '@/lib/motion';
import { Collapsible } from '@/components/motion/Collapsible';

type ReplyTarget = { id: string; name: string };
type OpenCommentMenu = { comment: CommentRow; pageX: number; pageY: number };
type OpenReactionPicker = { comment: CommentRow; pageX: number; pageY: number };
const COMMENT_EMOJIS = ['😊', '❤️', '👍', '😂', '🎉', '💪'];
export default function PostDetailScreen() {
  const theme = useTheme();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { t } = useI18n();
  const reportReasons: { key: ReportReason; label: string }[] = [
    { key: 'spam', label: t('reportReasonSpam') },
    { key: 'inappropriate', label: t('reportReasonInappropriate') },
    { key: 'harassment', label: t('reportReasonHarassment') },
    { key: 'other', label: t('reportReasonOther') },
  ];
  const isFocused = useIsFocused();
  const { postId, commentId, parentCommentId } = useLocalSearchParams<{ postId: string; commentId?: string; parentCommentId?: string }>();
  const { session } = useSession();
  const userId = session?.user.id;
  const postQuery = usePost(postId);
  const post = postQuery.data ?? undefined;
  const [limit, setLimit] = useState(DEFAULT_COMMENTS_PAGE_SIZE);
  const commentsQuery = usePostComments(postId, limit);
  const reactions = useMyPostReactions(userId).data ?? new Map<string, PostReaction>();
  const saves = useMyPostSaves(userId).data ?? new Set<string>();
  const commentReactions = useMyCommentReactions(userId).data ?? new Map<string, PostReaction>();
  const setReaction = useSetPostReaction(userId);
  const toggleSave = useTogglePostSave(userId);
  const setCommentReaction = useSetCommentReaction(userId);
  const addComment = useAddComment(userId);
  const updateComment = useUpdateComment(userId);
  const deleteComment = useDeleteComment(userId);
  const deletePost = useDeletePost();
  const updatePost = useUpdatePost(userId);
  const hidePost = useHideCommunityPost(userId);
  const hiddenCommentIds = useHiddenCommunityComments(userId).data ?? new Set<string>();
  const hideComment = useHideCommunityComment(userId);
  const reportContent = useReportContent(userId);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const positions = useRef<Record<string, number>>({});
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const isVideoAttachment = !!(imageUri && (imageMimeType?.startsWith('video/') || /\.(mp4|mov|m4v|webm)(?:$|\?)/i.test(imageUri)));
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [editing, setEditing] = useState<CommentRow | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [postExpanded, setPostExpanded] = useState(false);
  const [postEditing, setPostEditing] = useState(false);
  const [postDraft, setPostDraft] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [postReactionPicker, setPostReactionPicker] = useState<{ pageX: number; pageY: number; hovered: PostReaction | null } | null>(null);
  const [commentReactionPicker, setCommentReactionPicker] = useState<(OpenReactionPicker & { hovered: PostReaction | null }) | null>(null);
  const [postMenu, setPostMenu] = useState<{ pageX: number; pageY: number } | null>(null);
  const [commentMenu, setCommentMenu] = useState<OpenCommentMenu | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: string; type: 'post' | 'comment' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  // Not commentsQuery.isRefetching — that flips true on every background
  // refetch (realtime comment_likes/post_comments changes, including our
  // own reaction taps), which would flash the pull spinner on every tap.
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const comments = useMemo(() => {
    const withoutHidden = (items: CommentRow[]): CommentRow[] => items
      .filter((item) => !hiddenCommentIds.has(item.id))
      .map((item) => ({ ...item, replies: withoutHidden(item.replies) }));
    return withoutHidden(commentsQuery.data ?? []);
  }, [commentsQuery.data, hiddenCommentIds]);
  const targetId = commentId ?? parentCommentId;

  useEffect(() => {
    if (!targetId || !comments.length) return;
    const parent = comments.find((comment) => comment.id === targetId || comment.replies.some((reply) => reply.id === targetId));
    if (parent && parent.id !== targetId) setExpandedThreads((old) => new Set(old).add(parent.id));
    const rootId = parent?.id ?? targetId;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, (positions.current[rootId] ?? 0) - 12), animated: true });
      setHighlight(targetId); setTimeout(() => setHighlight(null), 1800);
    }, 300);
    return () => clearTimeout(timer);
  }, [targetId, comments]);

  if (postQuery.isPending || commentsQuery.isPending) return <ScreenContainer><BackBar onBack={() => router.back()} title={t('postDetails')} /><View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View></ScreenContainer>;
  if (!post) return <ScreenContainer><BackBar onBack={() => router.back()} title={t('postDetails')} /><View style={styles.center}><Text style={[theme.type.body, { color: theme.colors.textMuted }]}>{t('postNotFound')}</Text></View></ScreenContainer>;

  const ownPost = post.authorId === userId;
  const saved = saves.has(post.id);
  const reaction = reactions.get(post.id) ?? null;
  const pending = addComment.isPending || updateComment.isPending;

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert(t('photoPermissionTitle'), t('photoPermissionMessage'));
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'] as ImagePicker.MediaType[], quality: 0.75 });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageMimeType(result.assets[0].mimeType ?? null);
    }
  }
  function closeCommentMenu() { setCommentMenu(null); }
  function reply(comment: CommentRow) { closeCommentMenu(); setEditing(null); setReplyTo({ id: comment.id, name: comment.authorName }); setTimeout(() => inputRef.current?.focus(), 0); }
  function edit(comment: CommentRow) { closeCommentMenu(); setReplyTo(null); setEditing(comment); setText(comment.text); setImageUri(null); setImageMimeType(null); setTimeout(() => inputRef.current?.focus(), 0); }
  async function submit() {
    if ((!text.trim() && !imageUri) || pending) return;
    setError(null);
    try {
      if (editing) await updateComment.mutateAsync({ commentId: editing.id, postId: post!.id, text: text.trim() });
      else await addComment.mutateAsync({ postId: post!.id, text: text.trim(), imageUri, imageMimeType, parentCommentId: replyTo?.id });
      setText(''); setImageUri(null); setImageMimeType(null); setReplyTo(null); setEditing(null); setShowEmoji(false);
    } catch (cause) { setError(friendlyCommunityError(cause)); }
  }
  function toggleThread(id: string) { setExpandedThreads((old) => { const next = new Set(old); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  async function copy(comment: CommentRow) { await Clipboard.setStringAsync(comment.text); closeCommentMenu(); }
  function remove(comment: CommentRow) {
    closeCommentMenu();
    Alert.alert(t('deleteCommentConfirmTitle'), t('deleteCommentConfirmBody'), [{ text: t('cancel'), style: 'cancel' }, { text: t('delete'), style: 'destructive', onPress: () => deleteComment.mutate({ commentId: comment.id, postId: post!.id }) }]);
  }
  function report(reason: ReportReason) { if (reportTarget) reportContent.mutate({ contentType: reportTarget.type, contentId: reportTarget.id, reason }); setReportTarget(null); }
  function renderComment(comment: CommentRow, nested = false, index = 0): React.ReactNode {
    const currentReaction = commentReactions.get(comment.id) ?? null;
    const open = expandedThreads.has(comment.id);
    const quickReact = () => setCommentReaction.mutate({ commentId: comment.id, postId: post!.id, current: currentReaction, reaction: currentReaction ? null : 'heart' });
    const chooseReaction = (reactionToSet: PostReaction) => {
      setCommentReaction.mutate({ commentId: comment.id, postId: post!.id, current: currentReaction, reaction: reactionToSet });
      setCommentReactionPicker(null);
      hapticConfirm();
    };
    return <Reanimated.View key={comment.id} entering={fadeUpEntering(nested ? 0 : staggerDelay(index, 30, 8), 6, 200)} onLayout={(e) => { if (!nested) positions.current[comment.id] = e.nativeEvent.layout.y; }} style={[nested ? styles.nested : styles.commentBlock, highlight === comment.id || commentReactionPicker?.comment.id === comment.id ? { backgroundColor: theme.colors.primaryTint05, borderRadius: theme.radius.md } : null]}>
      <View style={styles.commentRow}>
        <Pressable onPress={() => router.push({ pathname: '/community/profile/[userId]', params: { userId: comment.authorId } })}><CommunityAvatar name={comment.authorName} authorId={comment.authorId} avatarUrl={comment.authorAvatarUrl} size={nested ? 28 : 34} /></Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Pressable delayLongPress={400} onLongPress={(event) => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); setCommentMenu({ comment, pageX: event.nativeEvent.pageX, pageY: event.nativeEvent.pageY }); }} style={styles.bubble}>
            <View style={styles.commentNameLine}>
              <Text numberOfLines={1} style={[theme.type.caption, { color: theme.colors.textPrimary, fontFamily: theme.fontFamily.bold, flexShrink: 1 }]}>{comment.authorName}</Text>
              <Text style={[theme.type.captionSm, { color: theme.colors.textMuted, flexShrink: 0 }]}>· {timeAgo(comment.createdAt, t)}</Text>
            </View>
            {comment.text ? <Text style={[theme.type.body, { color: theme.colors.textPrimary, marginTop: 3, lineHeight: 20 }]}>{comment.text}</Text> : null}
            {comment.imageUrl ? <CommunityPostImage uri={comment.imageUrl} /> : null}
          </Pressable>
          <View style={styles.meta}>
            <Pressable onPress={() => reply(comment)}><Text style={[theme.type.captionSm, { color: theme.colors.textMuted, fontFamily: theme.fontFamily.bold }]}>{t('reply')}</Text></Pressable>
            {comment.likesCount ? <ReactionSummary counts={comment.reactionCounts} total={comment.likesCount} /> : null}
          </View>
        </View>
        <ReactionButton
          currentReaction={currentReaction}
          onQuickPress={quickReact}
          onLongPress={(event) => setCommentReactionPicker({ comment, pageX: event.nativeEvent.pageX, pageY: event.nativeEvent.pageY, hovered: null })}
          onLongPressMove={(event) => { const { pageX, pageY } = event.nativeEvent; setCommentReactionPicker((active) => active?.comment.id === comment.id ? { ...active, hovered: pickerReactionAt({ pageX, pageY }, getReactionTrayFrame(active, windowWidth)) } : active); }}
          onLongPressRelease={() => {
            const active = commentReactionPicker;
            if (active?.comment.id === comment.id && active.hovered) chooseReaction(active.hovered);
          }}
        />
      </View>
      {!nested && comment.replies.length ? <View style={styles.thread}><Pressable onPress={() => toggleThread(comment.id)}><Text style={[theme.type.captionSm, { color: theme.colors.primary, fontFamily: theme.fontFamily.semiBold }]}>{open ? t('hideReplies') : t('viewReplies', { count: comment.replies.length })}</Text></Pressable><Collapsible open={open}>{comment.replies.map((item, replyIndex) => renderComment(item, true, replyIndex))}</Collapsible></View> : null}
    </Reanimated.View>;
  }

  const postText = !postExpanded && post.text.length > 360 ? `${post.text.slice(0, 360).trimEnd()}…` : post.text;
  const headerAuthor = <Pressable onPress={() => router.push({ pathname: '/community/profile/[userId]', params: { userId: post.isOfficial ? 'official' : post.authorId! } })} style={styles.headerAuthor}>
    <CommunityAvatar name={post.authorName} authorId={post.authorId} avatarUrl={post.authorAvatarUrl} size={34} isOfficial={post.isOfficial} />
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={styles.headerAuthorNameRow}>
        <Text numberOfLines={1} style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, fontFamily: theme.fontFamily.bold }]}>{post.authorName}</Text>
        {post.isOfficial ? <View style={[styles.verified, { backgroundColor: theme.colors.primary }]}><Icon name="check" size={10} color="#fff" strokeWidth={3} /></View> : null}
      </View>
      <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>{timeAgo(post.createdAt, t)}</Text>
    </View>
  </Pressable>;
  return <ScreenContainer><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <BackBar onBack={() => router.back()} title={headerAuthor} right={<Pressable onPress={(event) => setPostMenu({ pageX: event.nativeEvent.pageX, pageY: event.nativeEvent.pageY })} hitSlop={10}><Icon name="more-horizontal" size={22} color={theme.colors.textPrimary} /></Pressable>} />
    <ScrollView ref={scrollRef} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" onTouchStart={() => setShowEmoji(false)} onScrollBeginDrag={() => setShowEmoji(false)} refreshControl={<RefreshControl refreshing={manualRefreshing} onRefresh={async () => { setManualRefreshing(true); try { await commentsQuery.refetch(); } finally { setManualRefreshing(false); } }} tintColor={theme.colors.primary} />}>
      <View style={styles.post}>
        {post.title ? <Text style={[theme.type.h2, { color: theme.colors.textPrimary, marginTop: 14 }]}>{post.title}</Text> : null}{postEditing ? <><TextInput value={postDraft} onChangeText={setPostDraft} multiline style={[styles.postEdit, { color: theme.colors.textPrimary, borderColor: theme.colors.borderInput, borderRadius: theme.radius.md }]} /><View style={styles.editActions}><Pressable onPress={() => setPostEditing(false)}><Text style={[theme.type.caption, { color: theme.colors.textMuted }]}>{t('cancel')}</Text></Pressable><Pressable disabled={!postDraft.trim() || updatePost.isPending} onPress={() => updatePost.mutate({ postId: post.id, text: postDraft.trim() }, { onSuccess: () => setPostEditing(false), onError: (cause) => setError(friendlyCommunityError(cause)) })}><Text style={[theme.type.caption, { color: theme.colors.primary, fontFamily: theme.fontFamily.bold }]}>{t('saveChanges')}</Text></Pressable></View></> : <><Text style={[theme.type.body, styles.postText, { color: theme.colors.textPrimary }]}>{postText}</Text>{post.text.length > 360 ? <Pressable onPress={() => setPostExpanded((v) => !v)}><Text style={[theme.type.caption, { color: theme.colors.primary, fontFamily: theme.fontFamily.semiBold }]}>{postExpanded ? t('seeLess') : t('seeMore')}</Text></Pressable> : null}</>}<MediaGrid uris={post.mediaUrls} postId={post.id} shouldAutoplay={isFocused} />{post.progressSnapshot ? <ProgressShareCard postType={post.postType} snapshot={post.progressSnapshot} /> : null}
        <PostActionBar
          currentReaction={reaction}
          reactionCounts={post.reactionCounts}
          likesCount={post.likesCount}
          commentsCount={post.commentsCount}
          savesCount={post.savesCount}
          saved={saved}
          onQuickReact={() => setReaction.mutate({ postId: post.id, current: reaction, reaction: reaction ? null : 'heart' })}
          onReactionLongPress={(event) => setPostReactionPicker({ pageX: event.nativeEvent.pageX, pageY: event.nativeEvent.pageY, hovered: null })}
          onReactionLongPressMove={(event) => { const { pageX, pageY } = event.nativeEvent; setPostReactionPicker((active) => active ? { ...active, hovered: pickerReactionAt({ pageX, pageY }, getReactionTrayFrame(active, windowWidth)) } : active); }}
          onReactionLongPressRelease={() => { if (!postReactionPicker?.hovered) return; setReaction.mutate({ postId: post.id, current: reaction, reaction: postReactionPicker.hovered }); hapticConfirm(); setPostReactionPicker(null); }}
          onCommentPress={() => inputRef.current?.focus()}
          onSavePress={() => toggleSave.mutate({ postId: post.id, saved })}
        />
      </View>
      <View style={styles.commentsTitle}><Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{t('commentsTitle')}</Text></View>
      {comments.length ? comments.map((comment, index) => renderComment(comment, false, index)) : <Text style={[theme.type.caption, { color: theme.colors.textMuted, textAlign: 'center', marginVertical: 28 }]}>{t('noCommentsYet')}</Text>}{comments.length >= limit ? <Pressable onPress={() => setLimit((v) => v + DEFAULT_COMMENTS_PAGE_SIZE)} style={[styles.load, { borderColor: theme.colors.borderInput }]}><Text style={[theme.type.caption, { color: theme.colors.primary, fontFamily: theme.fontFamily.semiBold }]}>{t('viewMoreComments')}</Text></Pressable> : null}
    </ScrollView>
    {(replyTo || editing) ? <View style={[styles.banner, { backgroundColor: theme.colors.primaryTint10 }]}><Text style={[theme.type.caption, { color: theme.colors.primaryDark, fontFamily: theme.fontFamily.semiBold }]}>{editing ? t('editingComment') : t('replyingTo', { name: replyTo!.name })}</Text><Pressable onPress={() => { setReplyTo(null); setEditing(null); setText(''); }}><Icon name="x" size={16} color={theme.colors.primaryDark} /></Pressable></View> : null}
    {imageUri ? <View style={[styles.imagePreview, { borderTopColor: theme.colors.divider }]}>{isVideoAttachment ? <View style={[styles.preview, styles.videoPreview, { borderRadius: theme.radius.sm, backgroundColor: theme.colors.bgCardAlt }]}><Icon name="film" size={18} color={theme.colors.textSecondary} /></View> : <Image source={{ uri: imageUri }} style={[styles.preview, { borderRadius: theme.radius.sm }]} />}<Pressable onPress={() => { setImageUri(null); setImageMimeType(null); }} style={[styles.remove, { backgroundColor: theme.colors.textPrimary }]}><Icon name="x" size={12} color="#fff" /></Pressable></View> : null}
    {showEmoji ? <View style={[styles.emojiBar, { backgroundColor: theme.colors.bgCard, borderTopColor: theme.colors.divider }]}>{COMMENT_EMOJIS.map((item) => <Pressable key={item} onPress={() => { setText((v) => `${v}${item}`); inputRef.current?.focus(); }}><Text style={styles.emoji}>{item}</Text></Pressable>)}</View> : null}{error ? <Text style={[theme.type.captionSm, styles.error, { color: theme.colors.error }]}>{error}</Text> : null}
    <View style={[styles.composer, { borderTopColor: theme.colors.divider }]}>{!editing ? <Pressable onPress={pickImage} hitSlop={8} style={styles.composerTool}><Icon name="image" size={26} color={theme.colors.textMuted} /></Pressable> : null}<TextInput ref={inputRef} value={text} onChangeText={setText} onFocus={() => setShowEmoji(false)} onSubmitEditing={submit} placeholder={editing ? t('editCommentPlaceholder') : replyTo ? t('replyTo', { name: replyTo.name }) : t('writeComment')} placeholderTextColor={theme.colors.textMuted} style={[styles.input, { borderColor: theme.colors.borderInput, borderRadius: theme.radius.full, color: theme.colors.textPrimary }]} /><Pressable onPress={() => setShowEmoji((v) => !v)} hitSlop={8} style={styles.composerTool}><Icon name="smile" size={26} color={theme.colors.textMuted} /></Pressable><Pressable onPress={submit} disabled={(!text.trim() && !imageUri) || pending} style={[styles.send, { backgroundColor: theme.colors.primary, opacity: (!text.trim() && !imageUri) || pending ? 0.45 : 1 }]}><Icon name="send" size={15} color="#fff" /></Pressable></View>
  </KeyboardAvoidingView>
  <Modal visible={!!postMenu} transparent animationType="fade" onRequestClose={() => setPostMenu(null)}><Pressable style={styles.commentOverlay} onPress={() => setPostMenu(null)}>{postMenu ? <Pressable onPress={() => undefined} style={[styles.floatingPostMenu, { top: Math.min(Math.max(88, postMenu.pageY - 8), windowHeight - 220), left: Math.max(12, Math.min(postMenu.pageX - 190, windowWidth - 232)), backgroundColor: theme.colors.bgCard, borderColor: theme.colors.borderInput, borderRadius: theme.radius.lg }]}><Pressable onPress={() => { toggleSave.mutate({ postId: post.id, saved }); setPostMenu(null); }} style={styles.item}><Icon name="bookmark" size={18} color={theme.colors.textSecondary} /><Text style={[theme.type.body, { color: theme.colors.textPrimary }]}>{saved ? t('unsave') : t('savePost')}</Text></Pressable>{!ownPost ? <><Pressable onPress={() => { hidePost.mutate(post.id); setPostMenu(null); }} style={styles.item}><Icon name="eye" size={18} color={theme.colors.textSecondary} /><Text style={[theme.type.body, { color: theme.colors.textPrimary }]}>{t('hidePost')}</Text></Pressable><Pressable onPress={() => { setPostMenu(null); setReportTarget({ id: post.id, type: 'post' }); }} style={styles.item}><Icon name="flag" size={18} color={theme.colors.error} /><Text style={[theme.type.body, { color: theme.colors.error }]}>{t('reportPost')}</Text></Pressable></> : <><Pressable onPress={() => { setPostDraft(post.text); setPostEditing(true); setPostMenu(null); }} style={styles.item}><Icon name="pencil" size={18} color={theme.colors.textSecondary} /><Text style={[theme.type.body, { color: theme.colors.textPrimary }]}>{t('editPost')}</Text></Pressable><Pressable onPress={() => { setPostMenu(null); Alert.alert(t('deletePost'), t('deletePostConfirmBody'), [{ text: t('cancel'), style: 'cancel' }, { text: t('delete'), style: 'destructive', onPress: () => deletePost.mutate(post.id, { onSuccess: () => router.back() }) }]); }} style={styles.item}><Icon name="trash-2" size={18} color={theme.colors.error} /><Text style={[theme.type.body, { color: theme.colors.error }]}>{t('deletePost')}</Text></Pressable></>}</Pressable> : null}</Pressable></Modal>
  {postReactionPicker ? <Pressable style={styles.reactionPickerLayer} onPress={() => setPostReactionPicker(null)}><ReactionPicker highlightedReaction={postReactionPicker.hovered} style={[styles.inlineReactionPicker, getReactionTrayFrame(postReactionPicker, windowWidth)]} onSelect={(reactionToSet) => { setReaction.mutate({ postId: post.id, current: reaction, reaction: reactionToSet }); hapticConfirm(); setPostReactionPicker(null); }} /></Pressable> : null}
  {commentReactionPicker ? <Pressable style={styles.reactionPickerLayer} onPress={() => setCommentReactionPicker(null)}><ReactionPicker highlightedReaction={commentReactionPicker.hovered} style={[styles.inlineReactionPicker, getReactionTrayFrame(commentReactionPicker, windowWidth)]} onSelect={(reactionToSet) => { const current = commentReactions.get(commentReactionPicker.comment.id) ?? null; setCommentReaction.mutate({ commentId: commentReactionPicker.comment.id, postId: post.id, current, reaction: reactionToSet }); hapticConfirm(); setCommentReactionPicker(null); }} /></Pressable> : null}
  <Modal visible={!!commentMenu} transparent animationType="fade" onRequestClose={closeCommentMenu}><Pressable style={styles.commentOverlay} onPress={closeCommentMenu}>{commentMenu ? <Pressable onPress={() => undefined} style={[styles.floatingCommentMenu, { top: Math.min(Math.max(88, commentMenu.pageY - 52), windowHeight - 360), left: Math.max(12, Math.min(commentMenu.pageX - 220, windowWidth - 304)), backgroundColor: theme.colors.bgCard, borderColor: theme.colors.borderInput, borderRadius: theme.radius.lg }]}><View style={[styles.selected, { backgroundColor: theme.colors.primaryTint05, borderRadius: theme.radius.md }]}><Text numberOfLines={3} style={[theme.type.caption, { color: theme.colors.textPrimary }]}>{commentMenu.comment.text || t('imagePlaceholder')}</Text></View><ReactionPicker style={styles.commentReactionBar} onSelect={(reactionToSet) => { const current = commentReactions.get(commentMenu.comment.id) ?? null; setCommentReaction.mutate({ commentId: commentMenu.comment.id, postId: post.id, current, reaction: reactionToSet }); hapticConfirm(); closeCommentMenu(); }} />{commentMenu.comment.authorId === userId ? <><Pressable onPress={() => copy(commentMenu.comment)} style={styles.item}><Icon name="copy" size={18} color={theme.colors.textSecondary} /><Text style={[theme.type.body, { color: theme.colors.textPrimary }]}>{t('copy')}</Text></Pressable><Pressable onPress={() => edit(commentMenu.comment)} style={styles.item}><Icon name="pencil" size={18} color={theme.colors.textSecondary} /><Text style={[theme.type.body, { color: theme.colors.textPrimary }]}>{t('edit')}</Text></Pressable><Pressable onPress={() => remove(commentMenu.comment)} style={styles.item}><Icon name="trash-2" size={18} color={theme.colors.error} /><Text style={[theme.type.body, { color: theme.colors.error }]}>{t('deleteComment')}</Text></Pressable></> : <><Pressable onPress={() => reply(commentMenu.comment)} style={styles.item}><Icon name="message-circle" size={18} color={theme.colors.textSecondary} /><Text style={[theme.type.body, { color: theme.colors.textPrimary }]}>{t('reply')}</Text></Pressable><Pressable onPress={() => copy(commentMenu.comment)} style={styles.item}><Icon name="copy" size={18} color={theme.colors.textSecondary} /><Text style={[theme.type.body, { color: theme.colors.textPrimary }]}>{t('copy')}</Text></Pressable><Pressable onPress={() => { hideComment.mutate(commentMenu.comment.id); closeCommentMenu(); }} style={styles.item}><Icon name="eye" size={18} color={theme.colors.textSecondary} /><Text style={[theme.type.body, { color: theme.colors.textPrimary }]}>{t('hideComment')}</Text></Pressable><Pressable onPress={() => { closeCommentMenu(); setReportTarget({ id: commentMenu.comment.id, type: 'comment' }); }} style={styles.item}><Icon name="flag" size={18} color={theme.colors.error} /><Text style={[theme.type.body, { color: theme.colors.error }]}>{t('reportComment')}</Text></Pressable></>}</Pressable> : null}</Pressable></Modal>
  <Modal visible={!!reportTarget} transparent animationType="fade" onRequestClose={() => setReportTarget(null)}><Pressable style={styles.overlay} onPress={() => setReportTarget(null)}><View style={[styles.sheet, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}><Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, marginBottom: 6 }]}>{reportTarget?.type === 'post' ? t('reportPost') : t('reportComment')}</Text>{reportReasons.map((item) => <Pressable key={item.key} onPress={() => report(item.key)} style={styles.report}><Text style={[theme.type.body, { color: theme.colors.textPrimary }]}>{item.label}</Text></Pressable>)}</View></Pressable></Modal>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, headerAuthor: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }, headerAuthorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, body: { paddingHorizontal: 20, paddingBottom: 24 }, post: { paddingTop: 10 }, verified: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, postText: { lineHeight: 22, marginTop: 12 }, postEdit: { minHeight: 110, borderWidth: 1, marginTop: 12, padding: 10, textAlignVertical: 'top' }, editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8 },
  commentsTitle: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DDE5EF', paddingTop: 14, marginTop: 4, marginBottom: 10 }, commentBlock: { marginBottom: 16 }, nested: { marginTop: 12, borderLeftWidth: 2, borderLeftColor: '#DDE5EF', paddingLeft: 10 }, commentRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' }, bubble: { alignSelf: 'stretch', paddingTop: 2, paddingRight: 2, maxWidth: '100%' }, commentNameLine: { flexDirection: 'row', alignItems: 'baseline', gap: 5 }, meta: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 5, marginLeft: 1 }, thread: { marginTop: 7, marginLeft: 43, gap: 4 }, load: { alignSelf: 'center', borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, marginTop: 4 },
  banner: { paddingHorizontal: 20, paddingVertical: 7, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, imagePreview: { paddingHorizontal: 20, paddingTop: 8, borderTopWidth: 1, height: 76 }, preview: { width: 62, height: 62 }, videoPreview: { alignItems: 'center', justifyContent: 'center' }, remove: { position: 'absolute', left: 72, top: 5, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, emojiBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 9, borderTopWidth: 1 }, emoji: { fontSize: 24 }, error: { paddingHorizontal: 20, paddingTop: 4 }, composer: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 9, borderTopWidth: 1 }, composerTool: { width: 38, height: 40, alignItems: 'center', justifyContent: 'center' }, input: { flex: 1, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 }, send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(10,20,36,0.46)', justifyContent: 'flex-end', padding: 16 }, sheet: { padding: 12, gap: 2 }, item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 9, paddingVertical: 13 }, selected: { padding: 12, marginBottom: 8 }, report: { paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DDE5EF' },
  reactionOverlay: { flex: 1, backgroundColor: 'rgba(10,20,36,0.15)', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 116 },
  reactionPickerLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 30 }, inlineReactionPicker: { position: 'absolute' },
  commentOverlay: { flex: 1, backgroundColor: 'rgba(10,20,36,0.48)' }, floatingPostMenu: { position: 'absolute', width: 220, padding: 6, borderWidth: 1, shadowColor: '#0A1424', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 }, floatingCommentMenu: { position: 'absolute', width: 292, padding: 12, borderWidth: 1, shadowColor: '#0A1424', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8, transform: [{ scale: 1.015 }] }, commentReactionBar: { position: 'absolute', top: -48, left: 12 },
});

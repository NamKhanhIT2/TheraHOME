import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, homeGlassColors } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
import { useActivatedPrograms, useProgramDays, usePainLogs } from '@/hooks/usePrograms';
import { useAccessibleProgress } from '@/hooks/useAccessibleProgress';
import { useAppStore } from '@/store/useAppStore';
import { useCreatePost, friendlyCommunityError, type PostMediaItem, type PostType, type ProgressSnapshot } from '@/hooks/useCommunity';
import { ProgressShareCard } from '@/components/ProgressShareCard';
import { Icon } from '@/components/icons/Icon';
import { AvatarImg } from '@/components/AvatarImg';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useI18n } from '@/lib/i18n';

const MAX_MEDIA = 10;
/**
 * Videos are uploaded as they come off the phone — the three compressed
 * renditions in `uploadCommunityImage` are for stills only, and compressing
 * video on device needs a native module this app does not carry. One clip
 * reached the community bucket at 23 MB on 2026-09-11, which is 59% of
 * everything in it. A ceiling is not compression, but it is the part that
 * can be shipped without a new dependency.
 */
const MAX_VIDEO_BYTES = 12 * 1024 * 1024;
const VIDEO_EXTENSION = /\.(mp4|mov|m4v|webm)(?:$|\?)/i;
const isVideoItem = (item: PostMediaItem) => !!item.mimeType?.startsWith('video/') || VIDEO_EXTENSION.test(item.uri);

export default function CreatePostScreen() {
  const theme = useTheme();
  // Inside the full-screen modal the context inset came back as 0, so the
  // title and the Chia sẻ pill were drawn across the clock and the battery
  // (owner's screenshot, 2026-10-26). `initialWindowMetrics` is read from
  // the window at launch, outside any provider, so it still knows how tall
  // this phone's status bar is; the larger of the two is the safe one.
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, initialWindowMetrics?.insets.top ?? 0);
  const { t } = useI18n();
  const { session } = useSession();
  const params = useLocalSearchParams<{ achievement?: string; milestone?: string; type?: string }>();
  const userId = session?.user.id;
  const profile = useProfile(userId).data;
  const displayName =
    profile?.fullName ??
    (session?.user.user_metadata?.full_name as string | undefined) ??
    (session?.user.user_metadata?.name as string | undefined) ??
    session?.user.email ??
    t('defaultUserName');

  // Offers to tag the post with the phase the user is currently on, matching
  // the "Hoàn thành Giai đoạn X" badge shown on milestone posts in the feed —
  // and, for postType progress/exercise, the source of the shared snapshot.
  // The program the user is LOOKING AT (Home/Roadmap dropdown), not the
  // first one activated — a TheraBACK viewer used to share TheraNECK stats.
  const selectedProductId = useAppStore((s) => s.selectedProductId);
  const programs = useActivatedPrograms(userId).data;
  const activeProgram = programs?.find((p) => p.productId === selectedProductId) ?? programs?.[0];
  const daysQuery = useProgramDays(activeProgram?.userProgramId, activeProgram?.productId);
  const painLogs = usePainLogs(activeProgram?.userProgramId).data ?? [];
  // "Ngày N/X" in the shared snapshot counts only reachable phases — same
  // source as Home's hero and the Profile header. The device name follows
  // the viewer's market's store name (same as the Home/Roadmap dropdowns).
  const progress = useAccessibleProgress(userId, activeProgram);
  const snapshotProductName = activeProgram
    ? activeProgram.product.name
    : '';
  const currentPhase = daysQuery.data?.find((d) => d.id === activeProgram?.currentDay)?.phase;

  const createPost = useCreatePost(userId);
  const achievementText = params.achievement === 'program'
    ? t('firstRoadmapShare')
    : params.milestone
      ? t('streakShare', { days: params.milestone })
      : '';
  // The composer's chips open this screen with the kind already chosen.
  const [postType, setPostType] = useState<PostType>(
    params.achievement
      ? 'progress'
      : params.type === 'image' || params.type === 'progress' || params.type === 'exercise'
        ? params.type
        : 'text',
  );
  const [text, setText] = useState(achievementText);
  const [tagPhase, setTagPhase] = useState(!!params.achievement);
  const [media, setMedia] = useState<PostMediaItem[]>([]);

  const snapshot: ProgressSnapshot | null =
    (postType === 'progress' || postType === 'exercise') && activeProgram
      ? {
          productName: snapshotProductName,
          dayNumber: progress.day,
          totalDays: progress.totalDays,
          daysCompleted: (daysQuery.data ?? []).filter((d) => d.status === 'done').length,
          streak: activeProgram.streak,
          painBefore: painLogs.length ? painLogs[0].score : null,
          painAfter: painLogs.length ? painLogs[painLogs.length - 1].score : null,
        }
      : null;

  async function pickMedia() {
    const remaining = MAX_MEDIA - media.length;
    if (remaining <= 0) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('photoPermissionTitle'), t('photoPermissionMessage'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'] as ImagePicker.MediaType[],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (!result.canceled && result.assets.length) {
      const tooBig = result.assets.filter(
        (asset) => (asset.mimeType?.startsWith('video/') ?? false) && (asset.fileSize ?? 0) > MAX_VIDEO_BYTES,
      );
      const accepted = result.assets.filter((asset) => !tooBig.includes(asset));
      if (tooBig.length) {
        Alert.alert(t('videoTooLargeTitle'), t('videoTooLargeMessage', { mb: String(Math.round(MAX_VIDEO_BYTES / 1048576)) }));
      }
      if (accepted.length) {
        setMedia((prev) => [...prev, ...accepted.map((asset) => ({ uri: asset.uri, mimeType: asset.mimeType ?? null, width: asset.width, height: asset.height }))]);
      }
    }
  }

  function removeMedia(index: number) {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  }

  function selectType(next: PostType) {
    setPostType(next);
    if (next === 'image') void pickMedia();
  }

  const canSubmit = postType === 'progress' || postType === 'exercise' ? !!snapshot : !!text.trim() || media.length > 0;
  // Closing used to drop a half-written post (and any picked photos) without
  // a word.
  function closeComposer() {
    if (!text.trim() && media.length === 0) {
      router.back();
      return;
    }
    Alert.alert(t('discardPostTitle'), t('discardPostBody'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('discardPostAction'), style: 'destructive', onPress: () => router.back() },
    ]);
  }

  function handleSubmit() {
    if (!canSubmit || createPost.isPending) return;
    createPost.mutate(
      {
        text: text.trim(),
        media,
        dayMilestone: tagPhase ? (activeProgram?.currentDay ?? null) : null,
        phaseMilestone: tagPhase ? (currentPhase ?? null) : null,
        postType,
        progressSnapshot: snapshot,
      },
      {
        onSuccess: () => {
          router.back();
          // Member posts start 'pending' (see community_post_moderation
          // migration) — tell the author why their post isn't public yet.
          Alert.alert(t('postSubmittedTitle'), t('postSubmittedBody'));
        },
        onError: (e) => Alert.alert(t('createPostFailed'), friendlyCommunityError(e)),
      },
    );
  }

  return (
    <ScreenContainer tone="violet" edges={['bottom']}>
      {/* Close left, title centred, the action as a filled pill on the
          right — the owner's reference for this screen (2026-10-25). */}
      <View style={[styles.header, { paddingTop: topInset + 10 }]}>
        <Pressable onPress={closeComposer} hitSlop={8} style={[styles.closeBtn, { backgroundColor: homeGlassColors.surfaceRaised }]}>
          <Icon name="x" size={17} color={homeGlassColors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: homeGlassColors.text }]}>{t('createPost')}</Text>
        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit || createPost.isPending}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.postPill,
            {
              backgroundColor: homeGlassColors.purpleStrong,
              opacity: !canSubmit || createPost.isPending ? 0.4 : pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={[styles.postPillLabel, { color: '#FFFFFF' }]}>{t('share')}</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        {params.achievement ? <View style={[styles.achievementBanner, { backgroundColor: homeGlassColors.surfaceRaised, borderColor: homeGlassColors.purpleStrong }]}><Text style={styles.achievementEmoji}>🎉</Text><View style={{ flex: 1 }}><Text style={[theme.type.bodyStrong, { color: homeGlassColors.purple }]}>{t('newAchievement')}</Text><Text style={[theme.type.caption, { color: homeGlassColors.textMuted, marginTop: 2 }]}>{t('achievementCardHint')}</Text></View></View> : null}
        <View style={styles.userRow}>
          <AvatarImg tone="glass" size={40} uri={profile?.avatarUrl} />
          {/* flex: 1 bounds this column to the row. Without it the column grew
              to fit the untruncated phase label, which pushed the pill past the
              right edge of the screen — visible in Malay, whose phase names run
              longer than the English ones ("Kurangkan ketidakselesaan &
              penyesuaian" against "Reduce discomfort & adapt"). */}
          <View style={styles.userRowText}>
            <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text, fontFamily: theme.fontFamily.bold }]}>
              {displayName}
            </Text>
            {currentPhase ? (
              <Pressable
                onPress={() => setTagPhase((t) => !t)}
                style={[styles.pill, { backgroundColor: tagPhase ? homeGlassColors.surfaceRaised : homeGlassColors.surfaceRaised, marginTop: 4 }]}
              >
                <Text
                  numberOfLines={1}
                  style={[theme.type.captionSm, styles.pillLabel, { color: tagPhase ? homeGlassColors.purple : homeGlassColors.textMuted }]}
                >
                  {tagPhase ? t('tagPhase', { phase: currentPhase }) : t('noTagPhase')}
                </Text>
                <Icon name="chevron-down" size={12} color={tagPhase ? homeGlassColors.purple : homeGlassColors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {snapshot ? <ProgressShareCard postType={postType} snapshot={snapshot} /> : null}

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={snapshot ? t('addThought') : t('thinkingAbout', { name: displayName })}
          placeholderTextColor={homeGlassColors.textFaint}
          multiline
          maxLength={3000}
          style={[styles.textArea, { color: homeGlassColors.text, minHeight: snapshot ? 70 : 140 }]}
        />

        {media.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
            {media.map((item, index) => (
              <View key={`${item.uri}-${index}`} style={styles.mediaThumbWrap}>
                {isVideoItem(item) ? (
                  <View style={[styles.mediaThumb, styles.videoPreview, { borderRadius: theme.radius.sm, backgroundColor: homeGlassColors.surfaceRaised }]}>
                    <Icon name="film" size={22} color={homeGlassColors.textMuted} />
                  </View>
                ) : (
                  <Image source={{ uri: item.uri }} style={[styles.mediaThumb, { borderRadius: theme.radius.sm }]} resizeMode="cover" />
                )}
                <Pressable onPress={() => removeMedia(index)} style={[styles.removeThumb, { backgroundColor: homeGlassColors.text }]}>
                  {/* Inverse-of-theme disc: the icon must invert too, or it is
                      white-on-white in dark mode (owner report 2026-09-12). */}
                  <Icon name="x" size={12} color={homeGlassColors.surface} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}
        <Text style={[theme.type.captionSm, styles.characterCount, { color: text.length > 2800 ? homeGlassColors.badge : homeGlassColors.textFaint }]}>{text.length}/3000</Text>
      </ScrollView>

      {/* A row of outline icons under the text, as the reference has it —
          only the ones this app can actually do. Posting moved to the pill
          in the header. */}
      <View style={styles.footer}>
        <View style={[styles.addRow, { borderTopColor: homeGlassColors.hairline }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('a11yPickMedia')}
            onPress={pickMedia}
            disabled={media.length >= MAX_MEDIA}
            hitSlop={10}
            style={({ pressed }) => [styles.toolBtn, pressed ? { opacity: 0.55 } : null]}
          >
            <Icon
              name="image"
              size={27}
              color={media.length >= MAX_MEDIA ? homeGlassColors.textFaint : homeGlassColors.textMuted}
              strokeWidth={1.9}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('a11yPickMedia')}
            onPress={pickMedia}
            disabled={media.length >= MAX_MEDIA}
            hitSlop={10}
            style={({ pressed }) => [styles.toolBtn, pressed ? { opacity: 0.55 } : null]}
          >
            <Icon
              name="film"
              size={27}
              color={media.length >= MAX_MEDIA ? homeGlassColors.textFaint : homeGlassColors.textMuted}
              strokeWidth={1.9}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('progress')}
            onPress={() => selectType(postType === 'progress' ? 'text' : 'progress')}
            disabled={!activeProgram}
            hitSlop={10}
            style={({ pressed }) => [styles.toolBtn, pressed ? { opacity: 0.55 } : null]}
          >
            <Icon
              name="activity"
              size={27}
              color={
                !activeProgram
                  ? homeGlassColors.textFaint
                  : postType === 'progress'
                    ? homeGlassColors.purple
                    : homeGlassColors.textMuted
              }
              strokeWidth={1.9}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('exercise')}
            onPress={() => selectType(postType === 'exercise' ? 'text' : 'exercise')}
            disabled={!activeProgram}
            hitSlop={10}
            style={({ pressed }) => [styles.toolBtn, pressed ? { opacity: 0.55 } : null]}
          >
            <Icon
              name="calendar"
              size={27}
              color={
                !activeProgram
                  ? homeGlassColors.textFaint
                  : postType === 'exercise'
                    ? homeGlassColors.purple
                    : homeGlassColors.textMuted
              }
              strokeWidth={1.9}
            />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/profile/legal/[doc]', params: { doc: 'community' } })}
          hitSlop={8}
          style={styles.guidelines}
        >
          <Text style={[theme.type.captionSm, { color: homeGlassColors.textFaint, textDecorationLine: 'underline' }]}>
            {t('viewCommunityGuidelines')}
          </Text>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  postPill: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 999,
  },
  postPillLabel: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  guidelines: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 2,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    // paddingTop is the status-bar inset plus the reference's own breathing
    // room — the close button and the pill sit BELOW the clock, not level
    // with it (owner, 2026-10-26).
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  body: {
    padding: 20,
  },
  achievementBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    marginBottom: 16,
  },
  achievementEmoji: {
    fontSize: 27,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userRowText: {
    flex: 1,
  },
  pillLabel: {
    // Shrink before the chevron does, so a long label ellipsises instead of
    // shouldering the arrow out of the pill.
    flexShrink: 1,
  },
  pill: {
    // maxWidth stops the pill outgrowing its column even though it hugs its
    // content when the label is short.
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  textArea: {
    fontSize: 20,
    marginTop: 16,
    textAlignVertical: 'top',
  },
  characterCount: { textAlign: 'right', marginTop: 4, marginBottom: 8 },
  mediaRow: {
    gap: 10,
    marginBottom: 12,
  },
  mediaThumbWrap: {
    width: 84,
    height: 84,
  },
  mediaThumb: {
    width: 84,
    height: 84,
  },
  videoPreview: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeThumb: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  // Spread, not gapped: four icons bunched at the left edge of a wide row
  // looked unfinished (owner, 2026-10-25).
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 2,
    borderTopWidth: 1,
  },
  // 44pt targets around the 27pt icons (owner, 2026-10-26): the icons are
  // the only way to attach anything, so they get a real button each.
  toolBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcons: {
    flexDirection: 'row',
    gap: 12,
  },
});

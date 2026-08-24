import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
import { useActivatedPrograms, useProgramDays, usePainLogs } from '@/hooks/usePrograms';
import { useCreatePost, friendlyCommunityError, type PostMediaItem, type PostType, type ProgressSnapshot } from '@/hooks/useCommunity';
import { ProgressShareCard } from '@/components/ProgressShareCard';
import { Icon } from '@/components/icons/Icon';
import { AvatarImg } from '@/components/AvatarImg';
import { Button } from '@/components/ui/Button';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useI18n } from '@/lib/i18n';

const MAX_MEDIA = 10;
const VIDEO_EXTENSION = /\.(mp4|mov|m4v|webm)(?:$|\?)/i;
const isVideoItem = (item: PostMediaItem) => !!item.mimeType?.startsWith('video/') || VIDEO_EXTENSION.test(item.uri);

export default function CreatePostScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const typeOptions: { key: PostType; emoji: string; label: string }[] = [
    { key: 'text', emoji: '📝', label: t('writeShare') },
    { key: 'image', emoji: '📷', label: t('image') },
    { key: 'progress', emoji: '📈', label: t('progress') },
    { key: 'exercise', emoji: '🏃', label: t('exercise') },
  ];
  const { session } = useSession();
  const params = useLocalSearchParams<{ achievement?: string; milestone?: string }>();
  const userId = session?.user.id;
  const profile = useProfile(userId).data;
  const displayName =
    profile?.fullName ??
    (session?.user.user_metadata?.full_name as string | undefined) ??
    (session?.user.user_metadata?.name as string | undefined) ??
    session?.user.email ??
    t('you');

  // Offers to tag the post with the phase the user is currently on, matching
  // the "Hoàn thành Giai đoạn X" badge shown on milestone posts in the feed —
  // and, for postType progress/exercise, the source of the shared snapshot.
  const activeProgram = useActivatedPrograms(userId).data?.[0];
  const daysQuery = useProgramDays(activeProgram?.userProgramId, activeProgram?.productId);
  const painLogs = usePainLogs(activeProgram?.userProgramId).data ?? [];
  const currentPhase = daysQuery.data?.find((d) => d.id === activeProgram?.currentDay)?.phase;

  const createPost = useCreatePost(userId);
  const achievementText = params.achievement === 'program'
    ? t('firstRoadmapShare')
    : params.milestone
      ? t('streakShare', { days: params.milestone })
      : '';
  const [postType, setPostType] = useState<PostType>(params.achievement ? 'progress' : 'text');
  const [text, setText] = useState(achievementText);
  const [tagPhase, setTagPhase] = useState(!!params.achievement);
  const [media, setMedia] = useState<PostMediaItem[]>([]);

  const snapshot: ProgressSnapshot | null =
    (postType === 'progress' || postType === 'exercise') && activeProgram
      ? {
          productName: activeProgram.product.name,
          dayNumber: activeProgram.currentDay,
          totalDays: activeProgram.product.totalDays,
          daysCompleted: (daysQuery.data ?? []).filter((d) => d.status === 'done').length,
          streak: activeProgram.streak,
          painBefore: painLogs.length ? painLogs[0] : null,
          painAfter: painLogs.length ? painLogs[painLogs.length - 1] : null,
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
      setMedia((prev) => [...prev, ...result.assets.map((asset) => ({ uri: asset.uri, mimeType: asset.mimeType ?? null }))]);
    }
  }

  function removeMedia(index: number) {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  }

  function selectType(next: PostType) {
    setPostType(next);
    if (next === 'image') void pickMedia();
  }

  const canSubmit = postType === 'progress' || postType === 'exercise' ? !!snapshot : !!text.trim();

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
        onSuccess: () => router.back(),
        onError: (e) => Alert.alert(t('createPostFailed'), friendlyCommunityError(e)),
      },
    );
  }

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.divider }]}>
        <View style={{ width: 32 }} />
        <Text style={[theme.type.h2, { color: theme.colors.textPrimary }]}>{t('createPost')}</Text>
        <Pressable onPress={() => router.back()} style={[styles.closeBtn, { backgroundColor: theme.colors.bgCardAlt }]}>
          <Icon name="x" size={16} color={theme.colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {params.achievement ? <View style={[styles.achievementBanner, { backgroundColor: theme.colors.primaryTint10, borderColor: theme.colors.primary }]}><Text style={styles.achievementEmoji}>🎉</Text><View style={{ flex: 1 }}><Text style={[theme.type.bodyStrong, { color: theme.colors.primaryDark }]}>{t('newAchievement')}</Text><Text style={[theme.type.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>{t('achievementCardHint')}</Text></View></View> : null}
        <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, marginBottom: 10 }]}>{t('shareWhat')}</Text>
        <View style={styles.typeRow}>
          {typeOptions.map((opt) => {
            const active = postType === opt.key;
            const disabled = (opt.key === 'progress' || opt.key === 'exercise') && !activeProgram;
            return (
              <Pressable
                key={opt.key}
                onPress={() => selectType(opt.key)}
                disabled={disabled}
                style={[
                  styles.typeChip,
                  {
                    backgroundColor: active ? theme.colors.primaryTint10 : theme.colors.bgCardAlt,
                    borderColor: active ? theme.colors.primary : 'transparent',
                    opacity: disabled ? 0.4 : 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 15 }}>{opt.emoji}</Text>
                <Text style={[theme.type.captionSm, { color: active ? theme.colors.primaryDark : theme.colors.textSecondary, fontFamily: theme.fontFamily.semiBold }]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.userRow}>
          <AvatarImg size={40} uri={profile?.avatarUrl} />
          <View>
            <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, fontFamily: theme.fontFamily.bold }]}>
              {displayName}
            </Text>
            {currentPhase ? (
              <Pressable
                onPress={() => setTagPhase((t) => !t)}
                style={[styles.pill, { backgroundColor: tagPhase ? theme.colors.primaryTint10 : theme.colors.bgCardAlt, marginTop: 4 }]}
              >
                <Text style={[theme.type.captionSm, { color: tagPhase ? theme.colors.primaryDark : theme.colors.textSecondary }]}>
                  {tagPhase ? t('tagPhase', { phase: currentPhase }) : t('noTagPhase')}
                </Text>
                <Icon name="chevron-down" size={12} color={tagPhase ? theme.colors.primaryDark : theme.colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {snapshot ? <ProgressShareCard postType={postType} snapshot={snapshot} /> : null}

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={snapshot ? t('addThought') : t('thinkingAbout', { name: displayName })}
          placeholderTextColor={theme.colors.textMuted}
          multiline
          style={[styles.textArea, { color: theme.colors.textPrimary, minHeight: snapshot ? 70 : 140 }]}
        />

        {media.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
            {media.map((item, index) => (
              <View key={`${item.uri}-${index}`} style={styles.mediaThumbWrap}>
                {isVideoItem(item) ? (
                  <View style={[styles.mediaThumb, styles.videoPreview, { borderRadius: theme.radius.sm, backgroundColor: theme.colors.bgCardAlt }]}>
                    <Icon name="film" size={22} color={theme.colors.textSecondary} />
                  </View>
                ) : (
                  <Image source={{ uri: item.uri }} style={[styles.mediaThumb, { borderRadius: theme.radius.sm }]} resizeMode="cover" />
                )}
                <Pressable onPress={() => removeMedia(index)} style={[styles.removeThumb, { backgroundColor: theme.colors.textPrimary }]}>
                  <Icon name="x" size={12} color="#fff" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={[styles.addRow, { borderColor: theme.colors.borderInput, borderRadius: theme.radius.md }]}>
          <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{t('addToPost')}</Text>
          <View style={styles.addIcons}>
            <Pressable onPress={pickMedia} disabled={media.length >= MAX_MEDIA}>
              <Icon name="image" size={20} color={media.length >= MAX_MEDIA ? '#9AA5B1' : '#2BB673'} />
            </Pressable>
          </View>
        </View>
        <Button style={{ width: '100%' }} disabled={!canSubmit} loading={createPost.isPending} onPress={handleSubmit}>
          {t('next')}
        </Button>
        <Pressable onPress={() => router.push({ pathname: '/profile/legal/[doc]', params: { doc: 'community' } })} style={{ marginTop: 10, alignItems: 'center' }}>
          <Text style={[theme.type.captionSm, { color: theme.colors.textMuted, textDecorationLine: 'underline' }]}>{t('viewCommunityGuidelines')}</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  pill: {
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
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  addIcons: {
    flexDirection: 'row',
    gap: 12,
  },
});

import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import YoutubePlayer from 'react-native-youtube-iframe';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useActivatedPrograms, useCatalogProgramDays, useCompleteDay, useDayPainScore } from '@/hooks/usePrograms';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Icon } from '@/components/icons/Icon';
import { ExternalLinkModal } from '@/components/ExternalLinkModal';
import { useI18n } from '@/lib/i18n';

export default function DayDetailScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { dayId, productId } = useLocalSearchParams<{ dayId: string; productId?: string }>();
  const { session } = useSession();
  const userId = session?.user.id;
  const completeDay = useCompleteDay();
  const [videoError, setVideoError] = useState(false);
  const [videoWidth, setVideoWidth] = useState(0);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const programsQuery = useActivatedPrograms(userId);
  const program = (programsQuery.data ?? []).find((p) => p.productId === productId);

  const daysQuery = useCatalogProgramDays(productId, program?.userProgramId);
  const d = (daysQuery.data ?? []).find((x) => x.id === Number(dayId));
  const painScoreQuery = useDayPainScore(program?.userProgramId, d?.programDayId);

  if (programsQuery.isPending || daysQuery.isPending) {
    return (
      <ScreenContainer>
        <BackBar onBack={() => router.back()} title={`${t('day')} ${dayId}`} />
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </ScreenContainer>
    );
  }
  if (!d) return null;

  const progressLocked = d.status === 'locked';
  const canComplete = d.status === 'current' && !!program;
  const videoUrl = normalizeVideoUrl(d.video);
  const supportToolsUrl = normalizeVideoUrl(d.supportToolsUrl);
  const videoId = youtubeVideoId(videoUrl);

  function openVideoBrowser() {
    if (!videoUrl) {
      Alert.alert(t('videoUnavailableTitle'), t('videoUnavailableMessage'));
      return;
    }
    Alert.alert(t('openVideoTitle'), t('openVideoMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('openLink'),
        onPress: () => {
          void WebBrowser.openBrowserAsync(videoUrl, {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
            controlsColor: theme.colors.primary,
          });
        },
      },
    ]);
  }

  function confirmFinish() {
    if (!program || !d) return;
    const score = painScoreQuery.data;
    if (score == null) {
      Alert.alert(t('missingPain'), t('missingPainMessage'));
      return;
    }
    Alert.alert(t('finishConfirm'), t('finishConfirmMessage'), [
      { text: t('goBack'), style: 'cancel' },
      {
        text: t('finish'),
        onPress: () =>
          completeDay.mutate(
            { userProgramId: program.userProgramId, programDayId: d.programDayId, score },
            {
              onSuccess: () => {
                const completedProgram = d.id >= program.product.totalDays && (programsQuery.data ?? []).every((item) => item.adherencePct < 100);
                const milestone = d.id === 7 || d.id === 14;
                if (!completedProgram && !milestone) return;
                const achievementLabel = completedProgram ? 'lộ trình đầu tiên' : `${d.id} ngày`;
                Alert.alert(
                  '🎉 Thành tích mới!',
                  `Bạn vừa hoàn thành ${achievementLabel}!\n\nChia sẻ thành tích với cộng đồng?`,
                  [
                    { text: 'Để sau', style: 'cancel' },
                    {
                      text: 'Chia sẻ',
                      onPress: () => router.push({
                        pathname: '/community/create',
                        params: completedProgram ? { achievement: 'program' } : { achievement: 'streak', milestone: String(d.id) },
                      }),
                    },
                  ],
                );
              },
              onError: () => Alert.alert(t('finishError'), t('retryConnection')),
            },
          ),
      },
    ]);
  }

  return (
    <ScreenContainer>
      <BackBar onBack={() => router.back()} title={`${t('day')} ${d.id}`} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[theme.type.caption, { color: theme.colors.textSecondary, marginBottom: 16 }]}>{d.phase}</Text>

        <View
          onLayout={(event) => setVideoWidth(event.nativeEvent.layout.width)}
          style={[
            styles.videoBox,
            { backgroundColor: theme.colors.bgCardAlt, borderColor: theme.colors.borderLight, borderRadius: theme.radius.lg },
          ]}
        >
          {videoId && !videoError && videoWidth > 0 ? (
            <YoutubePlayer
              key={videoId}
              height={videoWidth * 9 / 16}
              width={videoWidth}
              videoId={videoId}
              onError={() => setVideoError(true)}
              initialPlayerParams={{ playsinline: true, controls: true, rel: false }}
              webViewProps={{
                allowsFullscreenVideo: true,
                allowsInlineMediaPlayback: true,
                mediaPlaybackRequiresUserAction: true,
              }}
            />
          ) : videoError ? (
            <View style={styles.videoFallback}>
              <Icon name="film" size={28} color={theme.colors.textMuted} />
              <Text style={[theme.type.caption, { color: theme.colors.textSecondary, textAlign: 'center' }]}>{t('inlineVideoError')}</Text>
              <Pressable onPress={() => WebBrowser.openBrowserAsync(d.video)}>
                <Text style={[theme.type.bodyStrong, { color: theme.colors.primary }]}>{t('openYoutube')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.videoFallback}>
              {videoUrl ? <ActivityIndicator color={theme.colors.primary} /> : <Icon name="film" size={28} color={theme.colors.textMuted} />}
              <Text style={[theme.type.caption, { color: theme.colors.textSecondary, textAlign: 'center' }]}> 
                {videoUrl ? t('loadingVideo') : t('videoUnavailableMessage')}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.videoTip, { backgroundColor: theme.colors.bgCardAlt, borderColor: theme.colors.borderLight }]}> 
          <Icon name="sparkles" size={17} color={theme.colors.primary} />
          <Text style={[theme.type.caption, styles.videoTipText, { color: theme.colors.textSecondary }]}>Mẹo nhỏ: Xem trên Youtube và phát lên Tivi để có những phút giây thư giãn hơn.</Text>
        </View>

        <View style={{ gap: 12 }}>
          <Pressable
            onPress={openVideoBrowser}
            style={[
              styles.actionBtn,
              { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md },
            ]}
          >
            <Icon name="play" size={18} color="#fff" />
            <Text style={[theme.type.button, { color: '#fff' }]}>{t('watchVideo')}</Text>
          </Pressable>
          {progressLocked ? (
            <View style={[styles.previewHint, { backgroundColor: theme.colors.bgCardAlt, borderColor: theme.colors.borderLight }]}> 
              <Icon name="lock" size={17} color={theme.colors.textSecondary} />
              <Text style={[theme.type.caption, { color: theme.colors.textSecondary, flex: 1 }]}>{t('lockedPreviewHint')}</Text>
            </View>
          ) : null}
          {canComplete ? (
            <View style={[styles.completionHint, { backgroundColor: theme.colors.primaryTint05, borderColor: theme.colors.primaryTint10 }]}> 
              <View style={styles.completionHintTitle}>
                <Icon name="clipboard-check" size={19} color={theme.colors.primary} />
                <Text style={[theme.type.bodyStrong, { color: theme.colors.primaryDark }]}>{t('finalStep')}</Text>
              </View>
              <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}> 
                {t('finishHint')}
              </Text>
            </View>
          ) : null}
          {canComplete ? (
            <Pressable
              onPress={confirmFinish}
              disabled={completeDay.isPending}
              style={[
                styles.actionBtn,
                { backgroundColor: theme.colors.successTint, borderRadius: theme.radius.md },
              ]}
            >
              <Icon name="check" size={18} color={theme.colors.success} />
              <Text style={[theme.type.button, { color: theme.colors.success }]}>{t('finishWorkout')}</Text>
            </Pressable>
          ) : d.status === 'done' ? (
            <View style={[styles.completedRow, { backgroundColor: theme.colors.successTint, borderRadius: theme.radius.md }]}> 
              <Icon name="check" size={18} color={theme.colors.success} />
              <Text style={[theme.type.bodyStrong, { color: theme.colors.success }]}>{t('completed')}</Text>
            </View>
          ) : null}
          <Pressable
            onPress={() => {
              if (!supportToolsUrl) {
                Alert.alert('Chưa có link dụng cụ hỗ trợ', 'TheraHOME chưa cập nhật link dụng cụ hỗ trợ cho ngày tập này.');
                return;
              }
              setPendingUrl(supportToolsUrl);
            }}
            style={[
              styles.actionBtn,
              {
                backgroundColor: theme.colors.bgCard,
                borderWidth: 1,
                borderColor: theme.colors.borderInput,
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <Icon name="external-link" size={18} color={theme.colors.primary} />
            <Text style={[theme.type.button, { color: theme.colors.primary }]}>{t('supportTools')}</Text>
          </Pressable>
        </View>
      </ScrollView>
      {pendingUrl ? <ExternalLinkModal url={pendingUrl} onClose={() => setPendingUrl(null)} /> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 40,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBox: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
    overflow: 'hidden',
  },
  videoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
  },
  videoLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
  },
  videoTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: -8,
    marginBottom: 16,
  },
  videoTipText: {
    flex: 1,
    lineHeight: 19,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  completionHint: {
    borderWidth: 1,
    padding: 14,
    gap: 6,
    borderRadius: 14,
  },
  completionHintTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
});

function normalizeVideoUrl(url: string): string {
  const value = url?.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}


function youtubeVideoId(url: string): string {
  return url.match(/youtu\.be\/([^?&/]+)/)?.[1]
    ?? url.match(/[?&]v=([^?&/]+)/)?.[1]
    ?? url.match(/youtube\.com\/embed\/([^?&/]+)/)?.[1]
    ?? '';
}

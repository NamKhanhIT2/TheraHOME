import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import YoutubePlayer from 'react-native-youtube-iframe';
import { homeGlassColors, useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useActivatedPrograms, useCatalogProgramDays, useMarkDayWatched } from '@/hooks/usePrograms';
import { useAccessibleProgress } from '@/hooks/useAccessibleProgress';
import { usePhaseLockRequirements } from '@/hooks/usePhasePromo';
import { usePhasePurchases, daysOpenAfterPurchase } from '@/hooks/usePhasePurchase';
import { useProfile } from '@/hooks/useProfile';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { PainScaleModal } from '@/components/PainScaleModal';
import { LiveFormCard } from '@/components/day/LiveFormCard';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Icon } from '@/components/icons/Icon';
import { ExternalLinkModal } from '@/components/ExternalLinkModal';
import { useI18n } from '@/lib/i18n';
import { youtubePlayerLangParams } from '@/lib/youtubePlayerLang';
import { IAP_ENABLED } from '@/lib/features';

export default function DayDetailScreen() {
  const theme = useTheme();
  const { t, language } = useI18n();
  const { dayId, productId } = useLocalSearchParams<{ dayId: string; productId?: string }>();
  const { session } = useSession();
  const userId = session?.user.id;
  const markWatched = useMarkDayWatched();
  const [videoError, setVideoError] = useState(false);
  // YoutubePlayer mounts its own WebView and paints it black for several
  // seconds before the iframe paints. The fallback branch below is already
  // gone by then (videoWidth > 0), so without this the screen just shows a
  // black rectangle with no sign that anything is loading.
  const [videoReady, setVideoReady] = useState(false);
  const [videoWidth, setVideoWidth] = useState(0);
  // Mounting the player's WebView is the single most expensive thing this
  // screen does, and it used to happen on the first onLayout — i.e. while the
  // push animation was still running, which cost a ~150ms frame and made
  // opening a day feel like it hitched. Measured with `dumpsys gfxinfo`
  // before and after. Waiting for the transition costs nothing visually: the
  // "loading video" overlay already covers this window either way.
  const navigation = useNavigation();
  const [transitionDone, setTransitionDone] = useState(false);
  useEffect(() => {
    const stop = navigation.addListener('transitionEnd' as never, () => setTransitionDone(true));
    // Belt and braces: a screen shown without a transition (deep link, reduced
    // motion) would otherwise never mount the player at all.
    const timer = setTimeout(() => setTransitionDone(true), 500);
    return () => {
      stop();
      clearTimeout(timer);
    };
  }, [navigation]);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const programsQuery = useActivatedPrograms(userId);
  const program = (programsQuery.data ?? []).find((p) => p.productId === productId);
  // Accessible-days total (IAP-locked phases excluded) — the completion
  // celebration below must fire at the END THE USER CAN ACTUALLY REACH
  // (day 14 while phase 3 is locked), not at the nominal day 28.
  const progress = useAccessibleProgress(userId, program);

  const daysQuery = useCatalogProgramDays(productId, program?.userProgramId, program?.activatedAt);
  const d = (daysQuery.data ?? []).find((x) => x.id === Number(dayId));

  // IAP gate. Roadmap/Home hide locked days, but this screen is also reached
  // by push taps, inbox rows, and stale navigation history — so it must
  // refuse a day whose phase needs a purchase the user hasn't made (audit
  // 2026-09-05). Review accounts are exempt, as everywhere else.
  const phaseIds = useMemo(() => Array.from(new Set((daysQuery.data ?? []).map((x) => x.phaseId))), [daysQuery.data]);
  const lockRequirementsQuery = usePhaseLockRequirements();
  const purchasesQuery = usePhasePurchases(userId);
  const isReviewAccount = useProfile(userId).data?.accountType === 'review';
  const lockDataReady = !d || phaseIds.length === 0 || (lockRequirementsQuery.isFetched && (!userId || purchasesQuery.isFetched));
  const lockRequirement = d ? lockRequirementsQuery.data?.get(d.phaseId) : undefined;
  // `IAP_ENABLED` has to be honoured here exactly as Roadmap honours it
  // (roadmap.tsx). Without it, the first phase given a store product id would
  // show as open on the Roadmap and bounce to the paywall here — the user
  // taps a day and the screen throws them straight back out.
  const phaseLocked = IAP_ENABLED && !!d && !isReviewAccount && lockDataReady && !!lockRequirement && !purchasesQuery.data?.has(d.phaseId);
  // A phase the user has BOUGHT opens its first two days at once and one
  // more every 24 hours from the purchase (owner 2026-09-25). Same maths as
  // the Roadmap and the server's mark_day_watched — this screen is reached
  // by deep links too, so it cannot just trust the caller.
  const purchasedAt = d ? purchasesQuery.data?.get(d.phaseId) : undefined;
  const phaseFirstDay = useMemo(() => {
    if (!d) return Infinity;
    return (daysQuery.data ?? []).filter((x) => x.phaseId === d.phaseId).reduce((min, x) => Math.min(min, x.id), Infinity);
  }, [daysQuery.data, d]);
  const phaseBought =
    !!d && !!lockRequirement && !!purchasedAt && Number.isFinite(phaseFirstDay)
      ? d.id <= daysOpenAfterPurchase(phaseFirstDay, purchasedAt)
      : false;
  // Unpublished roadmap (Admin switch): its days are not content yet.
  const productUnpublished = !!program && program.product.roadmapPublished === false;
  useEffect(() => {
    if (productUnpublished) router.replace('/(tabs)/roadmap');
  }, [productUnpublished]);
  useEffect(() => {
    if (!phaseLocked || !d) return;
    if (lockRequirement?.salesEnabled) router.replace({ pathname: '/paywall/[phaseId]', params: { phaseId: d.phaseId } });
    else router.replace('/(tabs)/roadmap');
  }, [phaseLocked, d, lockRequirement?.salesEnabled]);

  // Fallback discomfort check-in for entries that BYPASS the Roadmap/Home
  // gates (notification deep links open this screen directly): if this
  // openable day has no log yet, ask here. Entries that came through the
  // gate already inserted a log, so the modal never double-asks.
  const queryClient = useQueryClient();
  const [checkInVisible, setCheckInVisible] = useState(false);
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);
  const [checkInDone, setCheckInDone] = useState(false);
  const programDayId = d?.programDayId;
  const userProgramId = program?.userProgramId;
  // A phase that must be BOUGHT answers ONLY to the purchase rule — never to
  // the calendar (owner 2026-09-29): for someone who lapsed past day 17 and
  // then bought, the calendar counted those days as already due, so the whole
  // phase opened at once and the 49-hour wait never bit. `lockRequirement` is
  // what marks the phase as paid on this platform. A day already watched
  // stays reachable, so nothing completed disappears; review accounts are
  // exempt here as everywhere.
  const paidPhase = !!lockRequirement;
  const dayOpenable =
    !!d &&
    (paidPhase
      ? isReviewAccount || phaseBought || d.status === 'done'
      : d.status === 'current' || d.status === 'done' || d.status === 'missed');
  useEffect(() => {
    if (checkInDone || !dayOpenable || !userProgramId || !programDayId) return;
    let cancelled = false;
    void supabase
      .from('pain_logs')
      .select('id')
      .eq('user_program_id', userProgramId)
      .eq('program_day_id', programDayId)
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        if (data) setCheckInDone(true);
        else setCheckInVisible(true);
      });
    return () => {
      cancelled = true;
    };
  }, [checkInDone, dayOpenable, userProgramId, programDayId]);
  async function confirmCheckIn(value: number) {
    if (!userId || !userProgramId || !programDayId || checkInSubmitting) return;
    setCheckInSubmitting(true);
    try {
      const { error } = await supabase.from('pain_logs').insert({
        user_id: userId,
        user_program_id: userProgramId,
        program_day_id: programDayId,
        score: value,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['pain_logs', userProgramId] });
      // Only a SAVED score counts as answered. This used to run in `finally`,
      // so a failed insert still closed the modal and latched `checkInDone` —
      // the reading was gone and the screen never asked again.
      setCheckInDone(true);
      setCheckInVisible(false);
    } catch {
      Alert.alert(t('sendFailTitle'), t('checkNetworkRetry'));
    } finally {
      setCheckInSubmitting(false);
    }
  }

  if (programsQuery.isPending || daysQuery.isPending) {
    return (
      <ScreenContainer tone="glass">
        <BackBar tone="glass" onBack={() => router.back()} title={`${t('day')} ${dayId}`} />
        <View style={styles.loadingBox}>
          <ActivityIndicator color={homeGlassColors.tick} />
        </View>
      </ScreenContainer>
    );
  }
  // A failed day/program fetch used to `return null` — a completely blank
  // screen with no way back, on the very screen a "time to train" push opens.
  // Give it the same back bar and retry the rest of the app uses.
  if (!d) {
    const loadFailed = programsQuery.isError || daysQuery.isError;
    return (
      <ScreenContainer tone="glass">
        <BackBar tone="glass" onBack={() => router.back()} title={`${t('day')} ${dayId}`} />
        <View style={styles.loadingBox}>
          <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text, textAlign: 'center' }]}>
            {loadFailed ? t('homeLoadErrorTitle') : t('noToolsTitle')}
          </Text>
          <Text style={[theme.type.body, { color: homeGlassColors.textMuted, textAlign: 'center', marginTop: 8 }]}>
            {loadFailed ? t('checkNetworkRetry') : t('roadmapComingSoonBody')}
          </Text>
          {loadFailed ? (
            <Pressable
              onPress={() => { void programsQuery.refetch(); void daysQuery.refetch(); }}
              style={{ marginTop: 16 }}
              accessibilityRole="button"
            >
              <Text style={[theme.type.bodyStrong, { color: homeGlassColors.tick }]}>{t('retry')}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScreenContainer>
    );
  }
  if (!lockDataReady || phaseLocked || productUnpublished) {
    return (
      <ScreenContainer tone="glass">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={homeGlassColors.tick} />
        </View>
      </ScreenContainer>
    );
  }

  // Calendar-unlock mechanic: watching the video is what records completion
  // (no completion button, no pain gate). Days beyond tomorrow's midnight
  // unlock are still viewable but never record progress.
  const progressLocked = paidPhase ? !dayOpenable : d.status === 'locked' || d.status === 'upcoming';
  const canRecordWatch =
    !!program &&
    (paidPhase ? dayOpenable && d.status !== 'done' : d.status === 'current' || d.status === 'missed');
  const videoUrl = normalizeVideoUrl(d.video);
  const supportToolsUrl = normalizeVideoUrl(d.supportToolsUrl);
  // Admin can name this per day/market; fall back to the translated default.
  const supportToolsLabel = d.supportToolsLabel || t('supportTools');
  const videoId = youtubeVideoId(videoUrl);

  // Marks the day watched the first time the user actually starts the video
  // (in-frame play, the "Xem trên Youtube" button, or the error-fallback
  // YouTube link). Idempotent server-side; celebration alerts only fire on
  // the transition (RPC returns whether it was newly marked).
  function recordWatch() {
    if (!canRecordWatch || !program || !d || markWatched.isPending || d.status === 'done') return;
    markWatched.mutate(
      { userProgramId: program.userProgramId, programDayId: d.programDayId },
      {
        onError: () => Alert.alert(t('errGeneric'), t('tryAgainBody')),
        onSuccess: (newly) => {
          if (!newly || !d || !program) return;
          const totalDays = progress.totalDays || program.product.totalDays;
          const completedProgram = d.id >= totalDays;
          const milestone = d.id === 7 || d.id === 14;
          if (!completedProgram && !milestone) return;
          Alert.alert(
            t('achievementTitle'),
            completedProgram ? t('achievementBodyProgram') : t('achievementBodyDays', { days: d.id }),
            [
              { text: t('later'), style: 'cancel' },
              {
                text: t('share'),
                onPress: () => router.push({
                  pathname: '/community/create',
                  params: completedProgram ? { achievement: 'program' } : { achievement: 'streak', milestone: String(d.id) },
                }),
              },
            ],
          );
        },
      },
    );
  }

  return (
    <ScreenContainer tone="glass">
      <BackBar tone="glass" onBack={() => router.back()} title={`${t('day')} ${d.id}`} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[theme.type.caption, { color: homeGlassColors.textMuted, marginBottom: 16 }]}>{d.phase}</Text>

        <View
          onLayout={(event) => setVideoWidth(event.nativeEvent.layout.width)}
          style={[
            styles.videoBox,
            { backgroundColor: homeGlassColors.surfaceRaised, borderColor: homeGlassColors.hairline, borderRadius: theme.radius.lg },
          ]}
        >
          {videoId && !videoError && videoWidth > 0 && transitionDone ? (
            <>
            <YoutubePlayer
              key={videoId}
              height={videoWidth * 9 / 16}
              width={videoWidth}
              videoId={videoId}
              onChangeState={(state: string) => {
                if (state === 'playing') recordWatch();
              }}
              onError={() => setVideoError(true)}
              onReady={() => setVideoReady(true)}
              initialPlayerParams={{ playsinline: true, controls: true, rel: false, ...youtubePlayerLangParams(language) }}
              webViewProps={{
                allowsFullscreenVideo: true,
                allowsInlineMediaPlayback: true,
                mediaPlaybackRequiresUserAction: true,
              }}
            />
            {!videoReady ? (
              <View style={[styles.videoLoadingOverlay, { backgroundColor: homeGlassColors.surfaceRaised }]}>
                <ActivityIndicator color={homeGlassColors.tick} />
                <Text style={[theme.type.caption, { color: homeGlassColors.textMuted }]}>{t('loadingVideo')}</Text>
              </View>
            ) : null}
            </>
          ) : videoError ? (
            <View style={styles.videoFallback}>
              <Icon name="film" size={28} color={homeGlassColors.textFaint} />
              <Text style={[theme.type.caption, { color: homeGlassColors.textMuted, textAlign: 'center' }]}>{t('inlineVideoError')}</Text>
              <Pressable
                onPress={() => {
                  recordWatch();
                  void WebBrowser.openBrowserAsync(d.video);
                }}
              >
                <Text style={[theme.type.bodyStrong, { color: homeGlassColors.tick }]}>{t('openYoutube')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.videoFallback}>
              {videoUrl ? <ActivityIndicator color={homeGlassColors.tick} /> : <Icon name="film" size={28} color={homeGlassColors.textFaint} />}
              <Text style={[theme.type.caption, { color: homeGlassColors.textMuted, textAlign: 'center' }]}> 
                {videoUrl ? t('loadingVideo') : t('videoUnavailableMessage')}
              </Text>
            </View>
          )}
        </View>

        {/* Advice about how to WATCH, so it goes away once the day has been
            watched. Leaving it up put a tip telling you to press the button
            directly above the button, on a screen that had already recorded
            you pressing it. */}
        {d.status !== 'done' ? (
          <View style={[styles.videoTip, { backgroundColor: homeGlassColors.surfaceRaised, borderColor: homeGlassColors.hairline }]}> 
            <Icon name="sparkles" size={17} color={homeGlassColors.tick} />
            <Text style={[theme.type.caption, styles.videoTipText, { color: homeGlassColors.textMuted }]}>{t('videoTip')}</Text>
          </View>
        ) : null}

        {/* No "Xem trên Youtube" button here any more (owner, 2026-11-03).
            The embed above already plays the lesson in the app; a primary
            button that left for the browser was the one thing on this screen
            that made watching feel like a trip to YouTube. The fallback for
            an embed that genuinely cannot play still offers the link. */}
        <View style={{ gap: 12 }}>
          {progressLocked ? (
            <View style={[styles.previewHint, { backgroundColor: homeGlassColors.surfaceRaised, borderColor: homeGlassColors.hairline }]}> 
              <Icon name="lock" size={17} color={homeGlassColors.textMuted} />
              <Text style={[theme.type.caption, { color: homeGlassColors.textMuted, flex: 1 }]}>{t('lockedPreviewHint')}</Text>
            </View>
          ) : null}
          {canRecordWatch && d.status !== 'done' ? (
            <View style={[styles.completionHint, { backgroundColor: homeGlassColors.surfaceRaised, borderColor: homeGlassColors.hairline }]}> 
              <View style={styles.completionHintTitle}>
                <Icon name="play" size={19} color={homeGlassColors.tick} />
                <Text style={[theme.type.bodyStrong, { color: homeGlassColors.tick }]}>{t('watchToCompleteTitle')}</Text>
              </View>
              <Text style={[theme.type.caption, { color: homeGlassColors.textMuted }]}> 
                {t('watchToCompleteHint')}
              </Text>
            </View>
          ) : null}
          {d.status === 'done' ? (
            // A receipt, not a card. As a full-width tinted band it carried
            // the visual weight of the things below it that you can actually
            // press, and sat directly above a second confirmation line about
            // the xu — two announcements of one event.
            <View style={styles.completedRow}>
              <Icon name="check" size={16} color={homeGlassColors.dotDone} />
              <Text style={[theme.type.caption, { color: homeGlassColors.dotDone }]}>{t('completed')}</Text>
            </View>
          ) : null}
          {/* Support-tools link is optional: when Admin leaves the day's
              support-tools URL empty (for this market), the button is hidden
              entirely rather than showing a dead button that alerts "no link"
              — per explicit request 2026-09-09. */}
          {supportToolsUrl ? (
            <Pressable
              onPress={() => setPendingUrl(supportToolsUrl)}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: homeGlassColors.surface,
                  borderWidth: 1,
                  borderColor: homeGlassColors.hairline,
                  borderRadius: theme.radius.md,
                },
              ]}
            >
              <Icon name="external-link" size={18} color={homeGlassColors.tick} />
              <Text numberOfLines={1} style={[theme.type.button, { color: homeGlassColors.tick }]}>{supportToolsLabel}</Text>
            </Pressable>
          ) : null}
          {/* The xu cards and the send-a-clip-to-a-specialist card were
              taken off this screen (owner, 2026-10-25). What is left is the
              live posture check, which answers "tôi tập thế này đúng chưa"
              while you are still on the mat; it hides itself when it has
              nothing to offer. */}
          {!progressLocked ? (
            <LiveFormCard
              userId={userId}
              productId={productId}
              dayNumber={d.id}
              programDayId={programDayId}
            />
          ) : null}
        </View>
      </ScrollView>
      {pendingUrl ? <ExternalLinkModal url={pendingUrl} onClose={() => setPendingUrl(null)} /> : null}
      {checkInVisible && d ? (
        <PainScaleModal
          dayId={d.id}
          onCancel={() => {
            setCheckInVisible(false);
            setCheckInDone(true);
          }}
          onConfirm={(value) => void confirmCheckIn(value)}
          submitting={checkInSubmitting}
        />
      ) : null}
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
  videoLoadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  videoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
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
    gap: 7,
    paddingHorizontal: 4,
    paddingVertical: 2,
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

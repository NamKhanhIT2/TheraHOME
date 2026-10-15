// The call buttons in a chat header — two of them, voice and video, the way
// Messenger and Zalo put them.
//
// Used from BOTH sides now: the customer's support thread calls the line
// (`calleeId` omitted), and CSKH's thread screen calls that customer back
// (`calleeId` set). The only difference is which props come in; the RPC is
// the thing that decides whether the direction is allowed.
//
// It does not decide anything about the outcome. One tap creates the call row
// and navigates to the call screen, which renders whatever happened —
// ringing, answered, or 'busy' because the single support line is taken.
// That keeps one screen responsible for every state of a call.
//
// Hidden rather than disabled on a build without the native LiveKit modules
// (an older dev client or TestFlight build — see src/lib/livekit.ts): a
// button that cannot work should not be there to tap.
import React from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { hapticConfirm } from '@/lib/haptics';
import { useStartCall, type CallMedia } from '@/hooks/useCalls';
import { isCallSupported } from '@/lib/livekit';
import { useI18n } from '@/lib/i18n';
import { usePlanGate } from '@/hooks/usePlanGate';
import { errorMessage } from '@/lib/errorMessage';
import { getCallSession } from '@/lib/callSession';

export function CallButton({ threadId, calleeId }: {
  threadId: string | undefined;
  /** Staff pass the customer they are calling. Omitted by the customer,
   * whose call goes to the support line. */
  calleeId?: string | null;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const startCall = useStartCall();
  const askForPlan = usePlanGate();
  const [supported] = React.useState(isCallSupported);

  if (!supported) return null;

  function place(media: CallMedia) {
    if (startCall.isPending) return;
    const current = getCallSession();
    if (current) {
      router.navigate({ pathname: '/call/[callId]', params: { callId: current.callId } });
      return;
    }
    hapticConfirm();
    startCall.mutate(
      { threadId: threadId ?? null, calleeId: calleeId ?? null, media },
      {
        onSuccess: (call) => router.push({ pathname: '/call/[callId]', params: { callId: call.id } }),
        // `start_call` refuses a caller with no plan, and separately one who
        // has spent a finite minute allowance. Both used to surface as
        // "kiểm tra kết nối mạng" — blaming the network for a decision the
        // server made on purpose, which leaves the customer retrying
        // something that will never work.
        //
        // `errorMessage`, not `error instanceof Error`: an RPC error is the
        // parsed response body, a plain object, so the instanceof guard read
        // "[object Object]" and every refusal fell through to the network
        // line. Build 37 shipped with exactly that — see lib/errorMessage.ts.
        onError: (error: unknown) => {
          const message = errorMessage(error);
          if (message.includes('plan_required')) {
            askForPlan('featureCall');
            return;
          }
          if (message.includes('call_minutes_exhausted')) {
            Alert.alert(t('callFailedTitle'), t('callMinutesUsedUp'));
            return;
          }
          Alert.alert(t('callFailedTitle'), t('callFailedBody'));
        },
      },
    );
  }

  return (
    <View style={styles.row}>
      <HeaderCallButton
        icon="video"
        label={t('callVideoLabel')}
        busy={startCall.isPending}
        onPress={() => place('video')}
        tint={theme.colors.primary}
        background={theme.colors.primaryTint10}
      />
      <HeaderCallButton
        icon="phone"
        label={t('callVoiceLabel')}
        busy={startCall.isPending}
        onPress={() => place('audio')}
        tint={theme.colors.primary}
        background={theme.colors.primaryTint10}
      />
    </View>
  );
}

function HeaderCallButton({ icon, label, busy, onPress, tint, background }: {
  icon: string; label: string; busy: boolean; onPress: () => void; tint: string; background: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: background, opacity: pressed || busy ? 0.7 : 1 }]}
    >
      {busy ? <ActivityIndicator size="small" color={tint} /> : <Icon name={icon} size={19} color={tint} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  button: { width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});

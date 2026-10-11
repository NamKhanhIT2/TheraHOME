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

export function CallButton({ threadId, calleeId }: {
  threadId: string | undefined;
  /** Staff pass the customer they are calling. Omitted by the customer,
   * whose call goes to the support line. */
  calleeId?: string | null;
}) {
  const theme = useTheme();
  const startCall = useStartCall();
  const [supported] = React.useState(isCallSupported);

  if (!supported) return null;

  function place(media: CallMedia) {
    if (startCall.isPending) return;
    hapticConfirm();
    startCall.mutate(
      { threadId: threadId ?? null, calleeId: calleeId ?? null, media },
      {
        onSuccess: (call) => router.push({ pathname: '/call/[callId]', params: { callId: call.id } }),
        onError: () => Alert.alert('Không gọi được', 'Vui lòng kiểm tra kết nối mạng rồi thử lại.'),
      },
    );
  }

  return (
    <View style={styles.row}>
      <HeaderCallButton
        icon="video"
        label="Gọi video"
        busy={startCall.isPending}
        onPress={() => place('video')}
        tint={theme.colors.primary}
        background={theme.colors.primaryTint10}
      />
      <HeaderCallButton
        icon="phone"
        label="Gọi thoại"
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

// "Gọi CSKH" — the customer's way into a voice call, from the human chat
// header.
//
// It does not decide anything about the outcome. One tap creates the call row
// and navigates to the call screen, which then renders whatever happened:
// ringing, answered, or 'busy' because the single support line is taken. That
// keeps one screen responsible for every state of a call instead of spreading
// the busy case into the chat header.
//
// Hidden rather than disabled on a build without the native LiveKit modules
// (an older dev client or TestFlight build — see src/lib/livekit.ts): a
// button that cannot work should not be there to tap.
import React from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { hapticConfirm } from '@/lib/haptics';
import { useStartCall } from '@/hooks/useCalls';
import { isCallSupported } from '@/lib/livekit';

export function CallButton({ threadId }: { threadId: string | undefined }) {
  const theme = useTheme();
  const startCall = useStartCall();
  const [supported] = React.useState(isCallSupported);

  if (!supported) return null;

  function press() {
    if (startCall.isPending) return;
    hapticConfirm();
    startCall.mutate(threadId ?? null, {
      onSuccess: (call) => router.push({ pathname: '/call/[callId]', params: { callId: call.id } }),
      onError: () => Alert.alert('Không gọi được', 'Vui lòng kiểm tra kết nối mạng rồi thử lại.'),
    });
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Gọi cho CSKH"
      hitSlop={8}
      onPress={press}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.colors.primaryTint10, opacity: pressed || startCall.isPending ? 0.7 : 1 },
      ]}
    >
      {startCall.isPending
        ? <ActivityIndicator size="small" color={theme.colors.primary} />
        : <Icon name="phone" size={20} color={theme.colors.primary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});

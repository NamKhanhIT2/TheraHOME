// CSKH's ringing phone — mounted once in the staff shell so it appears over
// whichever tab they are on.
//
// This is the free-tier substitute for a native incoming-call screen. A real
// one (CallKit on iOS, a full-screen intent on Android) rings while the app is
// closed and costs either a paid signaling plan or several days of native
// work; this covers the case that actually matters for a support line, where
// the staff phone sits with the app open during working hours. Outside those
// hours the push notification from `dispatch-push` is what arrives, and
// tapping it lands on the same call screen.
//
// Deliberately NOT a route: a modal that can appear on top of the staff's
// current screen does not disturb what they were doing, and declining leaves
// them exactly where they were. Answering is what navigates.
import React, { useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { AvatarImg } from '@/components/AvatarImg';
import { Icon } from '@/components/icons/Icon';
import { hapticConfirm, hapticPressHold } from '@/lib/haptics';
import { useAnswerCall, useCallTerminator, useCallerProfile, useIncomingCall } from '@/hooks/useCalls';

export function IncomingCallSheet({ enabled }: { enabled: boolean }) {
  const theme = useTheme();
  const incoming = useIncomingCall(enabled);
  const call = incoming.data ?? null;
  const caller = useCallerProfile(call?.callerId);
  const answerCall = useAnswerCall();
  const terminate = useCallTerminator(call?.id);

  // One buzz per call, not per refetch. `useIncomingCall` polls as a fallback
  // for a dropped socket, and without this the phone would vibrate every few
  // seconds for the same ring.
  const buzzedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!call || buzzedForRef.current === call.id) return;
    buzzedForRef.current = call.id;
    hapticPressHold();
  }, [call]);

  if (!call) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => { /* must be answered or declined */ }}>
      <View style={[styles.backdrop, { backgroundColor: theme.colors.overlayScrim }]}>
        <View style={[styles.card, { backgroundColor: theme.colors.bgCard }]}>
          <Text style={[theme.type.captionSm, { color: theme.colors.primary, letterSpacing: 0.4 }]}>
            CUỘC GỌI ĐẾN
          </Text>
          <AvatarImg size={76} uri={caller.data?.avatarUrl} />
          <Text style={[theme.type.h2, { color: theme.colors.textPrimary, textAlign: 'center' }]}>
            {caller.data?.fullName ?? 'Khách hàng'}
          </Text>
          {caller.data?.phone ? (
            <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>{caller.data.phone}</Text>
          ) : null}

          <View style={styles.actions}>
            <Action
              color={theme.colors.error}
              icon="phone-off"
              label="Từ chối"
              onPress={() => { hapticConfirm(); void terminate('declined', 'declined'); }}
            />
            <Action
              color={theme.colors.success}
              icon="phone"
              label="Trả lời"
              disabled={answerCall.isPending}
              onPress={() => {
                hapticConfirm();
                answerCall.mutate(call.id, {
                  // Navigating only after the server has accepted means the
                  // call screen opens straight into the connecting state and
                  // never has to handle "I am staff, on a ringing call, but
                  // my answer may still fail".
                  onSuccess: () => router.push({ pathname: '/call/[callId]', params: { callId: call.id } }),
                });
              }}
            />
          </View>
          {/* The customer's own 45-second timer ends the call, which clears
              this sheet through Realtime. No countdown is shown: a visible
              clock would only pressure whoever is about to pick up. */}
          <Text style={[theme.type.captionSm, { color: theme.colors.textMuted, textAlign: 'center' }]}>
            Khách đang chờ trên ứng dụng TheraHOME
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function Action({ color, icon, label, onPress, disabled }: {
  color: string; icon: string; label: string; onPress: () => void; disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.actionWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.round, { backgroundColor: color, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
      >
        <Icon name={icon} size={27} color="#fff" />
      </Pressable>
      <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  card: { width: '100%', borderRadius: 28, paddingVertical: 28, paddingHorizontal: 24, alignItems: 'center', gap: 10 },
  actions: { flexDirection: 'row', gap: 48, marginTop: 14, marginBottom: 6 },
  actionWrap: { alignItems: 'center', gap: 7 },
  round: { width: 62, height: 62, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});

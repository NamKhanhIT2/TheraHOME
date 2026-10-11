// A ringing phone — mounted once per shell so it appears over whatever the
// user is doing.
//
// Serves BOTH directions now. Staff see calls addressed to the support line;
// a customer sees a call CSKH placed to them. `useIncomingCall` does the
// filtering, so this component only has to know which way round it is in
// order to label the other party.
//
// It rings out loud. The first version buzzed once and showed a modal, which
// meant a phone face-down on a desk rang silently — the owner's first report
// was "tôi chưa nghe tiếng chuông gọi đến". `useRingtone` loops a real ring
// cadence and vibrates with it, and stops on every way out.
//
// Still not a native lock-screen ring: that needs CallKit on iOS and a
// full-screen intent on Android. This covers the app being open or in the
// foreground; the push from `dispatch-push` covers the rest.
import React, { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { AvatarImg } from '@/components/AvatarImg';
import { Icon } from '@/components/icons/Icon';
import { hapticConfirm } from '@/lib/haptics';
import { useRingtone } from '@/hooks/useRingtone';
import { dismissCall, isSystemRinging, subscribeSystemRinging, wasAnsweredHere } from '@/lib/callkeep';
import { useAnswerCall, useCallTerminator, useCallerProfile, useIncomingCall } from '@/hooks/useCalls';

export function IncomingCallSheet({ enabled, userId, isStaff }: {
  enabled: boolean;
  userId: string | undefined;
  isStaff: boolean;
}) {
  const theme = useTheme();
  const incoming = useIncomingCall({ enabled, userId, isStaff });
  const call = incoming.data ?? null;
  // Staff are being called by a customer, so look the caller up. A customer
  // is being called by TheraHOME, which needs no lookup.
  const caller = useCallerProfile(isStaff ? call?.callerId : undefined);
  const answerCall = useAnswerCall();
  const terminate = useCallTerminator(call?.id);
  const isVideo = call?.media === 'video';

  // Whether the OS is already showing a call screen for this call. On iOS it
  // almost always is: a VoIP push makes CallKit ring in native code before
  // any JS runs. Subscribed rather than read once, so a sheet that is
  // already up disappears the moment CallKit catches up.
  const systemHasIt = useSyncExternalStore(
    subscribeSystemRinging,
    useCallback(() => (call ? isSystemRinging(call.id) : false), [call]),
  );

  // Rings while the sheet is up, and the hook's own cleanup stops it on
  // answer, decline, timeout and unmount alike. Silent when the system is
  // ringing — two ringtones out of one phone sound like a fault.
  useRingtone(!!call && !systemHasIt, 'incoming');

  // Belt and braces against the ringtone outliving the call: if the row
  // disappears for any reason the component unmounts, and this records that
  // the ring for THIS call is done so a re-render cannot restart it.
  const rungForRef = useRef<string | null>(null);
  useEffect(() => {
    if (call) rungForRef.current = call.id;
  }, [call]);

  // The system may ALSO be ringing for this call — a push raised the telecom
  // screen while the app happened to be alive in the background. When the
  // row stops ringing without this device answering (the caller gave up, or
  // another CSKH phone took it), that screen has to come down too: nothing
  // else will, and a phone left ringing for a call that no longer exists is
  // both alarming and, on Android, a blocked line for the NEXT call.
  //
  // Only when this device did not answer. Answering also makes the row stop
  // ringing, and dismissing then would hang up on the live call.
  const ringingSystemCallRef = useRef<string | null>(null);
  useEffect(() => {
    const previous = ringingSystemCallRef.current;
    ringingSystemCallRef.current = call?.id ?? null;
    if (previous && previous !== call?.id && !wasAnsweredHere(previous)) {
      dismissCall(previous);
    }
  }, [call?.id]);

  if (!call) return null;
  // The system has it: CallKit on iOS, the telecom call screen on Android.
  // Drawing our own sheet on top produced two of everything — two names, two
  // Decline buttons — and the owner had to press both before the call
  // stopped. Whichever UI is on screen, Từ chối ends the same `calls` row;
  // there should only ever be one of them.
  if (systemHasIt) return null;

  const name = isStaff ? (caller.data?.fullName ?? 'Khách hàng') : 'TheraHOME CSKH';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => { /* answer or decline */ }}>
      <View style={[styles.backdrop, { backgroundColor: theme.colors.overlayScrim }]}>
        <View style={[styles.card, { backgroundColor: theme.colors.bgCard }]}>
          <Text style={[theme.type.captionSm, { color: theme.colors.primary, letterSpacing: 0.4 }]}>
            {isVideo ? 'CUỘC GỌI VIDEO ĐẾN' : 'CUỘC GỌI ĐẾN'}
          </Text>

          {isStaff ? (
            <AvatarImg size={76} uri={caller.data?.avatarUrl} />
          ) : (
            <View style={[styles.brandAvatar, { backgroundColor: theme.colors.primaryTint10 }]}>
              <Icon name="headphones" size={34} color={theme.colors.primary} />
            </View>
          )}

          <Text style={[theme.type.h2, { color: theme.colors.textPrimary, textAlign: 'center' }]}>{name}</Text>
          {isStaff && caller.data?.phone ? (
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
              icon={isVideo ? 'video' : 'phone'}
              label="Trả lời"
              disabled={answerCall.isPending}
              onPress={() => {
                hapticConfirm();
                answerCall.mutate(call.id, {
                  // Navigate only once the server has accepted, so the call
                  // screen opens straight into connecting and never has to
                  // handle "my answer might still fail".
                  onSuccess: () => router.push({ pathname: '/call/[callId]', params: { callId: call.id } }),
                });
              }}
            />
          </View>

          <Text style={[theme.type.captionSm, { color: theme.colors.textMuted, textAlign: 'center' }]}>
            {isStaff ? 'Khách đang chờ trên ứng dụng TheraHOME' : 'Nhân viên hỗ trợ đang gọi cho bạn'}
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
  brandAvatar: { width: 76, height: 76, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 48, marginTop: 14, marginBottom: 6 },
  actionWrap: { alignItems: 'center', gap: 7 },
  round: { width: 62, height: 62, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});

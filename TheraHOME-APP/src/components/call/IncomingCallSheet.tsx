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
import React, { useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { AvatarImg } from '@/components/AvatarImg';
import { Icon } from '@/components/icons/Icon';
import { hapticConfirm } from '@/lib/haptics';
import { useRingtone } from '@/hooks/useRingtone';
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

  // Rings while the sheet is up, and the hook's own cleanup stops it on
  // answer, decline, timeout and unmount alike.
  useRingtone(!!call, 'incoming');

  // Belt and braces against the ringtone outliving the call: if the row
  // disappears for any reason the component unmounts, and this records that
  // the ring for THIS call is done so a re-render cannot restart it.
  const rungForRef = useRef<string | null>(null);
  useEffect(() => {
    if (call) rungForRef.current = call.id;
  }, [call]);

  if (!call) return null;

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

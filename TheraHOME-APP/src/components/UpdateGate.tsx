// "Đã có bản mới" — and, when it has to be said, "bản này không dùng được nữa".
//
// Neither store tells anybody an update exists, so the app says it itself.
// The whole decision lives in src/lib/appUpdate.ts; this file is what it
// looks like. Two shapes, and the difference between them is the whole
// design:
//
//   optional — a card with a Để sau. Asked once per installed version:
//              dismissing records the version in hand, and the NEXT release
//              makes that record stale, so the nudge comes back by itself
//              without ever nagging twice for the same build.
//   required — the same card with no Để sau and no backdrop to tap. It is
//              a wall, and it is drawn over everything including
//              onboarding, because the point is that this binary can no
//              longer talk to the server safely.
//
// Shipped OFF. Both thresholds are empty in app_config until somebody sets
// them in WEB Admin, and empty means nothing is ever shown.
import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useTheme } from '@/theme';
import { useI18n } from '@/lib/i18n';
import { Icon } from '@/components/icons/Icon';
import { useAppStore } from '@/store/useAppStore';
import { useAppConfig } from '@/hooks/useAppConfig';
import { decideUpdate, openStorePage } from '@/lib/appUpdate';

export function UpdateGate() {
  const theme = useTheme();
  const { t } = useI18n();
  const { get, isLoading } = useAppConfig();
  const dismissedAt = useAppStore((s) => s.updateNagDismissedAt);
  const dismiss = useAppStore((s) => s.dismissUpdateNag);
  const [opening, setOpening] = useState(false);

  // The version this binary was built with — app.json's `version`, which is
  // the string both stores show. Not the versionCode/build number: those
  // count differently on each platform and are not what an admin is looking
  // at when they type a threshold.
  const current = Constants.expoConfig?.version ?? null;
  const ios = Platform.OS === 'ios';
  const state = decideUpdate({
    current,
    minimum: get(ios ? 'ios_min_version' : 'android_min_version'),
    latest: get(ios ? 'ios_latest_version' : 'android_latest_version'),
  });

  // While the config is still loading there is no evidence of anything, and
  // a wall drawn on no evidence is the one failure this feature must not
  // have. `decideUpdate` already fails open; this is the same rule one step
  // earlier.
  if (isLoading || state === 'none') return null;
  // Said no to this exact build already. Only applies to the nudge — there
  // is no dismissing a required update, which is what "required" means.
  if (state === 'optional' && current && dismissedAt === current) return null;

  const required = state === 'required';
  const close = () => { if (current) dismiss(current); };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      // Android's back button closes a Modal by default, which would walk
      // straight through a required update.
      onRequestClose={required ? () => undefined : close}
      statusBarTranslucent
    >
      <View style={[styles.backdrop, { backgroundColor: 'rgba(16,20,24,0.55)' }]}>
        <View style={[styles.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}>
          <View style={[styles.badge, { backgroundColor: theme.colors.primaryTint10 }]}>
            {/* `download` in both states, on purpose. There is no warning
                glyph in src/components/icons/Icon.tsx, and the Icon wrapper
                takes a plain string — a name that is not in its map renders
                nothing at all, silently (see CLAUDE.md). The action is the
                same either way, so the icon may as well be. */}
            <Icon name="download" size={22} color={theme.colors.primary} />
          </View>
          <Text style={[theme.type.h2, { color: theme.colors.textPrimary, textAlign: 'center' }]}>
            {t(required ? 'updateRequiredTitle' : 'updateAvailableTitle')}
          </Text>
          <Text style={[theme.type.body, { color: theme.colors.textSecondary, textAlign: 'center' }]}>
            {t(required ? 'updateRequiredBody' : 'updateAvailableBody')}
          </Text>

          <Pressable
            accessibilityRole="button"
            disabled={opening}
            style={[styles.cta, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md }]}
            onPress={() => {
              setOpening(true);
              // Leaves the gate standing. Coming back from the store
              // without updating must land on the same wall, not in the app.
              void openStorePage().finally(() => setOpening(false));
            }}
          >
            <Text style={[theme.type.bodyStrong, { color: theme.colors.textOnPrimary }]}>{t('updateCta')}</Text>
          </Pressable>

          {required ? null : (
            <Pressable style={styles.later} onPress={close} hitSlop={6}>
              <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>{t('updateLater')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, alignItems: 'center', gap: 12, padding: 24 },
  badge: { width: 48, height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  cta: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  later: { paddingVertical: 8 },
});

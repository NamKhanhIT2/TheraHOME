import React, { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { useSpecialistPresence } from '@/hooks/useChat';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Icon } from '@/components/icons/Icon';
import { OnlineIndicator } from '@/components/AssistantBubble';
import { useI18n } from '@/lib/i18n';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useFaqItems } from '@/hooks/useFaqItems';

const AI_ASSISTANT_IMAGE = require('../../assets/ai-assistant.png');
const SPECIALIST_IMAGE = require('../../assets/therahome-specialist.png');

function FaqItem({ q, a }: { q: string; a: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.faqItem, { borderBottomColor: theme.colors.divider }]}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.faqHeader}>
        <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, flex: 1 }]}>{q}</Text>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} color={theme.colors.textMuted} />
      </Pressable>
      {open ? <Text style={[theme.type.body, { color: theme.colors.textSecondary, paddingHorizontal: 16, paddingBottom: 14 }]}>{a}</Text> : null}
    </View>
  );
}

export default function HelpSupportScreen() {
  // Hotline/email are admin-editable (app_config) — see useAppConfig.
  const appConfig = useAppConfig();
  const hotline = appConfig.get('support_hotline').trim();
  const theme = useTheme();
  const { t } = useI18n();
  const specialistOnline = useSpecialistPresence();
  // Admin/CSKH-managed (faq_items); falls back to the bundled i18n pairs.
  const faqs = useFaqItems();

  return (
    <ScreenContainer>
      <BackBar onBack={() => router.back()} title={t('helpSupport')} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[theme.type.h2, { color: theme.colors.textPrimary, marginBottom: 10 }]}>{t('faq')}</Text>
        <View style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, marginBottom: 24 }]}> 
          {faqs.map((f, i) => (
            <FaqItem key={i} q={f.q} a={f.a} />
          ))}
        </View>

        {/* Easy-to-find source citation for the app's training guidance —
            App Review asked for health-adjacent content to cite a source. */}
        <Text style={[theme.type.h2, { color: theme.colors.textPrimary, marginBottom: 10 }]}>{t('sourcesTitle')}</Text>
        <View style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, marginBottom: 24, padding: 14 }]}>
          <Text style={[theme.type.caption, { color: theme.colors.textSecondary, lineHeight: 19 }]}>{t('sourcesBody')}</Text>
          <Pressable onPress={() => Linking.openURL('https://www.who.int/news-room/fact-sheets/detail/physical-activity')} hitSlop={6}>
            <Text style={[theme.type.caption, { color: theme.colors.primary, marginTop: 8, fontFamily: theme.fontFamily.semiBold }]}>
              {t('sourcesLink')}
            </Text>
          </Pressable>
        </View>

        <Text style={[theme.type.h2, { color: theme.colors.textPrimary, marginBottom: 10 }]}>{t('supportContact')}</Text>
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={() => router.push('/chat/ai')}
            style={[styles.contactRow, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}
          >
            <Image source={AI_ASSISTANT_IMAGE} style={styles.iconCircle} resizeMode="cover" />
            <View style={{ flex: 1 }}>
              <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{t('aiAssistant')}</Text>
              <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>{t('instantReplies')}</Text>
            </View>
            <Icon name="chevron-right" size={16} color={theme.colors.textMuted} />
          </Pressable>

          <Pressable
            onPress={() => router.push('/chat/human')}
            style={[styles.contactRow, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}
          >
            <Image source={SPECIALIST_IMAGE} style={styles.iconCircle} resizeMode="cover" />
            <View style={{ flex: 1 }}>
              <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{t('specialist')}</Text>
              <OnlineIndicator online={specialistOnline} />
            </View>
            <Icon name="chevron-right" size={16} color={theme.colors.textMuted} />
          </Pressable>

          {/* Hotline row only exists once admin fills a number in WEB Admin
              (Nội dung ứng dụng). TheraHOME has none today, and shipping a
              placeholder number is a real App Review risk. */}
          {hotline ? (
            <Pressable
              onPress={() => Linking.openURL(`tel:${hotline}`)}
              style={[styles.contactRow, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}
            >
              <Icon name="external-link" size={20} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{t('supportHotline')}</Text>
                {appConfig.get('support_hotline_label') ? (
                  <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>{appConfig.get('support_hotline_label')}</Text>
                ) : null}
              </View>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => Linking.openURL(`mailto:${appConfig.get('support_email')}`)}
            style={[styles.contactRow, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}
          >
            <Icon name="external-link" size={20} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{t('supportEmail')}</Text>
              <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>{appConfig.get('support_email')}</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 40,
  },
  card: {
    overflow: 'hidden',
  },
  faqItem: {
    borderBottomWidth: 1,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

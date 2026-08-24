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
  const theme = useTheme();
  const { t } = useI18n();
  const specialistOnline = useSpecialistPresence();
  const faqs = [
    { q: t('faqUnlockQuestion'), a: t('faqUnlockAnswer') },
    { q: t('faqAreaQuestion'), a: t('faqAreaAnswer') },
    { q: t('faqMedicalQuestion'), a: t('faqMedicalAnswer') },
  ];

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

          <Pressable
            onPress={() => Linking.openURL('tel:19001234')}
            style={[styles.contactRow, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}
          >
            <Icon name="external-link" size={20} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{t('supportHotline')}</Text>
              <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>1900 1234 · 8:00–21:00</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => Linking.openURL('mailto:support@therahomeai.com')}
            style={[styles.contactRow, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}
          >
            <Icon name="external-link" size={20} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{t('supportEmail')}</Text>
              <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>support@therahomeai.com</Text>
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

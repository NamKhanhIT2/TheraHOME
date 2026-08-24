import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Icon } from '@/components/icons/Icon';
import { useTheme } from '@/theme';
import { getOfficialArticle } from '@/lib/officialArticles';
import { useI18n } from '@/lib/i18n';

export default function OfficialArticleScreen() {
  const theme = useTheme();
  const { t, language } = useI18n();
  const { articleId } = useLocalSearchParams<{ articleId: string }>();
  const article = getOfficialArticle(articleId, language);

  return (
    <ScreenContainer>
      <BackBar onBack={() => router.back()} title={t('articles')} />
      <ScrollView contentContainerStyle={styles.body}>
        {!article ? (
          <Text style={[theme.type.body, { color: theme.colors.textMuted, textAlign: 'center', marginTop: 80 }]}>{t('noContent')}</Text>
        ) : (
          <>
            <View style={[styles.hero, { backgroundColor: theme.colors.primaryTint10, borderRadius: theme.radius.lg }]}>
              <View style={[styles.brand, { backgroundColor: theme.colors.primary }]}>
                <Icon name="heart" size={22} color="#fff" />
              </View>
              <Text style={[theme.type.caption, { color: theme.colors.primaryDark }]}>TheraHOME · {article.tag}</Text>
              <Text style={[theme.type.display, styles.title, { color: theme.colors.textPrimary }]}>{article.title}</Text>
              <Text style={[theme.type.body, { color: theme.colors.textSecondary, lineHeight: 22 }]}>{article.summary}</Text>
              <Text style={[theme.type.caption, { color: theme.colors.textMuted }]}>{t('minutesRead', { count: article.readTimeMinutes })}</Text>
            </View>
            <View style={[styles.article, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}>
              {article.body.map((paragraph, index) => (
                <Text key={index} style={[theme.type.body, styles.paragraph, { color: theme.colors.textPrimary }]}>{paragraph}</Text>
              ))}
              <View style={[styles.support, { borderColor: theme.colors.divider }]}>
                <Icon name="message-circle" size={18} color={theme.colors.primary} />
                <Text style={[theme.type.caption, { color: theme.colors.textSecondary, flex: 1 }]}>{t('articleSupport')}</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  hero: { padding: 20, gap: 10, marginTop: 8 },
  brand: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, lineHeight: 35 },
  article: { marginTop: 16, padding: 20 },
  paragraph: { lineHeight: 25, marginBottom: 16 },
  support: { flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: 1, paddingTop: 16 },
});

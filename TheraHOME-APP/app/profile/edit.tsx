import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/theme';
import { questions } from '@/lib/mockData';
import { useOnboardingContent } from '@/hooks/useOnboardingContent';
import { useSession } from '@/hooks/useSession';
import { useProfile, useUpdateProfile, uploadAvatarImage } from '@/hooks/useProfile';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Button } from '@/components/ui/Button';
import { OptionChip } from '@/components/ui/OptionChip';
import { AvatarImg } from '@/components/AvatarImg';
import { useI18n } from '@/lib/i18n';
import type { AppLanguage } from '@/store/useAppStore';

function localizeSavedAnswer(
  questionKey: string,
  value: string,
  language: AppLanguage,
  optionsFor: (lang: AppLanguage, key: string) => string[] | undefined,
): string {
  if (!value) return value;
  const legacyOptionIndex: Record<string, Record<string, number>> = {
    priority_zone: {
      'Lưng & cột sống': 1,
      'Back & spine': 1,
      'Belakang & tulang belakang': 1,
    },
  };
  const legacyIndex = legacyOptionIndex[questionKey]?.[value];
  const variants: AppLanguage[] = ['vi', 'en', 'ms'];
  const index = variants
    .map((variant) => optionsFor(variant, questionKey)?.indexOf(value) ?? -1)
    .find((optionIndex) => optionIndex >= 0);
  const localizedOptions = optionsFor(language, questionKey);
  const resolvedIndex = index != null && index >= 0 ? index : legacyIndex;
  return resolvedIndex != null && resolvedIndex >= 0 ? localizedOptions?.[resolvedIndex] ?? value : value;
}

function FieldRow({ label, value, onChangeText }: { label: string; value: string; onChangeText: (v: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary, marginBottom: 6 }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[
          styles.input,
          { borderColor: theme.colors.borderInput, borderRadius: theme.radius.md, color: theme.colors.textPrimary, backgroundColor: theme.colors.bgCard },
        ]}
      />
    </View>
  );
}

function SelectRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary, marginBottom: 6 }]}>{label}</Text>
      <View style={styles.chipsWrap}>
        {options.map((opt) => (
          <OptionChip key={opt} label={opt} active={value === opt} onPress={() => onChange(opt)} />
        ))}
      </View>
    </View>
  );
}

export default function EditProfileScreen() {
  const theme = useTheme();
  const { t, language } = useI18n();
  const { session } = useSession();
  const userId = session?.user.id;
  const profileQuery = useProfile(userId);
  const updateProfile = useUpdateProfile(userId);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [goal, setGoal] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  // Same source the onboarding screen uses, so admin wording changes show up
  // in both places instead of only one.
  const onboardingContent = useOnboardingContent();
  const optionsFor = (lang: AppLanguage, key: string) =>
    onboardingContent.getQuestions(lang).find((question) => question.key === key)?.options;
  const zoneOptions = optionsFor(language, 'priority_zone') ?? questions[1].options;
  const goalOptions = optionsFor(language, 'goal_main') ?? questions[0].options;

  useEffect(() => {
    if (!profileQuery.data) return;
    setName(profileQuery.data.fullName ?? '');
    setPhone(profileQuery.data.phone ?? '');
    setArea(profileQuery.data.treatmentArea ?? '');
    setGoal(profileQuery.data.goal ?? '');
  }, [profileQuery.data]);

  async function pickAvatar() {
    if (!userId) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true });
    if (result.canceled || !result.assets[0]) return;

    setAvatarUri(result.assets[0].uri);
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatarImage(userId, result.assets[0].uri);
      await updateProfile.mutateAsync({ avatar_url: url });
    } finally {
      setUploadingAvatar(false);
    }
  }

  function handleSave() {
    updateProfile.mutate(
      { full_name: name.trim() || null, phone: phone.trim() || null, treatment_area: area || null, goal: goal || null },
      { onSuccess: () => router.back() },
    );
  }

  if (profileQuery.isPending) {
    return (
      <ScreenContainer>
        <BackBar onBack={() => router.back()} title={t('editProfile')} />
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <BackBar onBack={() => router.back()} title={t('editProfile')} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.avatarRow}>
          <AvatarImg size={84} editable uri={avatarUri ?? profileQuery.data?.avatarUrl} onPress={pickAvatar} />
          {uploadingAvatar ? <ActivityIndicator style={{ marginTop: 8 }} color={theme.colors.primary} /> : null}
        </View>
        <FieldRow label={t('name')} value={name} onChangeText={setName} />
        <FieldRow label={t('phoneNumber')} value={phone} onChangeText={setPhone} />
        <SelectRow label={t('trainingArea')} value={localizeSavedAnswer('priority_zone', area, language, optionsFor)} options={zoneOptions} onChange={setArea} />
        <SelectRow label={t('trainingGoal')} value={localizeSavedAnswer('goal_main', goal, language, optionsFor)} options={goalOptions} onChange={setGoal} />
        <Button style={{ width: '100%', marginTop: 8 }} loading={updateProfile.isPending} onPress={handleSave}>
          {t('saveChanges')}
        </Button>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 40,
  },
  avatarRow: {
    alignItems: 'center',
    marginVertical: 20,
  },
  field: {
    marginBottom: 14,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    padding: 13,
    fontSize: 15,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});

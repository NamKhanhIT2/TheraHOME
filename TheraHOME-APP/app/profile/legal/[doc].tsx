import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { type LegalDocKey } from '@/lib/legalContent';
import { useLegalDoc } from '@/hooks/useLegalDoc';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { LegalDocBody } from '@/components/LegalDocBody';

function isLegalDocKey(v: string | undefined): v is LegalDocKey {
  return v === 'terms' || v === 'privacy' || v === 'security' || v === 'community';
}

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const docKey: LegalDocKey = isLegalDocKey(doc) ? doc : 'terms';
  // Same admin-override-aware source the body uses, so the header title
  // never disagrees with the text below it.
  const legalDoc = useLegalDoc(docKey);

  return (
    <ScreenContainer>
      <BackBar onBack={() => router.back()} title={legalDoc.title} />
      <ScrollView contentContainerStyle={styles.body}>
        <LegalDocBody docKey={docKey} />
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
});

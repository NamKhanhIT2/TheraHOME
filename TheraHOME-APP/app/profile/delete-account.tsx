import React from 'react';
import { router } from 'expo-router';
import { DeleteAccountModal } from '@/components/DeleteAccountModal';

/** Presented as a modal (see root `_layout.tsx`) over Profile — reuses the
 * same `DeleteAccountModal` confirmation UI as a dedicated route rather than
 * local component state, per the file layout this phase specifies. */
export default function DeleteAccountScreen() {
  return <DeleteAccountModal onCancel={() => router.back()} />;
}

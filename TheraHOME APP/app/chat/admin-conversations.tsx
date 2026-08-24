// Admin/cskh "Chat" entry point for the dual-role scenario (see
// AssistantBubble.tsx's isStaff branch) — a real patient whose Google
// identity is also bound to a web_access_contacts staff row. A patient
// always lands directly in their one specialist thread at /chat/human
// instead. Purely-staff TheraHOME accounts use the (staff) shell's Chat tab
// instead of this pushed screen — see CLAUDE.md.
import React from 'react';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { AdminThreadsList } from '@/components/chat/AdminThreadsList';

export default function AdminConversationsScreen() {
  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <BackBar onBack={() => router.back()} title="Chat" />
      <AdminThreadsList />
    </ScreenContainer>
  );
}

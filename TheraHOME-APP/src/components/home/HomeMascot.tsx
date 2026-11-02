import React from 'react';
import { router } from 'expo-router';
import { AssistantBubble } from '@/components/AssistantBubble';
import type { MascotCue, MascotMood } from './MascotFace';
import { useGlance } from './glanceStore';

export interface HomeMascotProps {
  cue: MascotCue | null;
  mood: MascotMood;
  isStaff: boolean;
}

/**
 * The mascot in Home's nav row, and the only subscriber to the glance store.
 *
 * It exists so that following the user's finger costs one small re-render
 * instead of re-rendering Home — see glanceStore.ts.
 */
export const HomeMascot = React.memo(function HomeMascot({ cue, mood, isStaff }: HomeMascotProps) {
  const lookAt = useGlance();
  return (
    <AssistantBubble
      placement="inline"
      appearance="glass"
      lookAt={lookAt}
      cue={cue}
      mood={mood}
      isStaff={isStaff}
      onOpenAIChat={() => router.push('/chat/ai')}
      onOpenSupportChat={() => router.push(isStaff ? '/chat/admin-conversations' : '/chat/human')}
    />
  );
});

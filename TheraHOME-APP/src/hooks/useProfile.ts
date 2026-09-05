// Phase 6: real profile read/write — Edit Profile, Account Settings,
// Notifications Settings, and Profile's header all read/write this instead
// of the Phase 1 `mockUser` constant. See CLAUDE.md.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import type { TablesUpdate } from '@/types/database';

export interface ProfileRow {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  treatmentArea: string | null;
  goal: string | null;
  language: string;
  // True once `language` has actually been deliberately chosen (via
  // country.tsx's confirm step or the Account Settings picker), as opposed
  // to just sitting at its untouched creation-time default ('vi' for every
  // account, including admin-issued ones). RootNavigator (app/_layout.tsx)
  // only syncs `language` down into the local language store when this is
  // true — otherwise the client's own device-locale-detected default is
  // left alone rather than being clobbered back to a default nobody chose.
  languageExplicit: boolean;
  dataSharingEnabled: boolean;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  eveningReminderEnabled: boolean;
  eveningReminderTime: string;
  // Read by RootNavigator's shared post-auth gate (app/_layout.tsx) — same
  // for every login method, not TheraHOME-account-specific.
  locked: boolean;
  expiresAt: string | null;
  onboardingCompleted: boolean;
  // 'admin'/'cskh' -> RootNavigator's isStaffAccount gate routes straight to
  // the (staff) shell instead of (tabs), bypassing patient
  // activation/onboarding/country entirely. See CLAUDE.md.
  accountType: string;
  // Also read by RootNavigator (countryPending gate) — true once the user
  // has confirmed their country/region on app/(onboarding)/country.tsx.
  countryConfirmed: boolean;
  // The market whose prices/links/videos this user sees — see useMarket.ts.
  // Written by country.tsx and the Account "Quốc gia" picker; null only for
  // accounts that never saw the country screen.
  country: 'VN' | 'US' | 'MALAY' | null;
  // Per-category Community push toggles — see the Community notification
  // system in CLAUDE.md. Turning one off only stops *push*; the
  // Notification Center row is always created by the DB trigger regardless
  // (dispatch-push checks these, the triggers never do).
  notifyComments: boolean;
  notifyReplies: boolean;
  notifyReactions: boolean;
  notifyCommunity: boolean;
}

const PROFILE_COLUMNS =
  'full_name, email, phone, avatar_url, treatment_area, goal, language, language_explicit, data_sharing_enabled, daily_reminder_enabled, daily_reminder_time, evening_reminder_enabled, evening_reminder_time, locked, expires_at, onboarding_completed, country_confirmed, country, notify_comments, notify_replies, notify_reactions, notify_community, account_type';

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async (): Promise<ProfileRow> => {
      const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId!).single();
      if (error) throw error;
      return {
        fullName: data.full_name,
        email: data.email,
        phone: data.phone,
        avatarUrl: data.avatar_url,
        treatmentArea: data.treatment_area,
        goal: data.goal,
        language: data.language,
        languageExplicit: data.language_explicit,
        dataSharingEnabled: data.data_sharing_enabled,
        dailyReminderEnabled: data.daily_reminder_enabled,
        dailyReminderTime: data.daily_reminder_time.slice(0, 5),
        eveningReminderEnabled: data.evening_reminder_enabled,
        eveningReminderTime: data.evening_reminder_time.slice(0, 5),
        locked: data.locked,
        expiresAt: data.expires_at,
        onboardingCompleted: data.onboarding_completed,
        accountType: data.account_type,
        countryConfirmed: data.country_confirmed,
        country: (data.country as 'VN' | 'US' | 'MALAY' | null) ?? null,
        notifyComments: data.notify_comments,
        notifyReplies: data.notify_replies,
        notifyReactions: data.notify_reactions,
        notifyCommunity: data.notify_community,
      };
    },
    enabled: !!userId,
  });
}

export function useUpdateProfile(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: TablesUpdate<'profiles'>) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });
}

/** Picks (already-selected) local image at `localUri`, uploads to the
 * public `avatars` bucket under this user's own folder, and returns the
 * public URL — caller still has to save it onto `profiles.avatar_url`. */
export async function uploadAvatarImage(userId: string, localUri: string): Promise<string> {
  const optimized = await manipulateAsync(
    localUri,
    [{ resize: { width: 512 } }],
    { compress: 0.78, format: SaveFormat.JPEG },
  );
  const path = `${userId}/${Date.now()}.jpg`;
  const response = await fetch(optimized.uri);
  const arrayBuffer = await response.arrayBuffer();
  const { error } = await supabase.storage.from('avatars').upload(path, arrayBuffer, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
  });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

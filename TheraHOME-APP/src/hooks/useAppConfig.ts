// Admin-editable app content (hotline, support email, the Home
// "Hướng dẫn nhanh" video) — see the `app_config` table and WEB Admin's
// "Nội dung ứng dụng" tab. Added 2026-09-04; these values used to be
// hardcoded in the bundle, so changing a phone number meant a store release.
//
// Every read falls back to the built-in default below, so a missing row, an
// offline start or an RLS hiccup can never blank out a visible field.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import { introVideo, supportEmail } from '@/lib/mockData';

export type AppConfigKey =
  | 'support_hotline'
  | 'support_hotline_label'
  | 'support_email'
  | 'home_intro_video_url'
  // The "Gợi ý từ TheraHOME" screen shown after a phase survey is submitted
  // (and re-shown when tapping an already-answered survey). Seeded in vi/en/ms
  // in app_config; admins edit it in WEB Admin's "Nội dung ứng dụng" tab.
  | 'survey_suggestion_title'
  | 'survey_suggestion_body';

const DEFAULTS: Record<AppConfigKey, string> = {
  // Empty on purpose: TheraHOME has no hotline yet (2026-09-04), and a
  // placeholder number is worse than none — App Review does dial the
  // contact details. The Help screen hides the row while this is empty, so
  // filling `support_hotline` in WEB Admin brings it back with no rebuild.
  support_hotline: '',
  support_hotline_label: '',
  support_email: supportEmail,
  home_intro_video_url: introVideo,
  // Empty here on purpose: the survey screen passes a localized bundled
  // fallback (via i18n `t()`) to `get()`, and the DB rows are seeded in all
  // three languages — so this flat, language-neutral default is only a last
  // resort if both the row and the caller's fallback are missing.
  survey_suggestion_title: '',
  survey_suggestion_body: '',
};

interface ConfigRow {
  key: string;
  value_vi: string | null;
  value_en: string | null;
  value_ms: string | null;
}

/** All settings, resolved for the viewer's language (EN/MS override → VN →
 * built-in default). Cached for the session — these change rarely. */
export function useAppConfig() {
  const language = useAppStore((state) => state.language);
  const query = useQuery({
    queryKey: ['app_config'],
    queryFn: async (): Promise<ConfigRow[]> => {
      const { data, error } = await supabase.from('app_config').select('key, value_vi, value_en, value_ms');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const get = (key: AppConfigKey, fallback?: string): string => {
    const row = query.data?.find((r) => r.key === key);
    const localized = language === 'en' ? row?.value_en : language === 'ms' ? row?.value_ms : null;
    // EN/MS override → VN → caller's localized fallback (e.g. an i18n string
    // for a key the admin has not seeded) → the flat built-in default.
    return (localized?.trim() || row?.value_vi?.trim() || fallback?.trim() || DEFAULTS[key]) as string;
  };

  return { get, isLoading: query.isLoading };
}

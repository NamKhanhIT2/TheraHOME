// FAQ on Hồ sơ → Trợ giúp, owned by admin/CSKH via the `faq_items` table
// and WEB Admin's "Câu hỏi thường gặp" tab (added 2026-09-04). It used to be
// four hardcoded i18n key pairs, so answering a new recurring question meant
// a store release.
//
// Falls back to those same bundled strings whenever the table is empty or
// unreachable, so the Help screen never shows an empty FAQ section.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';

export interface FaqEntry {
  q: string;
  a: string;
}

interface FaqRow {
  id: string;
  question_vi: string;
  answer_vi: string;
  question_en: string | null;
  answer_en: string | null;
  question_ms: string | null;
  answer_ms: string | null;
}

export function useFaqItems(): FaqEntry[] {
  const { t, language } = useI18n();

  const query = useQuery({
    queryKey: ['faq_items'],
    queryFn: async (): Promise<FaqRow[]> => {
      const { data, error } = await supabase
        .from('faq_items')
        .select('id, question_vi, answer_vi, question_en, answer_en, question_ms, answer_ms')
        .eq('active', true)
        .order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10 * 60_000,
  });

  const bundled: FaqEntry[] = [
    { q: t('faqUnlockQuestion'), a: t('faqUnlockAnswer') },
    { q: t('faqAreaQuestion'), a: t('faqAreaAnswer') },
    { q: t('faqMedicalQuestion'), a: t('faqMedicalAnswer') },
    { q: t('faqDeviceQuestion'), a: t('faqDeviceAnswer') },
  ];

  const rows = query.data;
  if (!rows?.length) return bundled;

  // Per-field fallback to Vietnamese, matching how every other translated
  // admin content behaves in this app.
  return rows.map((row) => ({
    q: (language === 'en' ? row.question_en : language === 'ms' ? row.question_ms : null)?.trim() || row.question_vi,
    a: (language === 'en' ? row.answer_en : language === 'ms' ? row.answer_ms : null)?.trim() || row.answer_vi,
  }));
}

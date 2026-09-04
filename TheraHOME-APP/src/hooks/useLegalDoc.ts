// Legal texts with an admin-publishable override (see the `legal_documents`
// table and WEB Admin's "Nội dung pháp lý" tab, added 2026-09-04).
//
// The bundled text in src/lib/legalContent.ts stays the source of truth
// until an admin saves a row: an empty table, an offline start or an RLS
// hiccup all resolve to exactly what the app shipped with, so these screens
// can never render blank — which matters, they are the Terms/Privacy pages
// linked from the App Store listing.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getLegalDoc, type LegalDoc, type LegalDocKey } from '@/lib/legalContent';
import { useI18n } from '@/lib/i18n';

export function useLegalDoc(docKey: LegalDocKey): LegalDoc {
  const { language } = useI18n();
  const bundled = getLegalDoc(docKey, language);

  const query = useQuery({
    queryKey: ['legal_document', docKey, language],
    queryFn: async (): Promise<{ title: string; body: string } | null> => {
      const { data, error } = await supabase
        .from('legal_documents')
        .select('title, body')
        .eq('doc_key', docKey)
        .eq('language', language)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    staleTime: 10 * 60_000,
  });

  const override = query.data;
  if (override?.title?.trim() && override?.body?.trim()) {
    return { title: override.title, text: override.body };
  }
  return bundled;
}

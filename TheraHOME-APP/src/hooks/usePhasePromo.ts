import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';

/** Which of the given phases require an (unpurchased) IAP unlock — a phase
 * appears in the map only when admin configured an `apple_product_id` for
 * it. Used by the roadmap to force-lock a phase's days even if the normal
 * day-by-day sequential unlock would otherwise mark them reachable. */
export function usePhaseLockRequirements(phaseIds: string[]) {
  const key = phaseIds.slice().sort().join(',');
  return useQuery({
    queryKey: ['phase_promos_lock', key],
    queryFn: async (): Promise<Map<string, string>> => {
      if (phaseIds.length === 0) return new Map();
      const { data, error } = await supabase
        .from('phase_promos')
        .select('phase_id, apple_product_id')
        .in('phase_id', phaseIds)
        .not('apple_product_id', 'is', null);
      if (error) throw error;
      return new Map(data.map((r) => [r.phase_id, r.apple_product_id as string]));
    },
    enabled: phaseIds.length > 0,
  });
}

export interface PhasePromo {
  crossSellImageUrl: string | null;
  crossSellBadge: string | null;
  crossSellTitle: string | null;
  crossSellDescription: string | null;
  crossSellCtaUrl: string | null;
  crossSellVideoUrl: string | null;
  unlockImageUrl: string | null;
  unlockDescription: string | null;
  unlockVideoUrl: string | null;
  appleProductId: string | null;
  // Paywall-screen content (app/paywall/[phaseId].tsx) — each falls back to
  // an i18n default on the mobile side when admin leaves it unset.
  unlockBadge: string | null;
  unlockTitle: string | null;
  unlockSubtitle: string | null;
  unlockBenefits: string[] | null;
  unlockPackageName: string | null;
  unlockPackageDesc: string | null;
  unlockPriceLabel: string | null;
}

/** Admin-authored content for the two cards shown once a phase's quiz is
 * done — see `PhaseUnlockPromo`. Null when the phase has no promo configured
 * (e.g. the final phase, or a phase that doesn't lead into an upsell).
 *
 * Text/url fields resolve through the row's `translations` jsonb for the
 * viewer's language (en/ms), falling back per-field to the VN base columns
 * when a translation is missing — same fallback shape as the WEB Admin's
 * VN/EN/MS Upsell editor promises. Images and apple_product_id are shared. */
export function usePhasePromo(phaseId: string | undefined) {
  const language = useAppStore((state) => state.language);
  return useQuery({
    queryKey: ['phase_promo', phaseId, language],
    queryFn: async (): Promise<PhasePromo | null> => {
      const { data, error } = await supabase
        .from('phase_promos')
        .select(
          'cross_sell_image_url, cross_sell_badge, cross_sell_title, cross_sell_description, cross_sell_cta_url, cross_sell_video_url, unlock_image_url, unlock_description, unlock_video_url, apple_product_id, unlock_badge, unlock_title, unlock_subtitle, unlock_benefits, unlock_package_name, unlock_package_desc, unlock_price_label, translations',
        )
        .eq('phase_id', phaseId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const overrides =
        language === 'vi'
          ? null
          : ((data.translations as Record<string, Record<string, unknown>> | null)?.[language] ?? null);
      const pick = (base: string | null, key: string): string | null => {
        const value = overrides?.[key];
        return typeof value === 'string' && value.trim() ? value : base;
      };
      const baseBenefits = Array.isArray(data.unlock_benefits)
        ? data.unlock_benefits.filter((b): b is string => typeof b === 'string')
        : null;
      const overrideBenefits = overrides?.unlock_benefits;
      const benefits =
        Array.isArray(overrideBenefits) && overrideBenefits.length
          ? overrideBenefits.filter((b): b is string => typeof b === 'string')
          : baseBenefits;
      return {
        crossSellImageUrl: data.cross_sell_image_url,
        crossSellBadge: pick(data.cross_sell_badge, 'cross_sell_badge'),
        crossSellTitle: pick(data.cross_sell_title, 'cross_sell_title'),
        crossSellDescription: pick(data.cross_sell_description, 'cross_sell_description'),
        crossSellCtaUrl: pick(data.cross_sell_cta_url, 'cross_sell_cta_url'),
        crossSellVideoUrl: pick(data.cross_sell_video_url, 'cross_sell_video_url'),
        unlockImageUrl: data.unlock_image_url,
        unlockDescription: pick(data.unlock_description, 'unlock_description'),
        unlockVideoUrl: pick(data.unlock_video_url, 'unlock_video_url'),
        appleProductId: data.apple_product_id,
        unlockBadge: pick(data.unlock_badge, 'unlock_badge'),
        unlockTitle: pick(data.unlock_title, 'unlock_title'),
        unlockSubtitle: pick(data.unlock_subtitle, 'unlock_subtitle'),
        unlockBenefits: benefits,
        unlockPackageName: pick(data.unlock_package_name, 'unlock_package_name'),
        unlockPackageDesc: pick(data.unlock_package_desc, 'unlock_package_desc'),
        unlockPriceLabel: pick(data.unlock_price_label, 'unlock_price_label'),
      };
    },
    enabled: !!phaseId,
  });
}

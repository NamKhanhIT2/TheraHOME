import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

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
 * (e.g. the final phase, or a phase that doesn't lead into an upsell). */
export function usePhasePromo(phaseId: string | undefined) {
  return useQuery({
    queryKey: ['phase_promo', phaseId],
    queryFn: async (): Promise<PhasePromo | null> => {
      const { data, error } = await supabase
        .from('phase_promos')
        .select(
          'cross_sell_image_url, cross_sell_badge, cross_sell_title, cross_sell_description, cross_sell_cta_url, cross_sell_video_url, unlock_image_url, unlock_description, unlock_video_url, apple_product_id, unlock_badge, unlock_title, unlock_subtitle, unlock_benefits, unlock_package_name, unlock_package_desc, unlock_price_label',
        )
        .eq('phase_id', phaseId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        crossSellImageUrl: data.cross_sell_image_url,
        crossSellBadge: data.cross_sell_badge,
        crossSellTitle: data.cross_sell_title,
        crossSellDescription: data.cross_sell_description,
        crossSellCtaUrl: data.cross_sell_cta_url,
        crossSellVideoUrl: data.cross_sell_video_url,
        unlockImageUrl: data.unlock_image_url,
        unlockDescription: data.unlock_description,
        unlockVideoUrl: data.unlock_video_url,
        appleProductId: data.apple_product_id,
        unlockBadge: data.unlock_badge,
        unlockTitle: data.unlock_title,
        unlockSubtitle: data.unlock_subtitle,
        unlockBenefits: Array.isArray(data.unlock_benefits)
          ? data.unlock_benefits.filter((b): b is string => typeof b === 'string')
          : null,
        unlockPackageName: data.unlock_package_name,
        unlockPackageDesc: data.unlock_package_desc,
        unlockPriceLabel: data.unlock_price_label,
      };
    },
    enabled: !!phaseId,
  });
}

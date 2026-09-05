import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import { useMarket, type StoreMarket } from '@/hooks/useMarket';

// Payment gating is PER PLATFORM: apple_product_id gates iOS,
// google_product_id gates Android. A phase with only one of them set is
// simply not gated on the other platform — no dead paywall while billing
// rolls out platform by platform.
const PLATFORM_PRODUCT_COLUMN = Platform.OS === 'android' ? 'google_product_id' : 'apple_product_id';

export interface PhaseLockRequirement {
  /** This platform's store product id. */
  productId: string;
  /** False while the store isn't allowed to sell yet (e.g. shipping under
   * the FREE apps agreement) — the phase stays locked, but every selling
   * surface (greyed header, promo cards, paywall entry) is hidden. */
  salesEnabled: boolean;
}

/** Which of the given phases require an (unpurchased) IAP unlock on THIS
 * platform — a phase appears in the map only when admin configured this
 * platform's product id for it. Used by the roadmap to force-lock a
 * phase's days even if the normal day-by-day sequential unlock would
 * otherwise mark them reachable. */
export function usePhaseLockRequirements(phaseIds: string[]) {
  const key = phaseIds.slice().sort().join(',');
  return useQuery({
    queryKey: ['phase_promos_lock', key],
    queryFn: async (): Promise<Map<string, PhaseLockRequirement>> => {
      if (phaseIds.length === 0) return new Map();
      const { data, error } = await supabase
        .from('phase_promos')
        .select(`phase_id, sales_enabled, ${PLATFORM_PRODUCT_COLUMN}`)
        .in('phase_id', phaseIds)
        .not(PLATFORM_PRODUCT_COLUMN, 'is', null);
      if (error) throw error;
      return new Map(
        (data as { phase_id: string; sales_enabled: boolean | null; [column: string]: string | boolean | null }[]).map((r) => [
          r.phase_id,
          { productId: r[PLATFORM_PRODUCT_COLUMN] as string, salesEnabled: r.sales_enabled !== false },
        ]),
      );
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
  googleProductId: string | null;
  // Paywall-screen content (app/paywall/[phaseId].tsx) — each falls back to
  // an i18n default on the mobile side when admin leaves it unset.
  unlockBadge: string | null;
  unlockTitle: string | null;
  unlockSubtitle: string | null;
  unlockBenefits: string[] | null;
  unlockPackageName: string | null;
  unlockPackageDesc: string | null;
  unlockPriceLabel: string | null;
  /** Catalog name of the product this phase belongs to (base `products.name`,
   * not market-localized) — used to pick the bundled paywall hero. */
  productName: string | null;
  /** False = selling paused (free-agreement mode): PhaseUnlockPromo renders
   * nothing at all for this phase. */
  salesEnabled: boolean;
}

/** Admin-authored content for the two cards shown once a phase's quiz is
 * done — see `PhaseUnlockPromo`. Null when the phase has no promo configured
 * (e.g. the final phase, or a phase that doesn't lead into an upsell).
 *
 * Text/url fields resolve through the row's `translations` jsonb for the
 * viewer's language (en/ms), falling back per-field to the VN base columns
 * when a translation is missing — same fallback shape as the WEB Admin's
 * VN/EN/MS Upsell editor promises. Images and apple_product_id are shared. */
/** Which `translations` bucket holds a MARKET's commercial content. Staff
 * author one bucket per market in the WEB Upsell editor, whose own tab
 * labels read "EN (thị trường UK)" / "MS (thị trường ML)", so the market maps
 * onto the same bucket the wording uses. */
function marketBucket(market: StoreMarket): string | null {
  return market === 'US' ? 'en' : market === 'MALAY' ? 'ms' : null;
}

export function usePhasePromo(phaseId: string | undefined) {
  const language = useAppStore((state) => state.language);
  const market = useMarket();
  return useQuery({
    queryKey: ['phase_promo', phaseId, language, market],
    queryFn: async (): Promise<PhasePromo | null> => {
      const { data, error } = await supabase
        .from('phase_promos')
        .select(
          'cross_sell_image_url, cross_sell_badge, cross_sell_title, cross_sell_description, cross_sell_cta_url, cross_sell_video_url, unlock_image_url, unlock_description, unlock_video_url, apple_product_id, google_product_id, unlock_badge, unlock_title, unlock_subtitle, unlock_benefits, unlock_package_name, unlock_package_desc, unlock_price_label, sales_enabled, translations, program_phases(products(name))',
        )
        .eq('phase_id', phaseId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const buckets = data.translations as Record<string, Record<string, unknown>> | null;
      // Wording follows the UI LANGUAGE; anything commercial follows the
      // user's COUNTRY (owner rule: prices and buy-links belong to the market,
      // not to whichever language the app is displayed in). Before this, a
      // Vietnamese customer reading the app in English was shown the UK price
      // label and the UK storefront link.
      const overrides = language === 'vi' ? null : (buckets?.[language] ?? null);
      const marketKey = marketBucket(market);
      const marketOverrides = marketKey ? (buckets?.[marketKey] ?? null) : null;
      const pickFrom = (source: Record<string, unknown> | null, base: string | null, key: string): string | null => {
        const value = source?.[key];
        return typeof value === 'string' && value.trim() ? value : base;
      };
      const pick = (base: string | null, key: string): string | null => pickFrom(overrides, base, key);
      const pickMarket = (base: string | null, key: string): string | null => pickFrom(marketOverrides, base, key);
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
        crossSellCtaUrl: pickMarket(data.cross_sell_cta_url, 'cross_sell_cta_url'),
        crossSellVideoUrl: pick(data.cross_sell_video_url, 'cross_sell_video_url'),
        unlockImageUrl: data.unlock_image_url,
        unlockDescription: pick(data.unlock_description, 'unlock_description'),
        unlockVideoUrl: pick(data.unlock_video_url, 'unlock_video_url'),
        appleProductId: data.apple_product_id,
        googleProductId: data.google_product_id,
        unlockBadge: pick(data.unlock_badge, 'unlock_badge'),
        unlockTitle: pick(data.unlock_title, 'unlock_title'),
        unlockSubtitle: pick(data.unlock_subtitle, 'unlock_subtitle'),
        unlockBenefits: benefits,
        unlockPackageName: pick(data.unlock_package_name, 'unlock_package_name'),
        unlockPackageDesc: pick(data.unlock_package_desc, 'unlock_package_desc'),
        unlockPriceLabel: pickMarket(data.unlock_price_label, 'unlock_price_label'),
        productName:
          (data.program_phases as { products: { name: string } | null } | null)?.products?.name ?? null,
        salesEnabled: data.sales_enabled !== false,
      };
    },
    enabled: !!phaseId,
  });
}

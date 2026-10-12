// The subscription ladder shown on app/subscription.tsx, owned by Admin via
// the `subscription_plans` table and WEB Admin's "Gói đăng ký" tab.
//
// Copy only. A row says what a tier contains; it grants nothing and no gate
// reads it. The quotas written into the feature lines are enforced by their
// own server-side functions (chấm dáng tập by
// `form_review_monthly_allowance()`), so a line here can disagree with what
// the app actually allows if someone edits one without the other.
//
// Unlike useFaqItems there is no bundled fallback: an empty or unreachable
// table means we genuinely do not know what is on sale, and inventing an
// offer in the client would be worse than showing nothing.
import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';

export interface PlanFeature {
  /** An Icon name; '' (or anything the map lacks) renders as a check. */
  icon: string;
  text: string;
}

export type PlanBilling = 'subscription' | 'lifetime';

export interface SubscriptionPlan {
  id: string;
  /** Stable key — what code should match on, never the display name. */
  code: string;
  /** Which KIND of product this is at the store. 'lifetime' is bought once
   * (Apple Non-Consumable / Play one-time product), so it is requested with
   * type 'in-app', has no renewal and never expires — nothing about it is a
   * subscription except the name of the table it lands in. */
  billing: PlanBilling;
  highlighted: boolean;
  name: string;
  tagline: string;
  badge: string;
  priceLabel: string;
  periodLabel: string;
  features: PlanFeature[];
  /** The product id for THIS platform, or '' when the tier has none here —
   * either because it is not sold on this platform or because nobody has
   * created it in the store console yet. Those two cases look the same from
   * here, and both mean "cannot be bought", which is all the screen needs. */
  storeProductId: string;
}

interface PlanRow {
  id: string;
  code: string;
  billing_type: string;
  highlighted: boolean;
  name_vi: string;
  name_en: string | null;
  name_ms: string | null;
  tagline_vi: string | null;
  tagline_en: string | null;
  tagline_ms: string | null;
  badge_vi: string | null;
  badge_en: string | null;
  badge_ms: string | null;
  price_label_vi: string | null;
  price_label_en: string | null;
  price_label_ms: string | null;
  period_label_vi: string | null;
  period_label_en: string | null;
  period_label_ms: string | null;
  features: unknown;
  apple_product_id: string | null;
  google_product_id: string | null;
}

/** Each localized field falls back to Vietnamese on its own, so a half-
 * translated row shows translated names next to Vietnamese benefit lines
 * rather than nothing at all — same rule as every other admin content. */
function localized(language: string, vi: string | null, en: string | null, ms: string | null): string {
  const override = language === 'en' ? en : language === 'ms' ? ms : null;
  return override?.trim() || vi?.trim() || '';
}

/** `features` is jsonb: a PlanFeature[] by convention only, so it is coerced
 * rather than cast. A row hand-edited in SQL cannot blank the screen. */
function readFeatures(value: unknown, language: string): PlanFeature[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const item = (entry ?? {}) as Record<string, unknown>;
      const read = (key: string) => (typeof item[key] === 'string' ? (item[key] as string) : null);
      return {
        icon: typeof item.icon === 'string' ? item.icon : '',
        text: localized(language, read('vi'), read('en'), read('ms')),
      };
    })
    .filter((feature) => feature.text);
}

export function useSubscriptionPlans() {
  const { language } = useI18n();

  return useQuery({
    queryKey: ['subscription_plans', language],
    queryFn: async (): Promise<SubscriptionPlan[]> => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select(
          'id, code, billing_type, highlighted, name_vi, name_en, name_ms, tagline_vi, tagline_en, tagline_ms, badge_vi, badge_en, badge_ms, price_label_vi, price_label_en, price_label_ms, period_label_vi, period_label_en, period_label_ms, features, apple_product_id, google_product_id',
        )
        .eq('active', true)
        .order('sort_order');
      if (error) throw error;
      return ((data ?? []) as PlanRow[]).map((row) => {
        const apple = row.apple_product_id?.trim() ?? '';
        const google = row.google_product_id?.trim() ?? '';
        return {
          id: row.id,
          code: row.code,
          // Anything unrecognised reads as a subscription: that is the
          // stricter of the two (it asks the store for a renewing product
          // and will simply not find one) rather than offering a one-off
          // purchase for something that renews.
          billing: row.billing_type === 'lifetime' ? ('lifetime' as const) : ('subscription' as const),
          highlighted: row.highlighted,
          name: localized(language, row.name_vi, row.name_en, row.name_ms),
          tagline: localized(language, row.tagline_vi, row.tagline_en, row.tagline_ms),
          badge: localized(language, row.badge_vi, row.badge_en, row.badge_ms),
          priceLabel: localized(language, row.price_label_vi, row.price_label_en, row.price_label_ms),
          // NOT via `localized`: '' is a real value here — it is how the free
          // tier says "no period", and falling back to the Vietnamese would
          // print "mỗi tháng" under a price of 0.
          periodLabel:
            (language === 'en' ? row.period_label_en : language === 'ms' ? row.period_label_ms : row.period_label_vi) ??
            '',
          features: readFeatures(row.features, language),
          storeProductId: Platform.OS === 'android' ? google : apple,
        };
      });
    },
    staleTime: 10 * 60_000,
  });
}

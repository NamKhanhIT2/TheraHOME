// Phase 4: real store catalog. Still no in-app checkout (matches the
// design) — each item links out to therahomeai.com via `external_link`.
// Replaces the Phase 1 mock store's `storeCategories`. See CLAUDE.md.
import { Image } from 'expo-image';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ThemeColors } from '@/theme/colors';
import { useMarket, type StoreMarket } from '@/hooks/useMarket';

// Kept as re-exports so older imports keep resolving; the market decision
// itself lives in useMarket.ts.
export { marketForLanguage, type StoreMarket } from '@/hooks/useMarket';

export interface StoreItemRow {
  id: string;
  name: string;
  description: string;
  priceText: string;
  accent: keyof ThemeColors;
  externalLink: string | null;
  previewVideoUrl: string | null;
  imageUrl: string | null;
}

export interface StoreCategoryRow {
  id: string;
  title: string;
  hasTrial: boolean;
  items: StoreItemRow[];
}

function storeCategoriesQueryKey(market: StoreMarket) {
  return ['store_categories', market] as const;
}

async function fetchStoreCategories(market: StoreMarket): Promise<StoreCategoryRow[]> {
  const [categoriesRes, itemsRes] = await Promise.all([
    supabase.from('store_categories').select('id, title, has_trial, market').eq('market', market).order('sort_order'),
    supabase
      .from('store_items')
      .select('id, category_id, name, description, price_text, accent_color_key, external_link, preview_url, image_url, market')
      .eq('market', market)
      .order('sort_order'),
  ]);
  if (!categoriesRes.error && !itemsRes.error) {
    return categoriesRes.data.map((c) => ({
      id: c.id,
      // Catalog strings come from the matching Admin market. Do not apply
      // the old static translations here: admins can now tailor every
      // product, link and description independently per country.
      title: c.title,
      hasTrial: c.has_trial,
      items: itemsRes.data
        .filter((i) => i.category_id === c.id)
        .map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description ?? '',
          priceText: i.price_text,
          accent: i.accent_color_key as keyof ThemeColors,
          externalLink: i.external_link,
          previewVideoUrl: i.preview_url,
          imageUrl: i.image_url,
        })),
    }));
  }

  // Keep the existing storefront usable until the live database has run
  // the catalog-market migration. The fallback is deliberately only for
  // the old schema; it disappears as soon as `market` is available.
  const [legacyCategories, legacyItems] = await Promise.all([
    supabase.from('store_categories').select('id, title, has_trial').order('sort_order'),
    supabase
      .from('store_items')
      .select('id, category_id, name, description, price_text, accent_color_key, external_link, preview_url')
      .order('sort_order'),
  ]);
  if (legacyCategories.error) throw legacyCategories.error;
  if (legacyItems.error) throw legacyItems.error;
  return legacyCategories.data.map((c) => ({
    id: c.id,
    title: c.title,
    hasTrial: c.has_trial,
    items: legacyItems.data
      .filter((i) => i.category_id === c.id)
      .map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description ?? '',
        priceText: i.price_text,
        accent: i.accent_color_key as keyof ThemeColors,
        externalLink: i.external_link,
        previewVideoUrl: i.preview_url,
        imageUrl: null,
      })),
  }));
}

// Reference data — 3 categories / 8 items, admin-managed, effectively static.
export function useStoreCategories() {
  // Catalog follows the user's COUNTRY, not the UI language — see
  // useMarket.ts. A VN customer reading the app in English still gets VN
  // prices and VN links.
  const market = useMarket();
  return useQuery({
    queryKey: storeCategoriesQueryKey(market),
    queryFn: () => fetchStoreCategories(market),
    staleTime: 5 * 60 * 1000,
    // Catalog changes infrequently; avoid a duplicate request immediately
    // after launch/prefetch while still refreshing during a long session.
  });
}

/** Warms both the react-query cache and the native image cache for the
 * Store tab ahead of the user actually opening it — Expo Router's tabs are
 * lazily mounted by default, so without this, both the catalog fetch and
 * every product image decode start cold the first time Store is tapped,
 * which is what made it feel slow right after launch. Called from Home's
 * mount effect (see `app/(tabs)/home.tsx`), the same "prefetch from the
 * previous screen" pattern already used for `thera-login.tsx`'s background
 * image — just applied to remote/admin-managed data instead of a bundled
 * asset. Safe to call even if Store's own query is already warm/in-flight;
 * `prefetchQuery` is a no-op for fresh data and react-query dedupes
 * concurrent fetches for the same key. */
export async function prefetchStoreCategories(queryClient: QueryClient, market: StoreMarket): Promise<void> {
  const categories = await queryClient.fetchQuery({
    queryKey: storeCategoriesQueryKey(market),
    queryFn: () => fetchStoreCategories(market),
  });
  const urls = categories.flatMap((category) => category.items.map((item) => item.imageUrl).filter((url): url is string => !!url));
  // Warm the same disk cache used by RemoteImage. Downloads run together so
  // a slow first product cannot block every thumbnail after it.
  // Keep cold-start bandwidth available for the current Home content. Warm
  // Store images two at a time instead of opening every download at once.
  for (let index = 0; index < urls.length; index += 2) {
    await Image.prefetch(urls.slice(index, index + 2), { cachePolicy: 'memory-disk' }).catch(() => false);
  }
}

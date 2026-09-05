// The ONE place that decides which market's content a user sees — store
// catalog (names, prices, links), program video links, primary-product
// names, and which official Community posts they get.
//
// Rule (owner, 2026-09-05): market follows the COUNTRY the user answered at
// onboarding (`profiles.country`), never the UI language. A Vietnamese
// customer who switches the app to English must still see VN prices and VN
// links. Before this hook every consumer derived the market from
// `language`, and the Account Settings language picker even overwrote the
// local market — so that exact user was silently shown the US store.
//
// Resolution order:
//   1. `profiles.country` — saved by country.tsx / the Account "Quốc gia"
//      picker. Authoritative, survives reinstalls.
//   2. Local `market` from the store — set at country confirm, so it is
//      already right while the profile write is still in flight.
//   3. The UI language — only for accounts that never saw the country
//      screen (TheraHOME-issued / review accounts), where it is the only
//      signal there is.
import { useAppStore, type AppLanguage, type AppMarket } from '@/store/useAppStore';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';

export type StoreMarket = 'VN' | 'US' | 'MALAY';

export function marketForLanguage(language: AppLanguage): StoreMarket {
  return language === 'ms' ? 'MALAY' : language === 'en' ? 'US' : 'VN';
}

export function marketFromLocal(market: AppMarket | null): StoreMarket | null {
  return market === 'us-eu' ? 'US' : market === 'malay' ? 'MALAY' : market === 'vietnam' ? 'VN' : null;
}

export function localFromMarket(market: StoreMarket): AppMarket {
  return market === 'US' ? 'us-eu' : market === 'MALAY' ? 'malay' : 'vietnam';
}

/** Maps a country.tsx option label to its market code. */
export function marketForCountryOption(option: string): StoreMarket {
  if (option === 'US/EU') return 'US';
  if (option === 'MALAY') return 'MALAY';
  return 'VN';
}

export function useMarket(): StoreMarket {
  const { session } = useSession();
  const profile = useProfile(session?.user.id).data;
  const localMarket = useAppStore((state) => state.market);
  const language = useAppStore((state) => state.language);
  return profile?.country ?? marketFromLocal(localMarket) ?? marketForLanguage(language);
}

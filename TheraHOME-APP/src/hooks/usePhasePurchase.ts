import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useIAP, type Purchase } from 'react-native-iap';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/** Which phases (by id) this user has a non-revoked verified purchase for,
 * mapped to WHEN they bought it. Feeds the roadmap's phase-lock check and
 * the post-purchase wait below. A Map, not a Set, so `.has()` still reads
 * the same at every existing call site. */
export function usePhasePurchases(userId: string | undefined) {
  return useQuery({
    queryKey: ['phase_purchases', userId],
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase
        .from('phase_purchases')
        .select('phase_id, purchased_at')
        .eq('user_id', userId!)
        .is('revoked_at', null);
      if (error) throw error;
      return new Map(data.map((r) => [r.phase_id, r.purchased_at as string]));
    },
    enabled: !!userId,
  });
}

/** How far into a BOUGHT phase its days are open (owner 2026-09-25).
 *
 * Buying opens the phase's first TWO days at once, so the buyer can start
 * straight away. The REST of the phase opens in one go once the wait below
 * has passed — it is not a day-by-day drip.
 *
 * 49 hours, not 24: the point of the wait is to outlast Google Play's
 * 48-hour self-service refund window, so nobody can buy, binge the whole
 * phase and take the money back automatically (owner 2026-09-25).
 *
 * Hours from the purchase itself, not calendar midnights.
 *
 * Returns the highest day number open right now — Infinity once the wait is
 * over.
 */
export const BOUGHT_PHASE_WAIT_HOURS = 49;

export function daysOpenAfterPurchase(phaseFirstDayNumber: number, purchasedAtIso: string): number {
  const elapsedHours = (Date.now() - new Date(purchasedAtIso).getTime()) / 3_600_000;
  return elapsedHours >= BOUGHT_PHASE_WAIT_HOURS ? Infinity : phaseFirstDayNumber + 1;
}

/** Drives the "Mở khoá ngay" button on `PhaseUnlockPromo` for one specific
 * phase, on both platforms. Wraps `react-native-iap`'s `useIAP()`: fetches
 * the phase's product for the CURRENT platform (Apple product id on iOS,
 * Google Play product id on Android) so the button can show the real store
 * price, drives `requestPurchase`, and on success verifies server-side —
 * `verify-apple-purchase` with the StoreKit transaction id, or
 * `verify-google-purchase` with the Play Billing purchaseToken (NEVER
 * `purchase.id` on Android: react-native-iap fills it with the orderId or
 * falls back to the token) — before finalizing the transaction, which on
 * Android doubles as the acknowledge call. */
export function usePurchasePhase(
  phaseId: string,
  productIds: { apple: string | null; google: string | null },
  opts?: { onVerified?: () => void },
) {
  const sku = Platform.OS === 'android' ? productIds.google : productIds.apple;
  const queryClient = useQueryClient();
  const [verifying, setVerifying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  // Ref, not a dep — a caller passing an inline callback shouldn't retrigger
  // verifyAndFinish's identity (and the useIAP wiring below) every render.
  const onVerifiedRef = useRef(opts?.onVerified);
  onVerifiedRef.current = opts?.onVerified;
  // True between a restore request and either a matching purchase being
  // consumed by the effect below or the empty-result timeout firing.
  const restoreRequestedRef = useRef(false);
  const purchaseRequestedRef = useRef(false);

  const verifyAndFinish = useCallback(
    async (purchase: Purchase, finishTransaction: (args: { purchase: Purchase; isConsumable: boolean }) => Promise<void>) => {
      setVerifying(true);
      setPurchaseError(null);
      try {
        const { data, error } =
          Platform.OS === 'android'
            ? await supabase.functions.invoke('verify-google-purchase', {
                body: { phaseId, purchaseToken: purchase.purchaseToken },
              })
            : await supabase.functions.invoke('verify-apple-purchase', {
                body: { phaseId, transactionId: purchase.id },
              });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error ?? 'verify_failed');
        // Only finalize with the platform once our own backend has recorded
        // the purchase — an unfinished transaction safely replays (iOS) or
        // stays restorable (Android, where the server has also already
        // acknowledged it) if this step never runs, e.g. app killed mid-flow.
        await finishTransaction({ purchase, isConsumable: false });
        void queryClient.invalidateQueries({ queryKey: ['phase_purchases'] });
        onVerifiedRef.current?.();
      } catch (e) {
        setPurchaseError(e instanceof Error ? e.message : 'verify_failed');
        if (__DEV__) console.warn('verify-apple-purchase failed:', e);
      } finally {
        setVerifying(false);
      }
    },
    [phaseId, queryClient],
  );

  const { connected, products, fetchProducts, requestPurchase, finishTransaction, availablePurchases, getAvailablePurchases } = useIAP({
    onPurchaseSuccess: (purchase) => {
      purchaseRequestedRef.current = false;
      void verifyAndFinish(purchase, finishTransaction);
    },
    onPurchaseError: (error) => {
      purchaseRequestedRef.current = false;
      setPurchaseError(error.message);
      if (__DEV__) console.warn('IAP purchase failed:', error);
    },
  });

  useEffect(() => {
    if (connected && sku) {
      void fetchProducts({ skus: [sku], type: 'in-app' });
    }
  }, [connected, sku, fetchProducts]);

  const product = products.find((p) => p.id === sku) ?? null;

  // "Khôi phục giao dịch": re-fetch the Apple account's owned purchases and
  // re-run server verification for the one matching this phase's product.
  // `getAvailablePurchases` delivers results through the hook's *reactive*
  // `availablePurchases` state (its promise resolves before that state has
  // re-rendered — see react-native-iap's useIAP docs), so the match is
  // consumed by the effect below rather than right after the await.
  const restore = useCallback(() => {
    if (!sku || !connected) return;
    setPurchaseError(null);
    restoreRequestedRef.current = true;
    setRestoring(true);
    getAvailablePurchases()
      .then(() => {
        // One generous frame for `availablePurchases` to land; if the effect
        // below hasn't consumed a match by then, there is nothing to restore.
        setTimeout(() => {
          if (restoreRequestedRef.current) {
            restoreRequestedRef.current = false;
            setRestoring(false);
            setPurchaseError('restore_not_found');
          }
        }, 800);
      })
      .catch((e: unknown) => {
        restoreRequestedRef.current = false;
        setRestoring(false);
        setPurchaseError(e instanceof Error ? e.message : 'restore_failed');
        if (__DEV__) console.warn('getAvailablePurchases failed:', e);
      });
  }, [sku, connected, getAvailablePurchases]);

  useEffect(() => {
    if (!restoreRequestedRef.current || !sku) return;
    const match = availablePurchases.find((p) => p.productId === sku);
    if (!match) return;
    restoreRequestedRef.current = false;
    setRestoring(false);
    void verifyAndFinish(match, finishTransaction);
  }, [availablePurchases, sku, verifyAndFinish, finishTransaction]);

  const purchase = useCallback(() => {
    // `verifying` only flips true once the store CALLS BACK, so between the
    // tap and StoreKit's sheet appearing the button was fully enabled and a
    // second tap issued a second requestPurchase for the same SKU. This ref
    // closes that window; the store callbacks clear it.
    if (!sku || purchaseRequestedRef.current) return;
    purchaseRequestedRef.current = true;
    setPurchaseError(null);
    // Both platform keys are passed; the library reads only the current
    // platform's. `requestPurchase` delivers its result via
    // onPurchaseSuccess/onPurchaseError above, but the promise itself can
    // still reject synchronously (e.g. IAP native module unavailable, not
    // connected yet) — without a catch here that becomes an unhandled
    // promise rejection.
    requestPurchase({ request: { apple: { sku }, google: { skus: [sku] } }, type: 'in-app' }).catch((e: unknown) => {
      purchaseRequestedRef.current = false;
      setPurchaseError(e instanceof Error ? e.message : 'purchase_failed');
      if (__DEV__) console.warn('requestPurchase failed:', e);
    });
  }, [sku, requestPurchase]);

  return {
    /** Real StoreKit product (has the localized `displayPrice`), null until fetched. */
    product,
    connected,
    /** True while our own server is verifying a just-completed purchase. */
    verifying,
    /** True while a restore request is looking up the account's purchases. */
    restoring,
    purchaseError,
    purchase,
    restore,
  };
}

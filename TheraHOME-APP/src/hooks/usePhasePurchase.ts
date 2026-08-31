import { useCallback, useEffect, useRef, useState } from 'react';
import { useIAP, type Purchase } from 'react-native-iap';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/** Which phases (by id) this user has a non-revoked verified purchase for.
 * Feeds the roadmap's phase-lock check. */
export function usePhasePurchases(userId: string | undefined) {
  return useQuery({
    queryKey: ['phase_purchases', userId],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('phase_purchases')
        .select('phase_id')
        .eq('user_id', userId!)
        .is('revoked_at', null);
      if (error) throw error;
      return new Set(data.map((r) => r.phase_id));
    },
    enabled: !!userId,
  });
}

/** Drives the "Mở khoá ngay" button on `PhaseUnlockPromo` for one specific
 * phase. iOS only for now (Android/Google Play Billing is a follow-up — see
 * CLAUDE.md). Wraps `react-native-iap`'s `useIAP()`: fetches the phase's
 * Apple product so the button can show the real StoreKit price, drives
 * `requestPurchase`, and on success sends the transaction id to
 * `verify-apple-purchase` (server-side verification against Apple, then
 * records `phase_purchases`) before finalizing the transaction. */
export function usePurchasePhase(
  phaseId: string,
  appleProductId: string | null,
  opts?: { onVerified?: () => void },
) {
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

  const verifyAndFinish = useCallback(
    async (purchase: Purchase, finishTransaction: (args: { purchase: Purchase; isConsumable: boolean }) => Promise<void>) => {
      setVerifying(true);
      setPurchaseError(null);
      try {
        const { data, error } = await supabase.functions.invoke('verify-apple-purchase', {
          body: { phaseId, transactionId: purchase.id },
        });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error ?? 'verify_failed');
        // Only finalize with the platform once our own backend has recorded
        // the purchase — an unfinished iOS transaction safely replays on the
        // next app launch if this step never runs (e.g. app killed mid-flow).
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
      void verifyAndFinish(purchase, finishTransaction);
    },
    onPurchaseError: (error) => {
      setPurchaseError(error.message);
      if (__DEV__) console.warn('IAP purchase failed:', error);
    },
  });

  useEffect(() => {
    if (connected && appleProductId) {
      void fetchProducts({ skus: [appleProductId], type: 'in-app' });
    }
  }, [connected, appleProductId, fetchProducts]);

  const product = products.find((p) => p.id === appleProductId) ?? null;

  // "Khôi phục giao dịch": re-fetch the Apple account's owned purchases and
  // re-run server verification for the one matching this phase's product.
  // `getAvailablePurchases` delivers results through the hook's *reactive*
  // `availablePurchases` state (its promise resolves before that state has
  // re-rendered — see react-native-iap's useIAP docs), so the match is
  // consumed by the effect below rather than right after the await.
  const restore = useCallback(() => {
    if (!appleProductId || !connected) return;
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
  }, [appleProductId, connected, getAvailablePurchases]);

  useEffect(() => {
    if (!restoreRequestedRef.current || !appleProductId) return;
    const match = availablePurchases.find((p) => p.productId === appleProductId);
    if (!match) return;
    restoreRequestedRef.current = false;
    setRestoring(false);
    void verifyAndFinish(match, finishTransaction);
  }, [availablePurchases, appleProductId, verifyAndFinish, finishTransaction]);

  const purchase = useCallback(() => {
    if (!appleProductId) return;
    setPurchaseError(null);
    // `requestPurchase` delivers its result via onPurchaseSuccess/
    // onPurchaseError above, but the promise itself can still reject
    // synchronously (e.g. IAP native module unavailable, not connected yet)
    // — without a catch here that becomes an unhandled promise rejection.
    requestPurchase({ request: { apple: { sku: appleProductId } }, type: 'in-app' }).catch((e: unknown) => {
      setPurchaseError(e instanceof Error ? e.message : 'purchase_failed');
      if (__DEV__) console.warn('requestPurchase failed:', e);
    });
  }, [appleProductId, requestPurchase]);

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

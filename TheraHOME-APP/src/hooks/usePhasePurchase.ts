import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useIAP, ErrorCode, getAvailablePurchases as fetchOwnedPurchases, type Purchase } from 'react-native-iap';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { invokeFunction } from '@/lib/invokeFunction';

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

/** The edge function's own error code out of a failed invoke.
 *
 * supabase-js flattens every non-2xx into one generic
 * "Edge Function returned a non-2xx status code" — but it keeps the whole
 * Response on `error.context`, so the code the function actually sent is
 * still readable. Without this the buyer gets "thử lại" for a problem no
 * amount of retrying can fix (owner 2026-09-26). */
async function functionErrorCode(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown })?.context;
  if (!(context instanceof Response)) return null;
  try {
    const body = await context.clone().json();
    return typeof body?.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

/** Server verdicts that will never change for THIS transaction.
 *
 * A transaction the store handed us stays in the device's queue until the
 * app finishes it, and StoreKit re-delivers an unfinished one on every
 * launch — forever. While one sits there unclaimable it also blocks every
 * later purchase on that device: the buyer gets "thử lại" on a loop and
 * cannot escape, not by reinstalling (the queue is the system's, not the
 * app's) and not by switching accounts.
 *
 * That is exactly what happened on 2026-10-10: a purchase made under one
 * TheraHOME account, then a different account signed in on the same iPhone
 * — seven 409s in a row, and no way forward until the row was moved by hand
 * in SQL. A real customer with two accounts on one phone hits the same wall.
 *
 * Finishing is safe for these: a non-consumable's entitlement lives with the
 * Apple/Play account, not with the transaction, so `getAvailablePurchases`
 * still returns it and the catch-up below can claim it later if the reason
 * for the refusal is ever fixed.
 *
 * Deliberately NOT in this list: network errors, 5xx, and the store's own
 * "not found" answers. Those can be a store API hiccup rather than a verdict
 * about the purchase, and leaving them unfinished is what makes the next
 * launch retry them. */
const TERMINAL_VERIFY_ERRORS = new Set([
  // Someone else already holds this entitlement, so the money WAS honoured —
  // just not for this account. The jam this whole list exists for.
  'transaction_already_claimed',
  // Already refunded.
  'transaction_revoked',
  // The payload is not a purchase of anything we sell.
  'product_id_mismatch',
  'transaction_id_mismatch',
  'bundle_id_mismatch',
  'invalid_transaction_payload',
]);

// `phase_not_purchasable` and `purchase_not_valid` are deliberately absent
// even though they are just as permanent. On Android finishTransaction is
// ALSO the acknowledge call, and Google auto-refunds a purchase nobody
// acknowledges within three days. If an admin clears a phase's product id
// while a real purchase is in flight, refusing to acknowledge is what gets
// that buyer their money back — finishing it would quietly keep the money
// and give them nothing. A jammed queue is worth less than someone's 299k.

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
  // Google has the order but hasn't collected the money yet — its own state,
  // not an error (owner 2026-09-26).
  const [paymentPending, setPaymentPending] = useState(false);
  // Ref, not a dep — a caller passing an inline callback shouldn't retrigger
  // verifyAndFinish's identity (and the useIAP wiring below) every render.
  const onVerifiedRef = useRef(opts?.onVerified);
  onVerifiedRef.current = opts?.onVerified;
  const purchaseRequestedRef = useRef(false);
  // Bumped when Play says the product is already owned; the effect below
  // turns that into a restore. A counter, not a flag, so a second attempt
  // still fires.
  const [ownedRetry, setOwnedRetry] = useState(0);
  const handledOwnedRef = useRef(0);

  /** finishTransaction, but a failure here must never turn a handled case
   * into an unhandled rejection — the worst it costs is one more replay. */
  const settle = useCallback(
    async (purchase: Purchase, finishTransaction: (args: { purchase: Purchase; isConsumable: boolean }) => Promise<void>) => {
      try {
        await finishTransaction({ purchase, isConsumable: false });
      } catch (e) {
        if (__DEV__) console.warn('finishTransaction failed:', e);
      }
    },
    [],
  );

  const verifyAndFinish = useCallback(
    async (purchase: Purchase, finishTransaction: (args: { purchase: Purchase; isConsumable: boolean }) => Promise<void>) => {
      // Not paid for yet: Play's slower methods (bank transfer, cash at a
      // counter) resolve hours later. Finishing or verifying it now would be
      // claiming money nobody has sent — leave it alone and let the catch-up
      // check below find it once Google collects.
      if (purchase.purchaseState === 'pending') {
        setPaymentPending(true);
        setPurchaseError(null);
        return;
      }
      setVerifying(true);
      setPurchaseError(null);
      setPaymentPending(false);
      try {
        // Through invokeFunction so a 401 is retried after a refresh rather
        // than becoming "thử lại" on a purchase the customer has already
        // paid for. A stale session is survivable here; a lost purchase is
        // not. See src/lib/invokeFunction.ts.
        const { data, error } =
          Platform.OS === 'android'
            ? await invokeFunction<{ ok?: boolean; pending?: boolean; revoked?: boolean; expired?: boolean; error?: string }>('verify-google-purchase', { phaseId, purchaseToken: purchase.purchaseToken })
            : await invokeFunction<{ ok?: boolean; pending?: boolean; revoked?: boolean; expired?: boolean; error?: string }>('verify-apple-purchase', { phaseId, transactionId: purchase.id });
        if (error) {
          const code = await functionErrorCode(error);
          if (code && TERMINAL_VERIFY_ERRORS.has(code)) {
            // Final answer: close the transaction so the store stops
            // handing it back on every launch (see TERMINAL_VERIFY_ERRORS).
            await settle(purchase, finishTransaction);
            // Bought under a different sign-in: retrying can never help, and
            // buying again is impossible (the store says "already owned"),
            // so name the actual problem.
            setPurchaseError(code === 'transaction_already_claimed' ? 'claimed_by_other' : code);
            return;
          }
          // Transient — leave it unfinished so the next launch retries.
          throw error;
        }
        // Google still processing: say so and stop — no entitlement, no
        // finishTransaction (an unfinished purchase stays restorable).
        if (data?.pending) {
          setPaymentPending(true);
          return;
        }
        // Refunded. The phase stays locked — this only replaces the false
        // "unlocked" screen a restore used to show.
        if (data?.revoked) {
          // The refund already happened; there is nothing left to do with
          // this transaction, so close it rather than replay it forever.
          await settle(purchase, finishTransaction);
          setPurchaseError('purchase_revoked');
          return;
        }
        if (!data?.ok) throw new Error(data?.error ?? 'verify_failed');
        // Only finalize with the platform once our own backend has recorded
        // the purchase — an unfinished transaction safely replays (iOS) or
        // stays restorable (Android, where the server has also already
        // acknowledged it) if this step never runs, e.g. app killed mid-flow.
        await settle(purchase, finishTransaction);
        void queryClient.invalidateQueries({ queryKey: ['phase_purchases'] });
        onVerifiedRef.current?.();
      } catch (e) {
        setPurchaseError(e instanceof Error ? e.message : 'verify_failed');
        if (__DEV__) console.warn('purchase verification failed:', e);
      } finally {
        setVerifying(false);
      }
    },
    [phaseId, queryClient, settle],
  );

  const { connected, products, fetchProducts, requestPurchase, finishTransaction } = useIAP({
    onPurchaseSuccess: (purchase) => {
      purchaseRequestedRef.current = false;
      void verifyAndFinish(purchase, finishTransaction);
    },
    onPurchaseError: (error) => {
      purchaseRequestedRef.current = false;
      // Closing the Play sheet is a decision, not a failure. It used to show
      // "Không thể hoàn tất giao dịch", which reads as a broken payment
      // (owner 2026-09-26).
      if (error.code === ErrorCode.UserCancelled) return;
      // Play's OTHER way of saying "paid later": with a method that settles
      // at a counter or by transfer, Billing answers the purchase call with
      // this instead of handing over a pending purchase. Same meaning, same
      // message — money on its way, not a failure.
      if (error.code === ErrorCode.DeferredPayment) {
        setPaymentPending(true);
        return;
      }
      // "You already own this." Then the payment is not the problem — our
      // record of it is (verification never finished, or it was bought under
      // another sign-in). Asking Play for the account's purchases turns that
      // into an unlock instead of an error the buyer can do nothing about.
      if (error.code === ErrorCode.AlreadyOwned) {
        setOwnedRetry((n) => n + 1);
        return;
      }
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

  // Claim a purchase the store already holds for this account. Both entry
  // points below go through here, and it is the pattern react-native-iap
  // documents: ask for the owned purchases, verify each on the server, then
  // finish it.
  //
  // The IMPERATIVE `getAvailablePurchases` is what resolves with the list.
  // The hook's same-named function only refreshes reactive state, which is
  // why this code used to race a timer against a re-render and could answer
  // "nothing to restore" while the purchase was still on its way (owner
  // 2026-09-26).
  //
  // `announce` separates the two callers: the button owes the user an answer
  // either way, the silent catch-up says nothing when there is nothing.
  const claimOwnedPurchase = useCallback(
    async ({ announce }: { announce: boolean }) => {
      if (!sku || !connected) return;
      if (announce) {
        setPurchaseError(null);
        setRestoring(true);
      }
      try {
        const owned = await fetchOwnedPurchases();
        const match = owned.find((p) => p.productId === sku);
        if (!match) {
          if (announce) setPurchaseError('restore_not_found');
          return;
        }
        await verifyAndFinish(match, finishTransaction);
      } catch (e) {
        if (announce) setPurchaseError(e instanceof Error ? e.message : 'restore_failed');
        if (__DEV__) console.warn('getAvailablePurchases failed:', e);
      } finally {
        if (announce) setRestoring(false);
      }
    },
    [sku, connected, verifyAndFinish, finishTransaction],
  );

  // Catch-up, once per screen: a purchase can be paid for while nobody is
  // looking — Play's slower methods clear hours later, and an app killed
  // between payment and verification leaves the same state. Either way the
  // purchase is still sitting in the account.
  const caughtUpRef = useRef(false);
  useEffect(() => {
    if (!connected || !sku || caughtUpRef.current) return;
    caughtUpRef.current = true;
    void claimOwnedPurchase({ announce: false });
  }, [connected, sku, claimOwnedPurchase]);

  /** "Khôi phục giao dịch" — the user asked, so they get an answer. */
  const restore = useCallback(() => {
    void claimOwnedPurchase({ announce: true });
  }, [claimOwnedPurchase]);

  // Play answered "already owned" — run the same lookup the button does, so
  // the buyer gets the phase instead of a dead end. Keyed off the counter so
  // a changing callback identity can't re-trigger it.
  useEffect(() => {
    if (ownedRetry === 0 || handledOwnedRef.current === ownedRetry) return;
    handledOwnedRef.current = ownedRetry;
    void claimOwnedPurchase({ announce: true });
  }, [ownedRetry, claimOwnedPurchase]);

  const purchase = useCallback(() => {
    // `verifying` only flips true once the store CALLS BACK, so between the
    // tap and StoreKit's sheet appearing the button was fully enabled and a
    // second tap issued a second requestPurchase for the same SKU. This ref
    // closes that window; the store callbacks clear it.
    if (!sku || purchaseRequestedRef.current) return;
    purchaseRequestedRef.current = true;
    setPurchaseError(null);
    setPaymentPending(false);
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
    /** Google has the order but hasn't collected the money yet — the phase
     * stays locked and the screen says "still processing", not "failed". */
    paymentPending,
    purchaseError,
    purchase,
    restore,
  };
}

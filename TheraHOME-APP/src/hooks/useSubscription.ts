// Buying and holding a subscription tier.
//
// The sibling of usePhasePurchase, and deliberately close to it: same
// server-verify-then-finish order, same treatment of Play's pending
// payments, same refusal to finish a transaction whose failure might be
// transient. The differences are the ones subscriptions force:
//
//   - `type: 'subs'` everywhere, and on Android a purchase additionally
//     needs the base plan's offerToken, which only comes back with the
//     fetched product — so nothing can be bought before the store answers.
//   - What the user holds is not a list of purchases but ONE tier, and
//     whether it is still valid depends on a date. `active_plan_code()`
//     decides that in SQL so no two callers can disagree.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  useIAP,
  ErrorCode,
  getAvailablePurchases as fetchOwnedPurchases,
  type Purchase,
  type ProductSubscription,
} from 'react-native-iap';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { SUBSCRIPTIONS_ENABLED } from '@/lib/features';
import type { SubscriptionPlan } from '@/hooks/useSubscriptionPlans';

/** The tier this user holds right now, or null for the free one.
 *
 * Read from `active_plan_code()` rather than from the rows: expiry is
 * evaluated server-side, so a subscription that lapsed an hour ago stops
 * granting without any job having run and without the client doing date
 * arithmetic of its own. Review accounts get the top tier from the same
 * function. */
export function useActivePlanCode(userId: string | undefined) {
  return useQuery({
    queryKey: ['active_plan_code', userId],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc('active_plan_code');
      if (error) throw error;
      return (data as string | null) ?? null;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

/** The code's own error out of a failed `functions.invoke`.
 *
 * supabase-js flattens every non-2xx into one generic message but keeps the
 * Response on `error.context`, so the function's own code is still
 * readable. Without this a buyer gets "thử lại" for something no amount of
 * retrying can fix. Same helper as usePhasePurchase, which is where this was
 * first needed. */
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

/** Verdicts that will never change for THIS receipt, so the transaction can
 * be closed instead of replayed on every launch forever. An unfinished
 * transaction blocks every later purchase on the device, which is the jam
 * this list exists to avoid — see TERMINAL_VERIFY_ERRORS in
 * usePhasePurchase for the full story.
 *
 * `plan_not_purchasable` is deliberately absent: on Android finishing a
 * transaction IS the acknowledge call, and Google auto-refunds a purchase
 * nobody acknowledges within three days. If an admin clears a plan's product
 * id mid-purchase, NOT acknowledging is what gets that buyer their money
 * back. */
const TERMINAL_VERIFY_ERRORS = new Set([
  'transaction_already_claimed',
  'product_id_mismatch',
  'bundle_id_mismatch',
  'invalid_transaction_payload',
]);

export interface SubscriptionPurchaseState {
  connected: boolean;
  /** The store's own product for a plan — `displayPrice` is the real price
   * in the buyer's currency, which beats any label typed into WEB Admin. */
  productFor: (plan: SubscriptionPlan) => ProductSubscription | null;
  /** True once the store has confirmed this plan exists and is buyable. A
   * product id typed into WEB Admin that does not exist in the store simply
   * never shows up here, so copy alone can never enable a buy button. */
  canBuy: (plan: SubscriptionPlan) => boolean;
  buy: (plan: SubscriptionPlan) => void;
  restore: () => void;
  /** The plan whose purchase is in flight, so only its button spins. */
  pendingPlanCode: string | null;
  verifying: boolean;
  restoring: boolean;
  /** Money on its way (Play's bank transfer / cash-at-a-counter methods).
   * Not a failure and not an entitlement. */
  paymentPending: boolean;
  purchaseError: string | null;
}

export function useSubscriptionPurchase(
  plans: SubscriptionPlan[],
  opts?: { onVerified?: (planCode: string) => void },
): SubscriptionPurchaseState {
  const queryClient = useQueryClient();
  const [verifying, setVerifying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [pendingPlanCode, setPendingPlanCode] = useState<string | null>(null);

  // Ref, not a dep: an inline callback must not change verifyAndFinish's
  // identity (and with it the useIAP wiring) on every render.
  const onVerifiedRef = useRef(opts?.onVerified);
  onVerifiedRef.current = opts?.onVerified;
  // Which plan the in-flight purchase belongs to. The store's callback
  // carries a product id, not a plan, and on a restore there may be no
  // in-flight plan at all — so both paths resolve the plan from the receipt,
  // and this is only the guard against a double tap.
  const requestedRef = useRef<string | null>(null);
  const plansRef = useRef(plans);
  plansRef.current = plans;

  // Bumped when the store says the product is already owned; the effect
  // further down turns that into a restore. A counter, not a flag, so a
  // second attempt still fires. Declared here, above useIAP, because
  // onPurchaseError closes over the setter.
  const [ownedRetry, setOwnedRetry] = useState(0);
  const handledOwnedRef = useRef(0);

  const planForProduct = useCallback(
    (productId: string | undefined): SubscriptionPlan | null =>
      plansRef.current.find((plan) => plan.storeProductId && plan.storeProductId === productId) ?? null,
    [],
  );

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
      const plan = planForProduct(purchase.productId);
      if (!plan) {
        // A subscription to something this build does not sell (a retired
        // plan, or a product id since changed in WEB Admin). Not ours to
        // finish: on Android that would acknowledge it and keep the money.
        if (__DEV__) console.warn('no plan matches product', purchase.productId);
        return;
      }
      // Not paid for yet. Verifying or finishing now would be claiming money
      // nobody has sent — leave it alone; the catch-up below finds it once
      // the store collects.
      if (purchase.purchaseState === 'pending') {
        setPaymentPending(true);
        setPurchaseError(null);
        return;
      }
      setVerifying(true);
      setPurchaseError(null);
      setPaymentPending(false);
      try {
        const { data, error } = await supabase.functions.invoke('verify-subscription', {
          body:
            Platform.OS === 'android'
              ? { planCode: plan.code, purchaseToken: purchase.purchaseToken }
              : // NEVER purchase.id on Android: react-native-iap fills it
                // with the orderId or falls back to the token. On iOS it is
                // the StoreKit transaction id, which is what Apple's API
                // wants.
                { planCode: plan.code, transactionId: purchase.id },
        });
        if (error) {
          const code = await functionErrorCode(error);
          if (code && TERMINAL_VERIFY_ERRORS.has(code)) {
            await settle(purchase, finishTransaction);
            setPurchaseError(code === 'transaction_already_claimed' ? 'claimed_by_other' : code);
            return;
          }
          // Could be a store hiccup — leave it unfinished so the next launch
          // retries.
          throw error;
        }
        if (data?.pending) {
          setPaymentPending(true);
          return;
        }
        if (data?.revoked) {
          await settle(purchase, finishTransaction);
          setPurchaseError('purchase_revoked');
          return;
        }
        if (data?.expired) {
          await settle(purchase, finishTransaction);
          setPurchaseError('subscription_expired');
          return;
        }
        if (!data?.ok) throw new Error(data?.error ?? 'verify_failed');
        // Only finalize once our own backend has the row: an unfinished
        // transaction safely replays on iOS and stays restorable on Android
        // (where the server has already acknowledged it), so an app killed
        // mid-flow loses nothing.
        await settle(purchase, finishTransaction);
        void queryClient.invalidateQueries({ queryKey: ['active_plan_code'] });
        onVerifiedRef.current?.(plan.code);
      } catch (e) {
        setPurchaseError(e instanceof Error ? e.message : 'verify_failed');
        if (__DEV__) console.warn('subscription verification failed:', e);
      } finally {
        setVerifying(false);
      }
    },
    [planForProduct, queryClient, settle],
  );

  const { connected, subscriptions, fetchProducts, requestPurchase, finishTransaction } = useIAP({
    onPurchaseSuccess: (purchase) => {
      requestedRef.current = null;
      setPendingPlanCode(null);
      void verifyAndFinish(purchase, finishTransaction);
    },
    onPurchaseError: (error) => {
      requestedRef.current = null;
      setPendingPlanCode(null);
      // Closing the store sheet is a decision, not a failure.
      if (error.code === ErrorCode.UserCancelled) return;
      if (error.code === ErrorCode.DeferredPayment) {
        setPaymentPending(true);
        return;
      }
      // "You already own this" — then the payment is not the problem, our
      // record of it is. Asking the store for the account's purchases turns
      // a dead end into the tier they paid for.
      if (error.code === ErrorCode.AlreadyOwned) {
        setOwnedRetry((n) => n + 1);
        return;
      }
      setPurchaseError(error.message);
      if (__DEV__) console.warn('subscription purchase failed:', error);
    },
  });

  // One request for every plan's SKU. Joined into a string so the effect
  // compares by value — `plans` is a fresh array on most renders.
  const skuKey = plans
    .map((plan) => plan.storeProductId)
    .filter(Boolean)
    .join(',');
  useEffect(() => {
    if (!connected || !skuKey) return;
    void fetchProducts({ skus: skuKey.split(','), type: 'subs' }).catch((e: unknown) => {
      // A SKU the store does not know is simply omitted, so this only fires
      // on a real failure — and it must not reject into nothing.
      if (__DEV__) console.warn('fetchProducts(subs) failed:', e);
    });
  }, [connected, skuKey, fetchProducts]);

  const productFor = useCallback(
    (plan: SubscriptionPlan) =>
      (plan.storeProductId ? subscriptions.find((product) => product.id === plan.storeProductId) : undefined) ?? null,
    [subscriptions],
  );

  // Two independent gates, both required. SUBSCRIPTIONS_ENABLED says we have
  // decided the tiers actually do something; a fetched product says the
  // store agrees this thing exists and can be sold. Neither alone is enough:
  // the first without the second would offer a product id that 404s, and the
  // second without the first would sell a tier that grants nothing.
  const canBuy = useCallback(
    (plan: SubscriptionPlan) =>
      SUBSCRIPTIONS_ENABLED && !plan.isFree && !!plan.storeProductId && connected && !!productFor(plan),
    [connected, productFor],
  );

  const buy = useCallback(
    (plan: SubscriptionPlan) => {
      const sku = plan.storeProductId;
      const product = productFor(plan);
      // `verifying` only flips once the store calls back, so between the tap
      // and the sheet appearing a second tap would issue a second
      // requestPurchase for the same SKU. The store callbacks clear this.
      if (!sku || !product || requestedRef.current) return;
      requestedRef.current = plan.code;
      setPendingPlanCode(plan.code);
      setPurchaseError(null);
      setPaymentPending(false);

      // Android needs the base plan's offer token, and it only exists on the
      // product the store just returned — which is exactly why `canBuy`
      // requires a fetched product rather than a configured id.
      const offers = (product.subscriptionOffers ?? [])
        .map((offer) => offer.offerTokenAndroid)
        .filter((token): token is string => !!token);

      requestPurchase({
        request: {
          apple: { sku },
          google: {
            skus: [sku],
            subscriptionOffers: offers.map((offerToken) => ({ sku, offerToken })),
          },
        },
        type: 'subs',
      }).catch((e: unknown) => {
        requestedRef.current = null;
        setPendingPlanCode(null);
        setPurchaseError(e instanceof Error ? e.message : 'purchase_failed');
        if (__DEV__) console.warn('requestPurchase(subs) failed:', e);
      });
    },
    [productFor, requestPurchase],
  );

  /** Claim a subscription the store already holds for this account.
   *
   * The IMPERATIVE `getAvailablePurchases` is the one that RESOLVES with the
   * list; the hook's same-named function only refreshes reactive state,
   * which is what used to make a restore answer "nothing found" while the
   * purchase was still on its way.
   *
   * `announce` separates the two callers: the button owes an answer either
   * way, the silent catch-up says nothing when there is nothing. */
  const claimOwned = useCallback(
    async ({ announce }: { announce: boolean }) => {
      if (!connected) return;
      if (announce) {
        setPurchaseError(null);
        setRestoring(true);
      }
      try {
        const owned = await fetchOwnedPurchases();
        const matches = owned.filter((purchase) => !!planForProduct(purchase.productId));
        if (matches.length === 0) {
          if (announce) setPurchaseError('restore_not_found');
          return;
        }
        for (const match of matches) await verifyAndFinish(match, finishTransaction);
      } catch (e) {
        if (announce) setPurchaseError(e instanceof Error ? e.message : 'restore_failed');
        if (__DEV__) console.warn('getAvailablePurchases failed:', e);
      } finally {
        if (announce) setRestoring(false);
      }
    },
    [connected, planForProduct, verifyAndFinish, finishTransaction],
  );

  // Catch-up, once per screen: a renewal clears while nobody is looking, an
  // app killed between payment and verification leaves the same state, and
  // Play's slower methods collect hours later. In every case the purchase is
  // still sitting in the store account.
  const caughtUpRef = useRef(false);
  useEffect(() => {
    if (!connected || !skuKey || caughtUpRef.current) return;
    caughtUpRef.current = true;
    void claimOwned({ announce: false });
  }, [connected, skuKey, claimOwned]);

  useEffect(() => {
    if (ownedRetry === 0 || handledOwnedRef.current === ownedRetry) return;
    handledOwnedRef.current = ownedRetry;
    void claimOwned({ announce: true });
  }, [ownedRetry, claimOwned]);

  const restore = useCallback(() => {
    void claimOwned({ announce: true });
  }, [claimOwned]);

  return {
    connected,
    productFor,
    canBuy,
    buy,
    restore,
    pendingPlanCode,
    verifying,
    restoring,
    paymentPending,
    purchaseError,
  };
}

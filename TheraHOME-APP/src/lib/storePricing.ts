import type { StoreMarket } from '@/hooks/useMarket';

export interface StorePrice {
  original: number;
  discounted: number;
  saving: number;
  currency: 'VND' | 'USD' | 'MYR';
}

/**
 * The admin catalog currently stores a display string rather than a numeric
 * amount. All three markets use whole-unit prices, so extracting the digits
 * is deterministic for the current formats (1.490.000đ, 120$, 240 RM).
 * The server repeats this calculation from its own catalog row when an order
 * is placed; this helper is display-only and is never trusted as order data.
 */
export function storePrice(priceText: string, market: StoreMarket, discountPercent: number): StorePrice | null {
  const digits = priceText.replace(/\D/g, '');
  if (!digits) return null;
  const original = Number(digits);
  if (!Number.isFinite(original) || original <= 0) return null;

  const safeDiscount = Math.min(100, Math.max(0, discountPercent));
  const discounted = Math.round(original * (1 - safeDiscount / 100) * 100) / 100;
  return {
    original,
    discounted,
    saving: original - discounted,
    currency: market === 'VN' ? 'VND' : market === 'MALAY' ? 'MYR' : 'USD',
  };
}

export function formatStorePrice(amount: number, market: StoreMarket): string {
  if (market === 'VN') return `${Math.round(amount).toLocaleString('vi-VN')}đ`;
  if (market === 'MALAY') return `RM ${amount.toLocaleString('ms-MY', { maximumFractionDigits: 2 })}`;
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

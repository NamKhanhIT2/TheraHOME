// `npm:` is resolved by Supabase Edge Runtime's package cache. The JSR
// registry rejects anonymous manifest fetches during CLI bundling (403 on
// jsr.io/@supabase/functions-js/meta.json), which is why auth-sign-in,
// dispatch-push and dispatch-upsell-campaigns already import this way. The
// `edge-runtime.d.ts` side-effect import was types-only; Deno.serve is
// ambient in the runtime, so dropping it changes nothing at run time.
import { createClient } from "npm:@supabase/supabase-js@2";

// Auto-injected by Supabase into every Edge Function — no manual setup needed.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Must be set manually via `supabase secrets set SHOPIFY_WEBHOOK_SECRET=...`
// (or the dashboard) — the signing secret shown on Shopify Admin ->
// Settings -> Notifications -> Webhooks after creating the webhook pointing
// at this function's URL. Until it's set, every request is rejected with
// 500 rather than silently skipping verification. See CLAUDE.md's "Manual
// setup" section.
const SHOPIFY_WEBHOOK_SECRET = Deno.env.get("SHOPIFY_WEBHOOK_SECRET");

// Every synced order defaults to this product regardless of what was
// actually purchased. TheraHOME Vietnam's Shopify catalog only has
// TheraNECK+ as a real matching device today — TheraPillow/Combo don't map
// to any of the app's programs, and the product decision (see CLAUDE.md)
// is "bought anything -> can get into the app" rather than strict product
// matching. Revisit once TheraNECK PRO / TheraBACK+/PRO exist as real
// Shopify products worth mapping individually.
const DEFAULT_PRODUCT_ID = "neck-plus";

interface ShopifyOrder {
  id: number;
  order_number: number;
  created_at?: string;
  phone?: string | null;
  email?: string | null;
  customer?: { phone?: string | null; email?: string | null } | null;
  shipping_address?: { phone?: string | null } | null;
}

// Bound to Shopify's "Order creation" webhook event (Settings ->
// Notifications -> Webhooks in Shopify Admin), not "Order fulfillment" —
// changed 2026-08-23 per explicit request so a customer's phone/email is
// already in `orders` (and matchable at the app's activation code-entry
// step) the moment they place an order, rather than only once the device
// actually ships. This is deliberately not gated on payment/fulfillment
// status either way: COD is the common case for VN device sales, so most
// orders sit at financialStatus PENDING for a while regardless of which
// event this listens to — gating on "paid" or "fulfilled" would both miss
// real customers who haven't paid/received yet but already have a valid
// order. The payload shape (id, order_number, phone/email, customer,
// shipping_address, created_at) is the same core Order representation
// across every order-related webhook topic, so none of the field access
// below needed to change for this — only which Shopify event calls this
// URL. A cancelled-right-after-creation order is not un-synced (no
// `orders/cancelled` handling) — not requested, and the existing
// `activate_orders_by_contact` activation flow already only ever grants
// access to orders a real customer's own phone/email actually matches.
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  if (!SHOPIFY_WEBHOOK_SECRET) {
    console.error("SHOPIFY_WEBHOOK_SECRET is not set");
    return new Response(JSON.stringify({ error: "Webhook not configured" }), { status: 500 });
  }

  // HMAC must be verified against the exact raw bytes Shopify signed, before
  // any JSON parsing — this is the only thing stopping anyone on the
  // internet from POSTing a fake order and minting themselves a free
  // activation code, so it is not optional.
  const rawBody = await req.text();
  const hmacHeader = req.headers.get("X-Shopify-Hmac-Sha256");
  const valid = await verifyShopifyHmac(rawBody, hmacHeader, SHOPIFY_WEBHOOK_SECRET);
  if (!valid) {
    return new Response(JSON.stringify({ error: "Invalid HMAC signature" }), { status: 401 });
  }

  let order: ShopifyOrder;
  try {
    order = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  if (!order?.id || !order?.order_number) {
    return new Response(JSON.stringify({ error: "Missing order id/order_number" }), { status: 400 });
  }

  const phone = normalizePhone(order.phone ?? order.customer?.phone ?? order.shipping_address?.phone);
  const email = normalizeEmail(order.email ?? order.customer?.email);
  const orderDate = (order.created_at ?? new Date().toISOString()).slice(0, 10);

  // Service-role client: no caller identity exists on an inbound webhook,
  // and `orders` has zero RLS policies (by design — see CLAUDE.md), so this
  // is the only way to write here.
  //
  // This insert is no longer the end of the line: a DB trigger
  // (202609151000) queues this phone and email into the WEB "Kích hoạt" tab
  // as rows awaiting CSKH approval. The trigger swallows its own errors, so
  // nothing it does can fail this upsert and make Shopify redeliver.
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await adminClient.from("orders").upsert(
    {
      shopify_order_id: order.id,
      phone,
      email,
      product_id: DEFAULT_PRODUCT_ID,
      activation_code: `TH-${order.order_number}`,
      order_date: orderDate,
    },
    { onConflict: "shopify_order_id", ignoreDuplicates: true },
  );

  if (error) {
    console.error("Failed to upsert order", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

// E.164, mirroring the SQL `normalize_phone_e164(raw, '84')` step for step so
// a number stored here and the same number stored as an activation contact are
// the same string. This used to emit the domestic form ("+84 912 345 678" ->
// "0912345678"), which was fine while the store was Vietnam-only but dropped
// the "+" from a UK or Malaysian number: "+44 7911 123456" became
// "447911123456", which the Vietnam-defaulting normalizer would later read as
// "+84447911123456" and match against nobody. Rows written before this change
// keep working — every reader wraps orders.phone in the normalizer, and a
// leading "0" still resolves with the same '84' default.
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const isIntl = value.startsWith("+") || digits.startsWith("00");
  if (isIntl) return digits.startsWith("00") ? "+" + digits.slice(2) : "+" + digits;
  if (digits.startsWith("0")) return "+84" + digits.slice(1);
  if (digits.startsWith("84")) return "+" + digits;
  return "+84" + digits;
}

function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed || null;
}

async function verifyShopifyHmac(rawBody: string, hmacHeader: string | null, secret: string): Promise<boolean> {
  if (!hmacHeader) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const bytes = new Uint8Array(sigBuf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const computed = btoa(binary);
  return timingSafeEqual(computed, hmacHeader);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

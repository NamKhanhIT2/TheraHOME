// The Agent console's figures, read at runtime.
//
// They used to be written into agentConsole.ts as a dated snapshot. That put
// this business's revenue, ad spend and order counts into git history, where
// deleting the file later does not remove them, so they moved into the
// database (migration 202610091800_agent_metrics_tables.sql; admin writes,
// admin-or-cskh reads).
//
// This is the READ half of reading Meta and Pancake live. What fills those
// tables is a separate question: today a human run through the MCP
// connectors, later a scheduled job holding real credentials. Nothing in this
// file or in any view changes when that swap happens — which is also why the
// tables exist at all rather than the browser calling Meta directly. A
// dashboard that hits an ad platform's API on every page load buys itself rate
// limits and a slow first paint for no benefit.
import { supabase } from "./supabase";
import { AD_ACCOUNT } from "./agentConsole";

export interface DayRow {
  date: string;
  /** Meta spend, đồng. */
  spend: number;
  /** Orders CREATED that day, by source. Pancake calls the web source
   * "Shopify" and the inbox source "Facebook"; renamed here to what they are.
   * These counts include orders later cancelled, which is why they run a
   * little above the per-window "valid" totals. */
  web: number;
  messenger: number;
}

export interface CampaignRow {
  id: string;
  name: string;
  spend: number;
  /** Orders Pancake tagged to this campaign's utm_campaign. */
  orders: number;
  revenue: number;
}

export interface WindowTotals {
  ordersCreated: number;
  ordersValid: number;
  delivered: number;
  canceled: number;
  returned: number;
  revenue: number;
  avgOrderValue: number;
  cancelReturnPct: number;
  comboRatePct: number;
  spend: number;
  bySource: { web: { orders: number; revenue: number }; messenger: { orders: number; revenue: number } };
  byProduct: Array<{ code: string; label: string; units: number }>;
}

export interface WindowDef {
  id: string;
  label: string;
  from: string;
  to: string;
  totals: WindowTotals;
  campaigns: CampaignRow[];
  /** Orders with no utm_campaign at all. They spent no identifiable
   * advertising money, which is why account-wide CPA is the kinder number. */
  untaggedOrders: number;
  zaloOrders: { orders: number; revenue: number };
}

export interface MetricsSnapshot {
  days: DayRow[];
  windows: WindowDef[];
  /** When the figures were read from Meta and Pancake — not when this page
   * loaded. A dashboard that will not say how old its numbers are invites
   * someone to act on last week's. */
  capturedAt: string | null;
}

export const orders = (d: DayRow) => d.web + d.messenger;

/** Spend ÷ every order that day, web ones included. No provider reports this:
 * Meta's own cost-per-result counts only what Meta can see.
 *
 * null on a day with no orders — spend ÷ 0 is not a number to draw. */
export const cpaOf = (d: DayRow): number | null => (orders(d) ? Math.round(d.spend / orders(d)) : null);

export const daysOf = (days: DayRow[], w: WindowDef) => days.filter((d) => d.date >= w.from && d.date <= w.to);
/** Spend ÷ all orders created in the window. */
export const cpaBlended = (w: WindowDef) => Math.round(w.totals.spend / w.totals.ordersCreated);
/** Revenue ÷ Meta spend. Revenue includes orders Meta never touched, so this
 * is a business ratio, not a Meta ROAS. */
export const revenuePerAdDong = (w: WindowDef) => w.totals.revenue / w.totals.spend;
export const campaignCpa = (c: CampaignRow) => (c.orders ? Math.round(c.spend / c.orders) : null);

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function snapshotNote(w: WindowDef, capturedAt: string | null): string {
  const read = capturedAt
    ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(capturedAt))
    : "chưa rõ";
  return `Số thật, đọc ngày ${read} cho khoảng ${dm(w.from)}–${dm(w.to)}. Chi quảng cáo từ Meta Ads (${AD_ACCOUNT.name}), đơn và doanh thu từ Pancake POS. Đây là bản chụp — console chưa tự cập nhật.`;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** PostgREST serialises `bigint` and `numeric` inconsistently across versions
 * — sometimes a JSON number, sometimes a string. Every figure is coerced once,
 * here, rather than hoping each call site got it right. */
const n = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0));

interface DayDbRow { date: string; spend_vnd: unknown; web_orders: unknown; messenger_orders: unknown }
interface CampaignDbRow { window_id: string; campaign_id: string; name: string; spend_vnd: unknown; orders: unknown; revenue_vnd: unknown }
interface WindowDbRow {
  id: string; label: string; from_date: string; to_date: string;
  orders_created: unknown; orders_valid: unknown; delivered: unknown; canceled: unknown; returned: unknown;
  revenue_vnd: unknown; avg_order_value_vnd: unknown; cancel_return_pct: unknown; combo_rate_pct: unknown;
  spend_vnd: unknown; web_orders: unknown; web_revenue_vnd: unknown; messenger_orders: unknown; messenger_revenue_vnd: unknown;
  by_product: unknown; untagged_orders: unknown; zalo_orders: unknown; zalo_revenue_vnd: unknown; captured_at: string;
}

/** `by_product` is jsonb, so what comes back is whatever was written. A row
 * that is not a code/label/units triple is dropped rather than rendered as a
 * slice labelled "undefined". */
function productsOf(value: unknown): WindowTotals["byProduct"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const r = row as { code?: unknown; label?: unknown; units?: unknown };
    return typeof r?.code === "string" && typeof r?.label === "string"
      ? [{ code: r.code, label: r.label, units: n(r.units) }]
      : [];
  });
}

export async function fetchMetrics(): Promise<MetricsSnapshot> {
  const [daysRes, windowsRes, campaignsRes] = await Promise.all([
    supabase.from("agent_metrics_days").select("date, spend_vnd, web_orders, messenger_orders").order("date"),
    supabase.from("agent_metrics_windows").select("*").order("sort_order"),
    supabase.from("agent_metrics_campaigns").select("*").order("spend_vnd", { ascending: false }),
  ]);
  const failed = daysRes.error ?? windowsRes.error ?? campaignsRes.error;
  if (failed) throw failed;

  const campaigns = (campaignsRes.data as CampaignDbRow[] | null) ?? [];

  return {
    days: ((daysRes.data as DayDbRow[] | null) ?? []).map((r) => ({
      date: r.date,
      spend: n(r.spend_vnd),
      web: n(r.web_orders),
      messenger: n(r.messenger_orders),
    })),
    windows: ((windowsRes.data as WindowDbRow[] | null) ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      from: r.from_date,
      to: r.to_date,
      totals: {
        ordersCreated: n(r.orders_created),
        ordersValid: n(r.orders_valid),
        delivered: n(r.delivered),
        canceled: n(r.canceled),
        returned: n(r.returned),
        revenue: n(r.revenue_vnd),
        avgOrderValue: n(r.avg_order_value_vnd),
        cancelReturnPct: n(r.cancel_return_pct),
        comboRatePct: n(r.combo_rate_pct),
        spend: n(r.spend_vnd),
        bySource: {
          web: { orders: n(r.web_orders), revenue: n(r.web_revenue_vnd) },
          messenger: { orders: n(r.messenger_orders), revenue: n(r.messenger_revenue_vnd) },
        },
        byProduct: productsOf(r.by_product),
      },
      campaigns: campaigns
        .filter((c) => c.window_id === r.id)
        .map((c) => ({ id: c.campaign_id, name: c.name, spend: n(c.spend_vnd), orders: n(c.orders), revenue: n(c.revenue_vnd) })),
      untaggedOrders: n(r.untagged_orders),
      zaloOrders: { orders: n(r.zalo_orders), revenue: n(r.zalo_revenue_vnd) },
    })),
    capturedAt: ((windowsRes.data as WindowDbRow[] | null) ?? [])[0]?.captured_at ?? null,
  };
}

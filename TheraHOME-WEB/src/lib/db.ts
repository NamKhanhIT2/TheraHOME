// Real Supabase queries for the Admin/CSKH surfaces, replacing the mock
// data in mockData.ts / adminMockData.ts. Same project as the mobile app
// (nyjvtvmllwbyfokldgtj) — see CLAUDE.md and TheraHOME-APP/CLAUDE.md's
// Supabase schema section for the underlying tables. RLS for the
// admin/cskh-only reads and writes here comes from the
// `web admin ...`/`web admin cskh ...` policies added alongside
// `current_web_roles()` (see migrations); no react-query in this project
// yet, so callers do plain fetch-on-mount with useState/useEffect.
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { translateDrafts } from "./translate";
import type { Product, ProgramPhase, ProgramDay, MarketContent, StoreCategory, StoreItem, CommunityPost, CommunityComment, NotificationItem } from "./mockData";
import type {
  SampleUser,
  SampleUserRole,
  ChatThread,
  ChatMessage,
  TheraAccount,
  TheraAccountType,
  TheraAccountCountry,
  TheraAccessLevel,
} from "./adminMockData";

const ACCENT_COLORS: Record<string, string> = {
  primary: "var(--color-primary)",
  accentOrange: "var(--accent-orange)",
  accentTeal: "var(--accent-teal)",
  accentPurple: "var(--accent-purple)",
};
function accentFromKey(key: string | null | undefined) {
  return ACCENT_COLORS[key ?? "primary"] ?? "var(--color-primary)";
}

function buildPhases(totalDays: number): { name: string; range: [number, number] }[] {
  const labels = ["Làm quen", "Tăng cường", "Duy trì"];
  const phaseCount = Math.min(3, totalDays);
  const baseLength = Math.floor(totalDays / phaseCount);
  const remainder = totalDays % phaseCount;
  let start = 1;
  return Array.from({ length: phaseCount }, (_, index) => {
    const length = baseLength + (index < remainder ? 1 : 0);
    const end = start + length - 1;
    const range: [number, number] = [start, end];
    start = end + 1;
    return { name: `Giai đoạn ${index + 1} · ${labels[index]}`, range };
  });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardStats {
  totalUsers: number;
  avgAdherence: number | null;
  communityPostsCount: number;
  weekAdherence: number[];
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [{ count: totalUsers }, { data: programs }, { count: communityPostsCount }] = await Promise.all([
    supabase.from("user_access_contacts").select("id", { count: "exact", head: true }),
    supabase.from("user_programs").select("id, adherence_pct"),
    supabase.from("community_posts").select("id", { count: "exact", head: true }),
  ]);

  const adherenceValues = (programs ?? []).map((p) => Number(p.adherence_pct)).filter((n) => Number.isFinite(n));
  const avgAdherence = adherenceValues.length ? Math.round(adherenceValues.reduce((a, b) => a + b, 0) / adherenceValues.length) : null;

  // Real per-weekday activity for the current week (Mon..Sun): fraction of
  // active programs (any user_programs row) with a completed day that week.
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - day);

  const [{ count: activeProgramsCount }, { data: doneDays }] = await Promise.all([
    supabase.from("user_programs").select("id", { count: "exact", head: true }),
    supabase
      .from("user_program_days")
      .select("completed_at, user_program_id")
      .eq("status", "done")
      .gte("completed_at", monday.toISOString()),
  ]);

  const weekAdherence = Array(7).fill(0) as number[];
  if (activeProgramsCount) {
    const perDay = new Map<number, Set<string>>();
    for (const row of doneDays ?? []) {
      if (!row.completed_at) continue;
      const d = (new Date(row.completed_at).getDay() + 6) % 7;
      if (!perDay.has(d)) perDay.set(d, new Set());
      perDay.get(d)!.add(row.user_program_id);
    }
    for (let i = 0; i < 7; i++) {
      weekAdherence[i] = (perDay.get(i)?.size ?? 0) / activeProgramsCount;
    }
  }

  return { totalUsers: totalUsers ?? 0, avgAdherence, communityPostsCount: communityPostsCount ?? 0, weekAdherence };
}

// ---------------------------------------------------------------------------
// Routine (products / program_phases / program_days)
// ---------------------------------------------------------------------------

export async function fetchRoutineProducts(): Promise<Product[]> {
  const [{ data: products, error: pErr }, { data: phases, error: phErr }, { data: days, error: dErr }] = await Promise.all([
    supabase.from("products").select("id, name, name_en, name_ms, accent_color_key, total_days, roadmap_published").order("id"),
    supabase.from("program_phases").select("id, product_id, name, name_en, name_ms, day_start, day_end, sort_order").order("sort_order"),
    supabase
      .from("program_days")
      .select("id, product_id, phase_id, day_number, day_type, video_url_vn, video_url_us, video_url_malay, support_tools_url_vn, support_tools_url_us, support_tools_url_malay")
      .order("day_number"),
  ]);
  if (pErr) throw pErr;
  if (phErr) throw phErr;
  if (dErr) throw dErr;

  return (products ?? []).map((p): Product => {
    const productPhases: ProgramPhase[] = (phases ?? [])
      .filter((ph) => ph.product_id === p.id)
      .map((ph) => ({ id: ph.id, name: ph.name, nameEn: ph.name_en ?? "", nameMs: ph.name_ms ?? "", range: [ph.day_start, ph.day_end] as [number, number] }));
    const phaseNameById = new Map((phases ?? []).map((ph) => [ph.id, ph.name]));
    const productDays: ProgramDay[] = (days ?? [])
      .filter((d) => d.product_id === p.id)
      .map(
        (d): ProgramDay => ({
          id: d.day_number,
          phase: phaseNameById.get(d.phase_id) ?? "",
          status: "locked",
          video: { vn: d.video_url_vn ?? "", us: d.video_url_us ?? "", malay: d.video_url_malay ?? "" },
          supportToolsUrl: { vn: d.support_tools_url_vn ?? "", us: d.support_tools_url_us ?? "", malay: d.support_tools_url_malay ?? "" },
          type: (d.day_type as "train" | "rest") ?? "train",
        })
      );
    return {
      id: p.id,
      name: p.name,
      nameEn: p.name_en ?? "",
      nameMs: p.name_ms ?? "",
      accent: accentFromKey(p.accent_color_key),
      totalDays: p.total_days,
      roadmapPublished: p.roadmap_published !== false,
      phases: productPhases,
      days: productDays,
      painLevels: [],
    };
  });
}

// ---- Roadmap publishing (2026-09-05) --------------------------------------
// The app's device dropdown reads products.roadmap_published — NOT the
// Store's "nhóm chính" flag — so roadmaps are managed here independently
// of the storefront. A DB trigger writes a `roadmap_ready` inbox row for
// every owner when a roadmap flips to published; the push goes through
// dispatch-push (mode roadmap_ready) right after.

export interface RoadmapReadiness {
  market: AdminMarket;
  totalDays: number;
  daysWithVideo: number;
  /** Non-rest days with no video for this market. */
  missingDays: number[];
  /** Days whose video is identical to an EARLIER day's video (placeholder tell-tale). */
  duplicateDays: number[];
}

export async function fetchRoadmapReadiness(productId: string): Promise<RoadmapReadiness[]> {
  const { data, error } = await supabase.rpc("roadmap_readiness", { p_product_id: productId });
  if (error) throw error;
  type Row = { market: string; total_days: number; days_with_video: number; missing_days: number[] | null; duplicate_days: number[] | null };
  return ((data ?? []) as Row[]).map((row) => ({
    market: row.market as AdminMarket,
    totalDays: row.total_days,
    daysWithVideo: row.days_with_video,
    missingDays: row.missing_days ?? [],
    duplicateDays: row.duplicate_days ?? [],
  }));
}

export async function setRoadmapPublished(productId: string, published: boolean): Promise<{ pushError: string | null }> {
  const { error } = await supabase.from("products").update({ roadmap_published: published }).eq("id", productId);
  if (error) throw error;
  if (!published) return { pushError: null };
  const { error: pushErr } = await supabase.functions.invoke("dispatch-push", { body: { mode: "roadmap_ready", productId } });
  if (pushErr) console.error("dispatch-push roadmap_ready failed", productId, pushErr);
  return { pushError: pushErr ? String(pushErr.message ?? pushErr) : null };
}

/** Number of accounts that currently hold this roadmap — shown in the delete
 * confirm, because deleting the roadmap deletes their program, progress and
 * pain logs with it (migration 202609051700). */
export async function countRoadmapOwners(productId: string): Promise<number> {
  const { count, error } = await supabase.from("user_programs").select("id", { count: "exact", head: true }).eq("product_id", productId);
  if (error) throw error;
  return count ?? 0;
}

export async function deleteRoutineProduct(productId: string) {
  // Real orders reference the product and must survive. Counted through an
  // RPC, not a table read: `orders` has RLS on with no policies, so a direct
  // count always came back 0 and this guard could never fire.
  const { data: orderCount, error: orderErr } = await supabase.rpc("product_order_count", { p_product_id: productId });
  if (orderErr) throw orderErr;
  if ((orderCount ?? 0) > 0) throw new Error("has_orders");
  // Cascades: program_phases / program_days (with quiz + promo content),
  // product_activation_contacts and every user_programs row (with its
  // progress and pain logs); store_items.product_id is set null so the
  // storefront row survives; notifications lose the product/day reference.
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) throw error;
}

/** Creates the product and its starter phases. The storefront link is NOT
 * taken here: a link lives on a `store_items` row, which a brand-new roadmap
 * product does not have yet — the create form used to collect one and throw
 * it away silently. Set it in Sản Phẩm (Cửa hàng), or in Sửa thông tin once
 * the product has a storefront entry.
 *
 * Returns `{ id, translated }`; `translated` is false when the auto-draft
 * translator was unavailable, so the caller can say the UK/ML names still
 * need filling in. A translator outage never blocks creation. */
export async function createRoutineProduct(input: { name: string; category: "neck" | "back"; totalDays: number }): Promise<{ id: string; translated: boolean }> {
  const id = `routine-${Date.now()}`;
  const { error: prodErr } = await supabase.from("products").insert({ id, name: input.name, category: input.category, total_days: input.totalDays });
  if (prodErr) throw prodErr;

  const phases = buildPhases(input.totalDays);

  // Draft the UK/ML names up front, so a new roadmap is not Vietnamese-only
  // for UK/ML users until someone remembers to translate it by hand.
  const texts: Record<string, string> = { product: input.name };
  phases.forEach((ph, i) => {
    texts[`phase_${i}`] = ph.name;
  });
  const drafts = await translateDrafts(texts);

  const { error: phaseErr } = await supabase.from("program_phases").insert(
    phases.map((ph, i) => ({
      product_id: id,
      name: ph.name,
      name_en: drafts?.en[`phase_${i}`] ?? null,
      name_ms: drafts?.ms[`phase_${i}`] ?? null,
      day_start: ph.range[0],
      day_end: ph.range[1],
      sort_order: i,
    }))
  );
  if (phaseErr) throw phaseErr;

  if (drafts) {
    const { error: nameErr } = await supabase
      .from("products")
      .update({ name_en: drafts.en.product ?? null, name_ms: drafts.ms.product ?? null })
      .eq("id", id);
    if (nameErr) throw nameErr;
  }

  return { id, translated: !!drafts };
}

/** EN/MS display names for one product and its phases — shown to UK/ML app
 * users. Empty string clears the override (app falls back to the Vietnamese
 * name). Added 2026-09-04, replacing a hardcoded lookup in the mobile app
 * that broke silently whenever a phase was renamed here. */
export async function saveLocalizedNames(input: {
  productId: string;
  productNameEn: string;
  productNameMs: string;
  /** `name` (VN) is optional: when present the phase's base name is renamed too. */
  phases: Array<{ id: string; name?: string; nameEn: string; nameMs: string }>;
}) {
  const { error } = await supabase
    .from("products")
    .update({ name_en: input.productNameEn.trim() || null, name_ms: input.productNameMs.trim() || null })
    .eq("id", input.productId);
  if (error) throw error;

  for (const phase of input.phases) {
    const { error: phaseErr } = await supabase
      .from("program_phases")
      .update({
        ...(phase.name?.trim() ? { name: phase.name.trim() } : {}),
        name_en: phase.nameEn.trim() || null,
        name_ms: phase.nameMs.trim() || null,
      })
      .eq("id", phase.id);
    if (phaseErr) throw phaseErr;
  }
}

export async function updateProductInfo(productId: string, patch: { name?: string; link?: string; totalDays?: number }) {
  // `total_days` is what the app counts against ("NGÀY 12 / 14"), so it is
  // editable here — a roadmap that only has 14 days recorded should say 14.
  if (patch.name !== undefined || patch.totalDays !== undefined) {
    const { error } = await supabase
      .from("products")
      .update({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.totalDays !== undefined ? { total_days: patch.totalDays } : {}),
      })
      .eq("id", productId);
    if (error) throw error;
  }
  // Link: the Sửa thông tin modal only shows the VN storefront link, so only
  // the VN row is written — it used to overwrite all 3 markets with one value,
  // and an untouched empty field wiped every market's link (audit 2026-09-05).
  // Only persists if a matching store_items row exists for this product.
  if (patch.link !== undefined && patch.link.trim()) {
    const { error } = await supabase.from("store_items").update({ external_link: patch.link.trim() }).eq("product_id", productId).eq("market", "VN");
    if (error) throw error;
  }
}

export async function createProgramDay(productId: string, phaseName: string, dayNumber: number, type: "train" | "rest", video: MarketContent, supportToolsUrl: MarketContent) {
  const { data: phase, error: phaseErr } = await supabase.from("program_phases").select("id").eq("product_id", productId).eq("name", phaseName).single();
  if (phaseErr) throw phaseErr;
  const { error } = await supabase.from("program_days").insert({
    product_id: productId, phase_id: phase.id, day_number: dayNumber, day_type: type,
    video_url_vn: video.vn || null, video_url_us: video.us || null, video_url_malay: video.malay || null,
    support_tools_url_vn: supportToolsUrl.vn || null, support_tools_url_us: supportToolsUrl.us || null, support_tools_url_malay: supportToolsUrl.malay || null,
  });
  if (error) throw error;
}

export async function updateProgramDay(productId: string, dayNumber: number, phaseName: string, type: "train" | "rest", video: MarketContent, supportToolsUrl: MarketContent) {
  const { data: phase, error: phaseErr } = await supabase.from("program_phases").select("id").eq("product_id", productId).eq("name", phaseName).single();
  if (phaseErr) throw phaseErr;
  const { error } = await supabase
    .from("program_days")
    .update({
      phase_id: phase.id, day_type: type,
      video_url_vn: video.vn || null, video_url_us: video.us || null, video_url_malay: video.malay || null,
      support_tools_url_vn: supportToolsUrl.vn || null, support_tools_url_us: supportToolsUrl.us || null, support_tools_url_malay: supportToolsUrl.malay || null,
    })
    .eq("product_id", productId)
    .eq("day_number", dayNumber);
  if (error) throw error;
}

/** Closes gaps in `day_number` after a mid-roadmap delete, keeping the days
 * contiguous from 1. Several consumers assume that: provisioning marks day 1
 * 'current', and `complete_day` used to look for `day_number + 1` (now
 * gap-tolerant, but the numbering users see should still read 1..N).
 * Explicit, never automatic — renumbering shifts which exercise a customer
 * mid-program sees, so it is the admin's decision. Returns how many moved. */
export async function renumberProgramDays(productId: string): Promise<number> {
  const { data, error } = await supabase
    .from("program_days")
    .select("id, day_number")
    .eq("product_id", productId)
    .order("day_number");
  if (error) throw error;
  const rows = data ?? [];
  let moved = 0;
  // Ascending order with a temporary offset would be needed if we shrank into
  // occupied numbers; going in order and only ever lowering a number means the
  // target is always already free.
  for (let i = 0; i < rows.length; i += 1) {
    const target = i + 1;
    if (rows[i].day_number === target) continue;
    const { error: updErr } = await supabase.from("program_days").update({ day_number: target }).eq("id", rows[i].id);
    if (updErr) throw updErr;
    moved += 1;
  }
  return moved;
}

export async function deleteProgramDay(productId: string, dayNumber: number) {
  const { error } = await supabase.from("program_days").delete().eq("product_id", productId).eq("day_number", dayNumber);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Phases (program_phases) — full CRUD, added 2026-09-05. Until then the only
// phases a product could ever have were the 3 created at product creation,
// and only their names were editable. The owner needs to drop phase 3 while
// only 14 days of video exist, so add/edit/delete are all exposed.
// ---------------------------------------------------------------------------

export interface PhaseInput {
  name: string;
  nameEn: string;
  nameMs: string;
  dayStart: number;
  dayEnd: number;
}

export async function createProgramPhase(productId: string, input: PhaseInput) {
  const { data: existing, error: readErr } = await supabase.from("program_phases").select("sort_order").eq("product_id", productId);
  if (readErr) throw readErr;
  const nextSort = (existing ?? []).reduce((max, row) => Math.max(max, row.sort_order), 0) + 1;
  const { error } = await supabase.from("program_phases").insert({
    product_id: productId,
    name: input.name.trim(),
    name_en: input.nameEn.trim() || null,
    name_ms: input.nameMs.trim() || null,
    day_start: input.dayStart,
    day_end: input.dayEnd,
    sort_order: nextSort,
  });
  if (error) throw error;
}

export async function updateProgramPhase(phaseId: string, input: PhaseInput) {
  const { error } = await supabase
    .from("program_phases")
    .update({
      name: input.name.trim(),
      name_en: input.nameEn.trim() || null,
      name_ms: input.nameMs.trim() || null,
      day_start: input.dayStart,
      day_end: input.dayEnd,
    })
    .eq("id", phaseId);
  if (error) throw error;
}

/** What a phase delete takes with it. `program_days`, `quiz_questions`,
 * `phase_promos`, `phase_purchases` and `user_quiz_attempts` all cascade off
 * `program_phases`, so the confirm has to spell this out. */
export async function fetchPhaseDeleteImpact(phaseId: string): Promise<{ days: number; purchases: number; quizAttempts: number }> {
  const [days, purchases, attempts] = await Promise.all([
    supabase.from("program_days").select("id", { count: "exact", head: true }).eq("phase_id", phaseId),
    supabase.from("phase_purchases").select("id", { count: "exact", head: true }).eq("phase_id", phaseId),
    supabase.from("user_quiz_attempts").select("id", { count: "exact", head: true }).eq("phase_id", phaseId),
  ]);
  if (days.error) throw days.error;
  if (purchases.error) throw purchases.error;
  if (attempts.error) throw attempts.error;
  return { days: days.count ?? 0, purchases: purchases.count ?? 0, quizAttempts: attempts.count ?? 0 };
}

export async function deleteProgramPhase(phaseId: string) {
  const { error } = await supabase.from("program_phases").delete().eq("id", phaseId);
  if (error) throw error;
}

/** Moves every day of a product into the phase whose range covers its
 * `day_number`. Editing a phase's range leaves days pointing at the old
 * phase, so the view offers this as an explicit repair rather than
 * reshuffling rows behind the admin's back. */
export async function reassignDaysToPhases(productId: string): Promise<number> {
  const [{ data: phases, error: phErr }, { data: days, error: dErr }] = await Promise.all([
    supabase.from("program_phases").select("id, day_start, day_end").eq("product_id", productId),
    supabase.from("program_days").select("id, day_number, phase_id").eq("product_id", productId),
  ]);
  if (phErr) throw phErr;
  if (dErr) throw dErr;
  let moved = 0;
  for (const day of days ?? []) {
    const target = (phases ?? []).find((ph) => day.day_number >= ph.day_start && day.day_number <= ph.day_end);
    if (!target || target.id === day.phase_id) continue;
    const { error } = await supabase.from("program_days").update({ phase_id: target.id }).eq("id", day.id);
    if (error) throw error;
    moved += 1;
  }
  return moved;
}

// ---------------------------------------------------------------------------
// Store catalog (store_categories / store_items)
// ---------------------------------------------------------------------------

export type AdminMarket = "VN" | "US" | "MALAY";

export async function fetchStoreCategories(market: AdminMarket = "VN"): Promise<StoreCategory[]> {
  const [{ data: cats, error: cErr }, { data: items, error: iErr }] = await Promise.all([
    supabase.from("store_categories").select("id, title, has_trial, sort_order, market").eq("market", market).order("sort_order"),
    supabase.from("store_items").select("id, category_id, product_id, name, description, price_text, accent_color_key, external_link, preview_url, image_url, market").eq("market", market).order("sort_order"),
  ]);
  if (cErr) throw cErr;
  if (iErr) throw iErr;

  return (cats ?? []).map((c): StoreCategory => ({
    id: c.id,
    title: c.title,
    hasTrial: c.has_trial,
    items: (items ?? [])
      .filter((it) => it.category_id === c.id)
      .map(
        (it): StoreItem => ({
          id: it.id,
          name: it.name,
          desc: it.description ?? "",
          price: it.price_text,
          accent: accentFromKey(it.accent_color_key),
          link: it.external_link ?? "",
          previewLink: it.preview_url ?? "",
          imageUrl: it.image_url ?? "",
          market: it.market as AdminMarket,
          // Which roadmap product this storefront row belongs to — RoutineView
          // keys its "Link sản phẩm" by products.id, NOT store_items.id.
          productId: it.product_id ?? null,
        })
      ),
  }));
}

// ---------------------------------------------------------------------------
// Store catalog, grouped across markets (ProductsView's real shape) — a
// "product"/"category group" in Admin is up to 3 store_categories/
// store_items rows (VN/US/MALAY) sharing one group_key, edited together
// instead of one market at a time behind the old global market selector.
// See TheraHOME-APP/CLAUDE.md's "Market content vs. UI language" entry.
// ---------------------------------------------------------------------------

const MARKETS: AdminMarket[] = ["VN", "US", "MALAY"];

export interface StoreItemMarketFields {
  name: string;
  desc: string;
  price: string;
  link: string;
  previewLink: string;
  imageUrl: string;
}
const EMPTY_STORE_ITEM_MARKET_FIELDS: StoreItemMarketFields = { name: "", desc: "", price: "", link: "", previewLink: "", imageUrl: "" };

export interface StoreItemGroup {
  groupKey: string;
  accent: string;
  /** `store_items.product_id` — links this storefront entry to a roadmap
   * product. Nothing in Admin used to write it, so a product created after
   * the seeded four could never be linked, and the Lộ trình tab's "Link sản
   * phẩm" stayed "Chưa có link" forever. One value per group (all markets). */
  productId: string | null;
  byMarket: Record<AdminMarket, StoreItemMarketFields & { itemId: string | null }>;
}

export interface StoreCategoryGroup {
  groupKey: string;
  /** "Nhóm sản phẩm chính" — device groups whose items feed the mobile
   * Roadmap dropdown; false = accessory ("nhóm phụ"). One flag per group,
   * mirrored onto all 3 market rows. */
  isPrimary: boolean;
  byMarket: Record<AdminMarket, { id: string; title: string; hasTrial: boolean } | null>;
  items: StoreItemGroup[];
}

export async function fetchStoreCategoryGroups(): Promise<StoreCategoryGroup[]> {
  const [{ data: cats, error: cErr }, { data: items, error: iErr }] = await Promise.all([
    supabase.from("store_categories").select("id, title, has_trial, sort_order, market, group_key, is_primary").order("sort_order"),
    supabase.from("store_items").select("id, category_id, name, description, price_text, accent_color_key, external_link, preview_url, image_url, market, group_key, product_id").order("sort_order"),
  ]);
  if (cErr) throw cErr;
  if (iErr) throw iErr;

  const catGroupKeys = [...new Set((cats ?? []).map((c) => c.group_key))].sort((a, b) => {
    const aRow = (cats ?? []).find((c) => c.group_key === a);
    const bRow = (cats ?? []).find((c) => c.group_key === b);
    return (aRow?.sort_order ?? 0) - (bRow?.sort_order ?? 0);
  });

  return catGroupKeys.map((groupKey): StoreCategoryGroup => {
    const rowsForGroup = (cats ?? []).filter((c) => c.group_key === groupKey);
    const byMarket = Object.fromEntries(
      MARKETS.map((m) => {
        const row = rowsForGroup.find((c) => c.market === m);
        return [m, row ? { id: row.id, title: row.title, hasTrial: row.has_trial } : null];
      })
    ) as StoreCategoryGroup["byMarket"];

    const isPrimary = rowsForGroup.some((c) => c.is_primary);
    const categoryIdsInGroup = new Set(rowsForGroup.map((c) => c.id));
    const itemGroupKeysHere = [...new Set((items ?? []).filter((it) => categoryIdsInGroup.has(it.category_id)).map((it) => it.group_key))];
    const itemGroups: StoreItemGroup[] = itemGroupKeysHere.map((itemGroupKey): StoreItemGroup => {
      const rows = (items ?? []).filter((it) => it.group_key === itemGroupKey);
      const itemByMarket = Object.fromEntries(
        MARKETS.map((m) => {
          const row = rows.find((it) => it.market === m);
          return [
            m,
            row
              ? { itemId: row.id, name: row.name, desc: row.description ?? "", price: row.price_text, link: row.external_link ?? "", previewLink: row.preview_url ?? "", imageUrl: row.image_url ?? "" }
              : { itemId: null, ...EMPTY_STORE_ITEM_MARKET_FIELDS },
          ];
        })
      ) as StoreItemGroup["byMarket"];
      return {
        groupKey: itemGroupKey,
        accent: accentFromKey(rows[0]?.accent_color_key),
        productId: rows.find((r) => r.product_id)?.product_id ?? null,
        byMarket: itemByMarket,
      };
    });

    return { groupKey, isPrimary, byMarket, items: itemGroups };
  });
}

/** Creates/updates the market rows of one category group in one call —
 * `groupKey: "new"` mints a fresh group. Each market gets its own row id.
 *
 * Per-market semantics (owner, 2026-09-05): a market whose title is BLANK
 * means "không bán ở thị trường này" — no row is created for it. A blank
 * title on a market that already HAS a row is refused
 * (`market_has_data_<MARKET>`): stopping sales somewhere is the trash
 * icon's job while viewing that market, never a side effect of an edit
 * (a category row cascades into its items). `isPrimary` (nhóm chính/phụ)
 * is one value per group, written to every row that exists. */
export async function saveStoreCategoryGroup(
  groupKey: string | "new",
  byMarket: Record<AdminMarket, { title: string; hasTrial: boolean }>,
  isPrimary: boolean
): Promise<string> {
  const finalGroupKey = groupKey === "new" ? `group-${Date.now()}` : groupKey;
  const { data: existing, error: existingErr } = await supabase.from("store_categories").select("id, market").eq("group_key", finalGroupKey);
  if (existingErr) throw existingErr;
  const existingIdByMarket = new Map((existing ?? []).map((r) => [r.market, r.id]));
  // New rows go to the end — a NULL sort_order made new groups land anywhere.
  const { data: maxCat } = await supabase.from("store_categories").select("sort_order").order("sort_order", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  const nextCategorySort = (maxCat?.sort_order ?? 0) + 1;

  if (!MARKETS.some((m) => byMarket[m].title.trim())) throw new Error("no_market_filled");
  for (const market of MARKETS) {
    if (!byMarket[market].title.trim() && existingIdByMarket.has(market)) throw new Error(`market_has_data_${market}`);
  }

  for (const market of MARKETS) {
    const fields = byMarket[market];
    if (!fields.title.trim()) continue;
    const existingId = existingIdByMarket.get(market);
    if (existingId) {
      const { error } = await supabase.from("store_categories").update({ title: fields.title, has_trial: fields.hasTrial, is_primary: isPrimary }).eq("id", existingId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("store_categories")
        .insert({ id: `${finalGroupKey}-${market.toLowerCase()}`, title: fields.title, has_trial: fields.hasTrial, is_primary: isPrimary, market, group_key: finalGroupKey, sort_order: nextCategorySort });
      if (error) throw error;
    }
  }
  return finalGroupKey;
}

export async function deleteStoreCategoryGroup(groupKey: string) {
  // store_items.category_id -> store_categories.id is ON DELETE CASCADE,
  // so removing every market's category row also removes its items.
  const { error } = await supabase.from("store_categories").delete().eq("group_key", groupKey);
  if (error) throw error;
}

/** Stops selling one category in ONE market: deletes only that market's
 * row (its items in that market cascade). The other markets' rows stay —
 * the bug this replaces was the UK trash icon wiping VN too. */
export async function deleteStoreCategoryMarket(groupKey: string, market: AdminMarket) {
  const { error } = await supabase.from("store_categories").delete().eq("group_key", groupKey).eq("market", market);
  if (error) throw error;
}

/** Creates/updates the market rows of one item group, linking each
 * market's item to that SAME market's category row within
 * `categoryGroupKey` (an item's US row must reference the US category
 * row's id, not the VN one).
 *
 * Same per-market semantics as saveStoreCategoryGroup: a market with
 * BLANK name+price is "không bán ở đó" and gets no row; blank on a market
 * that already has a row is refused (`market_has_data_<MARKET>`) — use the
 * trash icon while viewing that market. A filled market whose category
 * has no row there throws `missing_category_for_market_<MARKET>`. */
export async function saveStoreItemGroup(
  categoryGroupKey: string,
  groupKey: string | "new",
  byMarket: Record<AdminMarket, StoreItemMarketFields>,
  productId: string | null = null
): Promise<string> {
  const finalGroupKey = groupKey === "new" ? `item-${Date.now()}` : groupKey;
  const [{ data: catRows, error: catErr }, { data: existingItems, error: existingErr }] = await Promise.all([
    supabase.from("store_categories").select("id, market").eq("group_key", categoryGroupKey),
    supabase.from("store_items").select("id, market").eq("group_key", finalGroupKey),
  ]);
  if (catErr) throw catErr;
  if (existingErr) throw existingErr;
  const categoryIdByMarket = new Map((catRows ?? []).map((r) => [r.market, r.id]));
  const existingIdByMarket = new Map((existingItems ?? []).map((r) => [r.market, r.id]));

  const filled = (m: AdminMarket) => !!byMarket[m].name.trim() && !!byMarket[m].price.trim();
  if (!MARKETS.some(filled)) throw new Error("no_market_filled");
  for (const market of MARKETS) {
    if (!filled(market) && existingIdByMarket.has(market)) throw new Error(`market_has_data_${market}`);
  }

  for (const market of MARKETS) {
    if (!filled(market)) continue;
    const categoryId = categoryIdByMarket.get(market);
    if (!categoryId) throw new Error(`missing_category_for_market_${market}`);
    const fields = byMarket[market];
    const payload = {
      name: fields.name,
      description: fields.desc,
      price_text: fields.price,
      external_link: fields.link || null,
      preview_url: fields.previewLink || null,
      image_url: fields.imageUrl || null,
      category_id: categoryId,
      product_id: productId,
    };
    const existingId = existingIdByMarket.get(market);
    if (existingId) {
      const { error } = await supabase.from("store_items").update(payload).eq("id", existingId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("store_items").insert({ id: `${finalGroupKey}-${market.toLowerCase()}`, group_key: finalGroupKey, market, ...payload });
      if (error) throw error;
    }
  }
  return finalGroupKey;
}

export async function deleteStoreItemGroup(groupKey: string) {
  const { error } = await supabase.from("store_items").delete().eq("group_key", groupKey);
  if (error) throw error;
}

/** Stops selling one item in ONE market — see deleteStoreCategoryMarket. */
export async function deleteStoreItemMarket(groupKey: string, market: AdminMarket) {
  const { error } = await supabase.from("store_items").delete().eq("group_key", groupKey).eq("market", market);
  if (error) throw error;
}

export async function uploadStoreItemImage(itemId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("invalid_image_type");
  if (file.size > 15 * 1024 * 1024) throw new Error("image_too_large");
  // Downscaled before upload (see downscaleImage) — mobile's Store tab
  // renders these as small cards, multi-MB originals just load slowly.
  const blob = await downscaleImage(file, 512);
  if (blob.size > 5 * 1024 * 1024) throw new Error("image_too_large");
  const safeExtension = IMAGE_EXTENSIONS[blob.type] ?? "jpg";
  const path = `${itemId}/${Date.now()}.${safeExtension}`;
  const { error } = await supabase.storage.from("store-images").upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from("store-images").getPublicUrl(path).data.publicUrl;
}

// ---------------------------------------------------------------------------
// Kích hoạt (per-product activation contacts) — CSKH manually lists the
// phone/email allowed to activate each product; the mobile app's
// claim_user_access_contact / activate_product_by_contact RPCs match against
// these rows. See migration 202609011000_per_product_activation.sql.
// ---------------------------------------------------------------------------

export interface ActivationProduct {
  id: string;
  name: string;
  /** False = roadmap still a draft: owners see a "coming soon" card after activating. */
  roadmapPublished: boolean;
}

export async function fetchActivationProducts(): Promise<ActivationProduct[]> {
  const { data, error } = await supabase.from("products").select("id, name, roadmap_published").order("id");
  if (error) throw error;
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, roadmapPublished: p.roadmap_published !== false }));
}

export interface ActivationContact {
  id: string;
  productId: string;
  contactValue: string;
  contactType: "email" | "phone";
  claimedByUserId: string | null;
  claimedByName: string | null;
  claimedAt: string | null;
  note: string | null;
  createdAt: string;
}

export async function fetchProductActivationContacts(): Promise<ActivationContact[]> {
  const { data, error } = await supabase
    .from("product_activation_contacts")
    .select("id, product_id, contact_value, contact_type, claimed_by_user_id, claimed_at, note, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const userIds = [...new Set(rows.map((r) => r.claimed_by_user_id).filter(Boolean))] as string[];
  const nameById = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
    for (const p of profiles ?? []) nameById.set(p.id, p.full_name ?? "");
  }
  return rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    contactValue: r.contact_value,
    contactType: r.contact_type as "email" | "phone",
    claimedByUserId: r.claimed_by_user_id,
    claimedByName: r.claimed_by_user_id ? nameById.get(r.claimed_by_user_id) || null : null,
    claimedAt: r.claimed_at,
    note: r.note,
    createdAt: r.created_at,
  }));
}

/** The DB trigger canonicalizes contact_type/normalized_value; the values
 * passed here just have to satisfy the NOT NULL columns. If the contact
 * already belongs to a signed-up account, a second DB trigger immediately
 * unlocks this product for that account. */
export async function addProductActivationContact(productId: string, contact: string): Promise<void> {
  const trimmed = contact.trim();
  const isEmail = trimmed.includes("@");
  const digits = trimmed.replace(/\D/g, "");
  const normalized = isEmail ? trimmed.toLowerCase() : digits.startsWith("84") ? "0" + digits.slice(2) : digits;
  const { error } = await supabase.from("product_activation_contacts").insert({
    product_id: productId,
    contact_value: trimmed,
    contact_type: isEmail ? "email" : "phone",
    normalized_value: normalized,
  });
  if (error) throw error;
}

export async function deleteProductActivationContact(id: string): Promise<void> {
  const { error } = await supabase.from("product_activation_contacts").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Phase quiz + post-quiz promo (cross-sell / IAP unlock) — see
// TheraHOME-APP/CLAUDE.md's "Quiz + phase unlock" entry for the full picture.
// ---------------------------------------------------------------------------

export interface QuizLanguageContent {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface QuizQuestionAdmin {
  id: string;
  sortOrder: number;
  vi: QuizLanguageContent;
  en: QuizLanguageContent;
  ms: QuizLanguageContent;
}

const EMPTY_QUIZ_LANGUAGE: QuizLanguageContent = { question: "", options: ["", "", "", ""], correctIndex: 0 };

export async function fetchQuizQuestions(phaseId: string): Promise<QuizQuestionAdmin[]> {
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("id, sort_order, content")
    .eq("phase_id", phaseId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((row) => {
    const content = row.content as unknown as Partial<Record<"vi" | "en" | "ms", QuizLanguageContent>>;
    return {
      id: row.id,
      sortOrder: row.sort_order,
      vi: content.vi ?? EMPTY_QUIZ_LANGUAGE,
      en: content.en ?? EMPTY_QUIZ_LANGUAGE,
      ms: content.ms ?? EMPTY_QUIZ_LANGUAGE,
    };
  });
}

export async function saveQuizQuestion(
  phaseId: string,
  question: { id: string | null; sortOrder: number; vi: QuizLanguageContent; en: QuizLanguageContent; ms: QuizLanguageContent }
) {
  const content = { vi: question.vi, en: question.en, ms: question.ms };
  if (question.id) {
    const { error } = await supabase.from("quiz_questions").update({ sort_order: question.sortOrder, content }).eq("id", question.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("quiz_questions").insert({ phase_id: phaseId, sort_order: question.sortOrder, content });
    if (error) throw error;
  }
}

export async function deleteQuizQuestion(id: string) {
  const { error } = await supabase.from("quiz_questions").delete().eq("id", id);
  if (error) throw error;
}

/** The translatable text/url fields of a phase promo — everything except
 * the two images and the Apple product id, which stay shared across
 * languages. `unlockBenefits` is one-per-line text (like the VN field). */
export interface PhasePromoTranslation {
  crossSellBadge: string;
  crossSellTitle: string;
  crossSellDescription: string;
  crossSellCtaUrl: string;
  crossSellVideoUrl: string;
  unlockDescription: string;
  unlockVideoUrl: string;
  unlockBadge: string;
  unlockTitle: string;
  unlockSubtitle: string;
  unlockBenefits: string;
  unlockPackageName: string;
  unlockPackageDesc: string;
  unlockPriceLabel: string;
}

export type PhasePromoLang = "en" | "ms";
const PHASE_PROMO_LANGS: PhasePromoLang[] = ["en", "ms"];

const EMPTY_PHASE_PROMO_TRANSLATION: PhasePromoTranslation = {
  crossSellBadge: "",
  crossSellTitle: "",
  crossSellDescription: "",
  crossSellCtaUrl: "",
  crossSellVideoUrl: "",
  unlockDescription: "",
  unlockVideoUrl: "",
  unlockBadge: "",
  unlockTitle: "",
  unlockSubtitle: "",
  unlockBenefits: "",
  unlockPackageName: "",
  unlockPackageDesc: "",
  unlockPriceLabel: "",
};

export interface PhasePromoAdmin {
  crossSellImageUrl: string;
  crossSellBadge: string;
  crossSellTitle: string;
  crossSellDescription: string;
  crossSellCtaUrl: string;
  crossSellVideoUrl: string;
  unlockImageUrl: string;
  unlockDescription: string;
  unlockVideoUrl: string;
  appleProductId: string;
  googleProductId: string;
  // Paywall-screen content (mobile app/paywall/[phaseId].tsx) — mobile falls
  // back to built-in defaults per field when left empty. `unlockBenefits` is
  // edited as one-per-line text and stored as a jsonb string array.
  unlockBadge: string;
  unlockTitle: string;
  unlockSubtitle: string;
  unlockBenefits: string;
  unlockPackageName: string;
  unlockPackageDesc: string;
  unlockPriceLabel: string;
  /** False = "tạm ngưng bán" (free-agreement mode): mobile keeps the phase
   * locked but hides the greyed header, both promo cards and the paywall
   * path entirely. */
  salesEnabled: boolean;
  /** EN/MS overrides; an empty field falls back to the VN base on mobile.
   * Stored in phase_promos.translations keyed by language then snake_case
   * column name (see migration 202609011100_phase_promo_translations). */
  translations: Record<PhasePromoLang, PhasePromoTranslation>;
}

const EMPTY_PHASE_PROMO: PhasePromoAdmin = {
  salesEnabled: true,
  crossSellImageUrl: "",
  crossSellBadge: "",
  crossSellTitle: "",
  crossSellDescription: "",
  crossSellCtaUrl: "",
  crossSellVideoUrl: "",
  unlockImageUrl: "",
  unlockDescription: "",
  unlockVideoUrl: "",
  appleProductId: "",
  googleProductId: "",
  unlockBadge: "",
  unlockTitle: "",
  unlockSubtitle: "",
  unlockBenefits: "",
  unlockPackageName: "",
  unlockPackageDesc: "",
  unlockPriceLabel: "",
  translations: { en: { ...EMPTY_PHASE_PROMO_TRANSLATION }, ms: { ...EMPTY_PHASE_PROMO_TRANSLATION } },
};

/** DB jsonb keys (snake_case, matching the base columns) <-> admin fields. */
const PROMO_TRANSLATION_KEYS: Array<[keyof PhasePromoTranslation, string]> = [
  ["crossSellBadge", "cross_sell_badge"],
  ["crossSellTitle", "cross_sell_title"],
  ["crossSellDescription", "cross_sell_description"],
  ["crossSellCtaUrl", "cross_sell_cta_url"],
  ["crossSellVideoUrl", "cross_sell_video_url"],
  ["unlockDescription", "unlock_description"],
  ["unlockVideoUrl", "unlock_video_url"],
  ["unlockBadge", "unlock_badge"],
  ["unlockTitle", "unlock_title"],
  ["unlockSubtitle", "unlock_subtitle"],
  ["unlockBenefits", "unlock_benefits"],
  ["unlockPackageName", "unlock_package_name"],
  ["unlockPackageDesc", "unlock_package_desc"],
  ["unlockPriceLabel", "unlock_price_label"],
];

function parsePromoTranslations(raw: unknown): PhasePromoAdmin["translations"] {
  const result = { en: { ...EMPTY_PHASE_PROMO_TRANSLATION }, ms: { ...EMPTY_PHASE_PROMO_TRANSLATION } };
  if (!raw || typeof raw !== "object") return result;
  for (const lang of PHASE_PROMO_LANGS) {
    const entry = (raw as Record<string, unknown>)[lang];
    if (!entry || typeof entry !== "object") continue;
    for (const [field, dbKey] of PROMO_TRANSLATION_KEYS) {
      const value = (entry as Record<string, unknown>)[dbKey];
      if (field === "unlockBenefits") {
        if (Array.isArray(value)) result[lang][field] = value.filter((v): v is string => typeof v === "string").join("\n");
      } else if (typeof value === "string") {
        result[lang][field] = value;
      }
    }
  }
  return result;
}

function serializePromoTranslations(translations: PhasePromoAdmin["translations"]): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  for (const lang of PHASE_PROMO_LANGS) {
    const entry: Record<string, unknown> = {};
    for (const [field, dbKey] of PROMO_TRANSLATION_KEYS) {
      const value = translations[lang][field].trim();
      if (!value) continue;
      entry[dbKey] = field === "unlockBenefits" ? value.split("\n").map((l) => l.trim()).filter(Boolean) : value;
    }
    if (Object.keys(entry).length) result[lang] = entry;
  }
  return result;
}

export async function fetchPhasePromo(phaseId: string): Promise<PhasePromoAdmin> {
  const { data, error } = await supabase
    .from("phase_promos")
    .select(
      "cross_sell_image_url, cross_sell_badge, cross_sell_title, cross_sell_description, cross_sell_cta_url, cross_sell_video_url, unlock_image_url, unlock_description, unlock_video_url, apple_product_id, google_product_id, unlock_badge, unlock_title, unlock_subtitle, unlock_benefits, unlock_package_name, unlock_package_desc, unlock_price_label, sales_enabled, translations"
    )
    .eq("phase_id", phaseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ...EMPTY_PHASE_PROMO, translations: parsePromoTranslations(null) };
  return {
    crossSellImageUrl: data.cross_sell_image_url ?? "",
    crossSellBadge: data.cross_sell_badge ?? "",
    crossSellTitle: data.cross_sell_title ?? "",
    crossSellDescription: data.cross_sell_description ?? "",
    crossSellCtaUrl: data.cross_sell_cta_url ?? "",
    crossSellVideoUrl: data.cross_sell_video_url ?? "",
    unlockImageUrl: data.unlock_image_url ?? "",
    unlockDescription: data.unlock_description ?? "",
    unlockVideoUrl: data.unlock_video_url ?? "",
    appleProductId: data.apple_product_id ?? "",
    googleProductId: data.google_product_id ?? "",
    unlockBadge: data.unlock_badge ?? "",
    unlockTitle: data.unlock_title ?? "",
    unlockSubtitle: data.unlock_subtitle ?? "",
    unlockBenefits: Array.isArray(data.unlock_benefits) ? (data.unlock_benefits as string[]).join("\n") : "",
    unlockPackageName: data.unlock_package_name ?? "",
    unlockPackageDesc: data.unlock_package_desc ?? "",
    unlockPriceLabel: data.unlock_price_label ?? "",
    salesEnabled: data.sales_enabled !== false,
    translations: parsePromoTranslations(data.translations),
  };
}

export async function savePhasePromo(phaseId: string, promo: PhasePromoAdmin) {
  const { error } = await supabase.from("phase_promos").upsert(
    {
      phase_id: phaseId,
      cross_sell_image_url: promo.crossSellImageUrl || null,
      cross_sell_badge: promo.crossSellBadge || null,
      cross_sell_title: promo.crossSellTitle || null,
      cross_sell_description: promo.crossSellDescription || null,
      cross_sell_cta_url: promo.crossSellCtaUrl || null,
      cross_sell_video_url: promo.crossSellVideoUrl || null,
      unlock_image_url: promo.unlockImageUrl || null,
      unlock_description: promo.unlockDescription || null,
      unlock_video_url: promo.unlockVideoUrl || null,
      apple_product_id: promo.appleProductId || null,
      google_product_id: promo.googleProductId || null,
      unlock_badge: promo.unlockBadge || null,
      unlock_title: promo.unlockTitle || null,
      unlock_subtitle: promo.unlockSubtitle || null,
      unlock_benefits: (() => {
        const lines = promo.unlockBenefits.split("\n").map((l) => l.trim()).filter(Boolean);
        return lines.length ? lines : null;
      })(),
      unlock_package_name: promo.unlockPackageName || null,
      unlock_package_desc: promo.unlockPackageDesc || null,
      unlock_price_label: promo.unlockPriceLabel || null,
      sales_enabled: promo.salesEnabled,
      translations: serializePromoTranslations(promo.translations),
    },
    { onConflict: "phase_id" }
  );
  if (error) throw error;
}

// Downscale/transcode an image in the browser before upload — admins tend to
// drop multi-MB originals in, which the mobile paywall then has to download
// and decode at full size (slow hero load). Longest edge capped at `maxDim`;
// PNG keeps alpha via WebP (or stays PNG on browsers whose canvas can't
// encode WebP, e.g. Safari), everything else goes to JPEG. Any failure falls
// back to the original file rather than blocking the upload.
async function downscaleImage(file: File, maxDim = 1600): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const alreadySmall = scale >= 1 && (file.type === "image/jpeg" || file.type === "image/webp");
    if (alreadySmall) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const preferredType = file.type === "image/png" ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, preferredType, 0.82));
    // toBlob silently falls back to PNG when it can't encode the requested
    // type — only keep the result if it actually got smaller than the input.
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadPhasePromoImage(phaseId: string, kind: "cross-sell" | "unlock", file: File) {
  if (!file.type.startsWith("image/")) throw new Error("invalid_image_type");
  if (file.size > 15 * 1024 * 1024) throw new Error("image_too_large");
  const blob = await downscaleImage(file);
  if (blob.size > 5 * 1024 * 1024) throw new Error("image_too_large");
  const safeExtension = IMAGE_EXTENSIONS[blob.type] ?? "jpg";
  const path = `phase-promos/${phaseId}/${kind}-${Date.now()}.${safeExtension}`;
  const { error } = await supabase.storage.from("store-images").upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from("store-images").getPublicUrl(path).data.publicUrl;
}


// ---------------------------------------------------------------------------
// App users (profiles + user_programs)
// ---------------------------------------------------------------------------

// Sourced from `profiles` (every real user), not `user_access_contacts` —
// activation is opt-in now (see TheraHOME-APP/CLAUDE.md's activation pass),
// so a signed-in user who never claimed a contact still needs to show up
// here for admin/CSKH to see, just with status "unactivated" and N/A stats.
// `account_type` filters out staff/TheraHOME-issued rows (see TheraAccountsView),
// which aren't patients and are managed there instead.
export async function fetchAppUsers(): Promise<SampleUser[]> {
  const [{ data: profiles, error: pErr }, { data: contacts, error: cErr }, { data: programs, error: upErr }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, phone, treatment_area, app_role, locked, created_at, account_type, country").is("deleted_at", null),
    supabase.from("user_access_contacts").select("user_id, contact_value"),
    supabase.from("user_programs").select("user_id, product_id, current_day, adherence_pct"),
  ]);
  if (pErr) throw pErr;
  if (cErr) throw cErr;
  if (upErr) throw upErr;

  const contactByUser = new Map((contacts ?? []).map((c) => [c.user_id, c.contact_value]));
  const programCountByUser = new Map<string, number>();
  const firstProgramByUser = new Map<string, { current_day: number; adherence_pct: number }>();
  // Same cap as fetchUserPrograms: a roadmap that was shortened leaves stored
  // current_day values past its new length.
  const { data: productDays } = await supabase.from("products").select("id, total_days");
  const totalDaysByProduct = new Map((productDays ?? []).map((p) => [p.id, p.total_days]));
  for (const program of programs ?? []) {
    programCountByUser.set(program.user_id, (programCountByUser.get(program.user_id) ?? 0) + 1);
    if (!firstProgramByUser.has(program.user_id)) {
      const cap = totalDaysByProduct.get(program.product_id);
      firstProgramByUser.set(program.user_id, {
        current_day: cap ? Math.min(program.current_day, cap) : program.current_day,
        adherence_pct: program.adherence_pct,
      });
    }
  }

  return (profiles ?? [])
    .filter((p) => !p.account_type || p.account_type === "normal")
    .map((p): SampleUser => {
      const program = firstProgramByUser.get(p.id);
      const activated = (programCountByUser.get(p.id) ?? 0) > 0;
      return {
        id: p.id,
        name: p.full_name || p.email || "Người dùng",
        contact: contactByUser.get(p.id) ?? p.email ?? p.phone ?? "N/A",
        area: p.treatment_area || "N/A",
        country: (p.country as SampleUser["country"]) ?? null,
        day: program?.current_day ?? null,
        adherence: program ? Math.round(Number(program.adherence_pct)) : null,
        status: p.locked ? "inactive" : activated ? "active" : "unactivated",
        joined: new Date(p.created_at).toLocaleDateString("vi-VN"),
        role: p.app_role as SampleUserRole,
        locked: p.locked,
        email: p.email,
        phone: p.phone,
      };
    });
}

/** `country` is included because it decides the customer's whole market
 * (prices, product links, program videos, pinned posts) and a wrong pick at
 * onboarding was previously only fixable with raw SQL. The profile guard
 * trigger lets `admin` through and blocks `cskh` from changing anyone's
 * market but their own. */
export async function updateAppUser(id: string, patch: { app_role?: SampleUserRole; locked?: boolean; country?: "VN" | "US" | "MALAY" }) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

// Narrow admin/cskh contact edit — goes through admin_update_user_contact
// (SECURITY DEFINER, gated on current_web_roles()) rather than a direct
// `profiles` UPDATE. Note (2026-09-05): cskh DOES now have an UPDATE policy
// on profiles, but the privileged-column triggers still block everything
// except `locked` for them — so this RPC remains the contact-edit path.
export async function updateUserContact(userId: string, patch: { email: string | null; phone: string | null }) {
  const { error } = await supabase.rpc("admin_update_user_contact", {
    p_user_id: userId,
    p_email: patch.email,
    p_phone: patch.phone,
  });
  if (error) throw error;
}

export interface UserOrderRow {
  orderId: string;
  productId: string;
  productName: string;
  status: string;
  orderDate: string;
  activatedAt: string | null;
}

// `orders` has no client RLS at all (by design) — reachable only through
// admin_fetch_user_orders, which matches by this user's claimed contact.
export async function fetchUserOrders(userId: string): Promise<UserOrderRow[]> {
  const { data, error } = await supabase.rpc("admin_fetch_user_orders", { p_user_id: userId });
  if (error) throw error;
  return (data ?? []).map((r: { order_id: string; product_id: string; product_name: string; order_status: string; order_date: string; activated_at: string | null }) => ({
    orderId: r.order_id,
    productId: r.product_id,
    productName: r.product_name,
    status: r.order_status,
    orderDate: r.order_date,
    activatedAt: r.activated_at,
  }));
}

export async function fetchUserPainTrend(id: string): Promise<number[]> {
  const { data, error } = await supabase.from("pain_logs").select("score, logged_at").eq("user_id", id).order("logged_at", { ascending: false }).limit(7);
  if (error) throw error;
  return (data ?? []).map((r) => r.score).reverse();
}

export interface UserProgramPhase {
  id: string;
  name: string;
  dayStart: number;
  dayEnd: number;
  /** True when this phase has an `apple_product_id` or `google_product_id`
   * configured — i.e. it's behind the in-app paywall on at least one
   * platform, not just the day-by-day sequential unlock. */
  requiresPayment: boolean;
  /** True when this user already has a non-revoked `phase_purchases` row for
   * this phase (real IAP or admin-granted) — the paywall is already lifted. */
  purchased: boolean;
}

export interface UserProgramRow {
  userProgramId: string;
  productId: string;
  productName: string;
  currentDay: number;
  totalDays: number;
  streak: number;
  adherencePct: number;
  currentPhaseId: string | null;
  currentPhaseName: string | null;
  /** Every phase of this product's roadmap, for the "move to phase" select. */
  phases: UserProgramPhase[];
}

// Powers UserDrawer's "Sản phẩm sở hữu" section — one row per product the
// user has activated (today the claim RPC provisions every catalog product
// at once, but this reads per-row so it stays correct if that ever changes
// to per-product ownership).
export async function fetchUserPrograms(userId: string): Promise<UserProgramRow[]> {
  const [{ data: programs, error: upErr }, { data: products, error: prErr }, { data: phases, error: phErr }, { data: promos, error: promoErr }, { data: purchases, error: purchErr }] = await Promise.all([
    supabase.from("user_programs").select("id, product_id, current_day, streak, adherence_pct").eq("user_id", userId),
    supabase.from("products").select("id, name, total_days"),
    supabase.from("program_phases").select("id, product_id, name, day_start, day_end").order("sort_order"),
    supabase.from("phase_promos").select("phase_id, apple_product_id, google_product_id"),
    supabase.from("phase_purchases").select("phase_id").eq("user_id", userId).is("revoked_at", null),
  ]);
  if (upErr) throw upErr;
  if (prErr) throw prErr;
  if (phErr) throw phErr;
  if (promoErr) throw promoErr;
  if (purchErr) throw purchErr;

  const paymentGatedPhaseIds = new Set((promos ?? []).filter((p) => !!p.apple_product_id || !!p.google_product_id).map((p) => p.phase_id));
  const purchasedPhaseIds = new Set((purchases ?? []).map((p) => p.phase_id));
  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const phasesByProduct = new Map<string, UserProgramPhase[]>();
  for (const ph of phases ?? []) {
    const list = phasesByProduct.get(ph.product_id) ?? [];
    list.push({
      id: ph.id,
      name: ph.name,
      dayStart: ph.day_start,
      dayEnd: ph.day_end,
      requiresPayment: paymentGatedPhaseIds.has(ph.id),
      purchased: purchasedPhaseIds.has(ph.id),
    });
    phasesByProduct.set(ph.product_id, list);
  }

  return (programs ?? []).map((p) => {
    const product = productById.get(p.product_id);
    const productPhases = phasesByProduct.get(p.product_id) ?? [];
    // Shortening a roadmap (dropping a phase, lowering total_days) leaves
    // stored current_day values past the end — the app already caps its own
    // calendar-derived day the same way, so never show "Ngày 15 / 14".
    const currentDay = Math.min(p.current_day, product?.total_days ?? p.current_day);
    const currentPhase = productPhases.find((ph) => currentDay >= ph.dayStart && currentDay <= ph.dayEnd);
    return {
      userProgramId: p.id,
      productId: p.product_id,
      productName: product?.name ?? p.product_id,
      currentDay,
      totalDays: product?.total_days ?? p.current_day,
      streak: p.streak,
      adherencePct: Math.round(Number(p.adherence_pct)),
      currentPhaseId: currentPhase?.id ?? null,
      currentPhaseName: currentPhase?.name ?? null,
      phases: productPhases,
    };
  });
}

// Moves a user to a different phase of their own roadmap — goes through
// admin_set_user_phase (SECURITY DEFINER) rather than a direct
// `user_programs` UPDATE, since neither admin nor cskh has an UPDATE RLS
// policy on that table today; the RPC also reconciles user_program_days'
// per-day status so the mobile app's day-by-day view stays consistent, and
// if the target phase is payment-gated (phase_promos.apple_product_id set),
// grants an admin_granted phase_purchases row so the paywall is actually
// lifted too — otherwise roadmap.tsx would immediately re-lock every day
// just moved into.
export async function setUserProgramPhase(userProgramId: string, phaseId: string) {
  const { error } = await supabase.rpc("admin_set_user_phase", { p_user_program_id: userProgramId, p_phase_id: phaseId });
  if (error) throw error;
}

// Revokes one specific product's access — deletes the user_programs row
// (cascades to user_program_days/pain_logs via existing FKs). Safe to do
// without it silently coming back: provision_new_product_for_claimed_users
// only fires on a *new* products row insert, it never re-scans/reconciles
// existing products for existing users.
export async function deleteUserProgram(userProgramId: string) {
  const { error } = await supabase.from("user_programs").delete().eq("id", userProgramId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Tài khoản TheraHOME (profiles.account_type <> 'normal') — admin-issued
// email+password accounts (App Review, staff, partners, testers). Most
// fields go through the normal authenticated client + RLS (same pattern as
// updateAppUser) since the `web admin update any profile` policy + the
// protect_privileged_profile_columns trigger already allow admin writes to
// these columns. Only creating the auth.users row (with a password) and
// resetting a password need the service-role Edge Function — see
// admin-manage-account (supabase functions).
// ---------------------------------------------------------------------------

export async function fetchTheraAccounts(): Promise<TheraAccount[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, account_type, access_level, country, locked, expires_at, onboarding_completed, created_at, last_login_at, notes")
    .neq("account_type", "normal")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r): TheraAccount => ({
    id: r.id,
    username: r.username ?? "",
    fullName: r.full_name ?? "",
    accountType: r.account_type as TheraAccountType,
    accessLevel: r.access_level as TheraAccessLevel,
    country: (r.country as TheraAccountCountry | null) ?? "VN",
    locked: r.locked,
    expiresAt: r.expires_at,
    onboardingCompleted: r.onboarding_completed,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at,
    notes: r.notes,
  }));
}

export async function updateTheraAccount(
  id: string,
  patch: Partial<{
    full_name: string;
    account_type: TheraAccountType;
    access_level: TheraAccessLevel;
    country: TheraAccountCountry;
    expires_at: string | null;
    locked: boolean;
    notes: string | null;
  }>
) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

/** `country` decides which market's store prices, product links, program
 * videos and pinned community cards the account sees. Thera-issued accounts
 * never pass through the onboarding country screen, so without it the app
 * fell back to guessing the market from the UI language (owner rule: country
 * decides content, language decides wording). Added 2026-09-05. */
export interface CreateTheraAccountInput {
  username: string;
  password: string;
  full_name: string;
  account_type: TheraAccountType;
  access_level: TheraAccessLevel;
  country: TheraAccountCountry;
  expires_at: string | null;
  onboarding_required: boolean;
  notes: string | null;
}

// `supabase.functions.invoke()` sets `error` to a `FunctionsHttpError` for
// any non-2xx response, and that error's own `.message` is always the same
// generic "Edge Function returned a non-2xx status code" — never the JSON
// body the function actually sent back (e.g. "username_already_registered",
// "invalid_username", or "Missing Authorization header" for an expired
// admin session). The real body only lives on `error.context` (the raw
// `Response`), unread. That's what made every failure reason from
// `admin-manage-account` collapse into the same unhelpful toast regardless
// of cause — including a stale/expired session, which is otherwise
// indistinguishable from "the server rejected your input." This helper is
// the fix, shared by both calls below.
async function invokeAdminManageAccount(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke("admin-manage-account", { body });
  if (error) {
    if (error instanceof FunctionsHttpError && error.context instanceof Response) {
      const parsed: { error?: string } | null = await error.context.clone().json().catch(() => null);
      if (parsed?.error) throw new Error(parsed.error);
    }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function createTheraAccount(input: CreateTheraAccountInput): Promise<string> {
  const data = await invokeAdminManageAccount({ action: "create", ...input });
  return data.user_id as string;
}

export async function resetTheraAccountPassword(userId: string, newPassword: string) {
  await invokeAdminManageAccount({ action: "reset_password", user_id: userId, new_password: newPassword });
}

// ---------------------------------------------------------------------------
// Challenges (challenges / challenge_participants) — Phase 3 of the
// Community expansion. Completion is self-declared by the mobile app once
// user_programs.streak reaches target_streak_days (also enforced by RLS
// there, not just trusted client-side).
// ---------------------------------------------------------------------------

export interface Challenge {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  targetStreakDays: number;
  active: boolean;
  createdAt: string;
  participantCount: number;
  completedCount: number;
}

export async function fetchChallenges(): Promise<Challenge[]> {
  const [{ data: challenges, error: cErr }, { data: participants, error: pErr }] = await Promise.all([
    supabase.from("challenges").select("id, title, description, icon, target_streak_days, active, created_at").order("created_at", { ascending: false }),
    supabase.from("challenge_participants").select("challenge_id, completed_at"),
  ]);
  if (cErr) throw cErr;
  if (pErr) throw pErr;

  return (challenges ?? []).map((c): Challenge => {
    const rows = (participants ?? []).filter((p) => p.challenge_id === c.id);
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      icon: c.icon,
      targetStreakDays: c.target_streak_days,
      active: c.active,
      createdAt: c.created_at,
      participantCount: rows.length,
      completedCount: rows.filter((r) => r.completed_at).length,
    };
  });
}

export async function createChallenge(input: { title: string; description: string; icon: string; targetStreakDays: number }) {
  const { error } = await supabase.from("challenges").insert({
    title: input.title,
    description: input.description || null,
    icon: input.icon || "🔥",
    target_streak_days: input.targetStreakDays,
  });
  if (error) throw error;
}

export async function setChallengeActive(id: string, active: boolean) {
  const { error } = await supabase.from("challenges").update({ active }).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Community (community_posts / post_comments)
// ---------------------------------------------------------------------------

export interface PinnedDisplay {
  title: string | null;
  content: string | null;
  thumbnailUrl: string | null;
}

/** Pin card copy per market, plus which markets the pin is live in
 * (null = every market the post targets). Added 2026-09-05 — a single card
 * used to be shown to all three markets. */
export interface PinnedMarketDisplay {
  markets: AdminMarket[] | null;
  vn: PinnedDisplay;
  us: PinnedDisplay;
  malay: PinnedDisplay;
}

/** The post's own content per market — the edit modal needs all three, not
 * just the VN base. */
export interface PostMarketContent {
  titleUs: string;
  textUs: string;
  titleMalay: string;
  textMalay: string;
}

export type PostModerationStatus = "pending" | "approved" | "rejected";

type CommunityPostRowExtras = {
  pinned: boolean;
  hidden: boolean;
  status: PostModerationStatus;
  imageUrl: string | null;
  /** Photos and videos the member attached. Moderation used to show text
   * only, so approve/reject was pressed blind on exactly the content class
   * that most needs review. `mediaFeedUrls` are the downsized copies. */
  mediaUrls: string[];
  mediaFeedUrls: string[];
  mediaPosterUrls: string[];
  pinnedDisplay: PinnedDisplay;
  pinnedMarketDisplay: PinnedMarketDisplay;
  marketContent: PostMarketContent;
  targetMarkets: string[] | null;
};

export async function fetchCommunityPosts(): Promise<(CommunityPost & CommunityPostRowExtras)[]> {
  const [{ data: posts, error: postErr }, { data: comments, error: commentErr }] = await Promise.all([
    supabase
      .from("community_posts")
      .select(
        "id, is_official, author_name, title, tag, text, image_url, media_urls, media_feed_urls, media_poster_urls, likes_count, comments_count, pinned, hidden, status, pinned_title, pinned_content, pinned_thumbnail_url, pinned_markets, pinned_title_us, pinned_content_us, pinned_thumbnail_url_us, pinned_title_malay, pinned_content_malay, pinned_thumbnail_url_malay, target_markets, title_us, text_us, title_malay, text_malay",
      )
      .order("created_at", { ascending: false }),
    supabase.from("post_comments").select("id, post_id, author_name, text, created_at, hidden").order("created_at"),
  ]);
  if (postErr) throw postErr;
  if (commentErr) throw commentErr;

  return (posts ?? []).map(
    (p): CommunityPost & CommunityPostRowExtras => ({
      id: p.id,
      official: p.is_official,
      name: p.author_name || "TheraHOME",
      meta: p.tag ?? undefined,
      title: p.title ?? undefined,
      text: p.text,
      imageUrl: p.image_url,
      mediaUrls: p.media_urls ?? [],
      mediaFeedUrls: p.media_feed_urls?.length ? p.media_feed_urls : (p.media_urls ?? []),
      mediaPosterUrls: p.media_poster_urls ?? [],
      likes: p.likes_count,
      comments: p.comments_count,
      pinned: p.pinned,
      hidden: p.hidden,
      status: (p.status as PostModerationStatus) ?? "approved",
      pinnedDisplay: { title: p.pinned_title, content: p.pinned_content, thumbnailUrl: p.pinned_thumbnail_url },
      pinnedMarketDisplay: {
        markets: (p.pinned_markets as AdminMarket[] | null) ?? null,
        vn: { title: p.pinned_title, content: p.pinned_content, thumbnailUrl: p.pinned_thumbnail_url },
        us: { title: p.pinned_title_us, content: p.pinned_content_us, thumbnailUrl: p.pinned_thumbnail_url_us },
        malay: { title: p.pinned_title_malay, content: p.pinned_content_malay, thumbnailUrl: p.pinned_thumbnail_url_malay },
      },
      marketContent: {
        titleUs: p.title_us ?? "",
        textUs: p.text_us ?? "",
        titleMalay: p.title_malay ?? "",
        textMalay: p.text_malay ?? "",
      },
      // null = hiển thị ở mọi thị trường; ngược lại chỉ các thị trường liệt kê.
      targetMarkets: p.target_markets ?? null,
      commentsList: (comments ?? [])
        .filter((c) => c.post_id === p.id)
        .map((c): CommunityComment => ({ name: c.author_name || "Người dùng", text: c.text, time: new Date(c.created_at).toLocaleDateString("vi-VN"), idKey: c.id, hidden: c.hidden })),
    })
  );
}

// CSKH/Admin moderation: approve or reject a member post (see the
// community_post_moderation migration — pending posts are invisible to
// other members until approved; the status change itself notifies the
// author via a DB trigger).
export async function setCommunityPostStatus(idKey: string, status: PostModerationStatus) {
  const { error } = await supabase.from("community_posts").update({ status }).eq("id", idKey);
  if (error) throw error;
}

// Official posts are authored by Admin or CSKH via the staff-only RPC. They
// use a simple title/body editor; no type or category is required.
export async function createOfficialPost(input: {
  title: string;
  text: string;
  sendNotification: boolean;
  notifyTitle?: string;
  notifyBody?: string;
  // Market targeting: null/empty = visible to everyone (the default).
  // Only markets actually included here need their own title/text — the
  // RPC itself enforces that (rejects a targeted market with no content).
  targetMarkets?: AdminMarket[];
  titleUs?: string;
  textUs?: string;
  titleMalay?: string;
  textMalay?: string;
  // Push blurb overrides for the UK/ML variants, same "defaults to the
  // post's own market content, editable" relationship notifyTitle/
  // notifyBody already have with the VN title/text.
  notifyTitleUs?: string;
  notifyBodyUs?: string;
  notifyTitleMalay?: string;
  notifyBodyMalay?: string;
}): Promise<{ id: string; pushError: string | null }> {
  // The RPC gives Admin and CSKH precisely one privilege: create a branded
  // TheraHOME post. It deliberately does not grant them broad write access to
  // community posts made by members.
  const { data: postId, error } = await supabase.rpc("create_official_community_post", {
    p_title: input.title,
    p_text: input.text,
    p_notify: input.sendNotification,
    p_target_markets: input.targetMarkets?.length ? input.targetMarkets : null,
    p_title_us: input.titleUs || null,
    p_text_us: input.textUs || null,
    p_title_malay: input.titleMalay || null,
    p_text_malay: input.textMalay || null,
  });
  if (error || !postId) throw error ?? new Error("Không thể tạo bài viết");
  if (input.sendNotification) {
    // Push title/body default to the post's own title/text but can be
    // overridden — the post content and the notification blurb serve
    // different purposes (a punchy push line vs. the full post body).
    // Same relationship for the UK/ML variants (only sent — and only
    // needed — when that market is actually targeted).
    const pushTitle = (input.notifyTitle?.trim() || input.title).slice(0, 80);
    const pushBody = (input.notifyBody?.trim() || input.text).slice(0, 180);
    const pushTitleUs = (input.notifyTitleUs?.trim() || input.titleUs || "").slice(0, 80) || undefined;
    const pushBodyUs = (input.notifyBodyUs?.trim() || input.textUs || "").slice(0, 180) || undefined;
    const pushTitleMalay = (input.notifyTitleMalay?.trim() || input.titleMalay || "").slice(0, 80) || undefined;
    const pushBodyMalay = (input.notifyBodyMalay?.trim() || input.textMalay || "").slice(0, 180) || undefined;
    const { error: pushErr } = await supabase.functions.invoke("dispatch-push", {
      body: {
        mode: "broadcast",
        all: true,
        title: pushTitle,
        body: pushBody,
        data: { type: "blog", postId },
        // Only sent when the post itself is market-targeted — an
        // untargeted post (the common case) still pushes to everyone,
        // unchanged from before.
        targetMarkets: input.targetMarkets?.length ? input.targetMarkets : undefined,
        titleUs: pushTitleUs,
        bodyUs: pushBodyUs,
        titleMalay: pushTitleMalay,
        bodyMalay: pushBodyMalay,
      },
    });
    if (pushErr) console.error("dispatch-push failed for official post", postId, pushErr);
    return { id: String(postId), pushError: pushErr ? String(pushErr.message ?? pushErr) : null };
  }
  return { id: String(postId), pushError: null };
}
export async function updateCommunityPost(
  idKey: string,
  patch: {
    meta?: string;
    title?: string;
    text?: string;
    pinned?: boolean;
    hidden?: boolean;
    imageUrl?: string | null;
    // Per-market variants — the edit modal used to write only the VN base,
    // so a UK/ML version could never be corrected after publishing.
    titleUs?: string | null;
    textUs?: string | null;
    titleMalay?: string | null;
    textMalay?: string | null;
    targetMarkets?: AdminMarket[] | null;
  },
) {
  // A pin can never outlive the post's own reach: if target markets shrink,
  // drop the pin from markets no longer targeted (or unpin entirely).
  let pinPatch: { pinned?: boolean; pinned_markets?: AdminMarket[] | null } = {};
  if (patch.targetMarkets !== undefined) {
    const { data: pinRow } = await supabase.from("community_posts").select("pinned, pinned_markets, target_markets").eq("id", idKey).maybeSingle();
    if (pinRow?.pinned) {
      const currentPin = (pinRow.pinned_markets as AdminMarket[] | null) ?? (pinRow.target_markets as AdminMarket[] | null);
      if (patch.targetMarkets === null) pinPatch = { pinned_markets: currentPin };
      else {
        const kept = (currentPin ?? patch.targetMarkets).filter((m) => patch.targetMarkets!.includes(m));
        pinPatch = kept.length ? { pinned_markets: kept } : { pinned: false, pinned_markets: null };
      }
    }
  }
  const { error } = await supabase
    .from("community_posts")
    // undefined keys are stripped by supabase-js, so only fields the caller
    // actually passed get updated (imageUrl: null clears the image).
    .update({
      ...pinPatch,
      tag: patch.meta,
      title: patch.title,
      text: patch.text,
      pinned: patch.pinned,
      hidden: patch.hidden,
      image_url: patch.imageUrl,
      title_us: patch.titleUs,
      text_us: patch.textUs,
      title_malay: patch.titleMalay,
      text_malay: patch.textMalay,
      target_markets: patch.targetMarkets,
    })
    .eq("id", idKey);
  if (error) throw error;
}
export async function setOfficialPostPinned(
  idKey: string,
  pinned: boolean,
  display?: {
    markets?: AdminMarket[] | null;
    vn: { title: string; content: string; thumbnailUrl: string | null };
    us?: { title: string; content: string; thumbnailUrl: string | null };
    malay?: { title: string; content: string; thumbnailUrl: string | null };
  },
) {
  const { error } = await supabase.rpc("set_official_post_pinned", {
    p_post_id: idKey,
    p_pinned: pinned,
    p_title: display?.vn.title ?? null,
    p_content: display?.vn.content ?? null,
    p_thumbnail_url: display?.vn.thumbnailUrl ?? null,
    // null = pin in every market the post targets (pre-2026-09-05 behaviour).
    p_markets: display?.markets?.length ? display.markets : null,
    p_title_us: display?.us?.title ?? null,
    p_content_us: display?.us?.content ?? null,
    p_thumbnail_url_us: display?.us?.thumbnailUrl ?? null,
    p_title_malay: display?.malay?.title ?? null,
    p_content_malay: display?.malay?.content ?? null,
    p_thumbnail_url_malay: display?.malay?.thumbnailUrl ?? null,
  });
  if (error) throw error;
}

// Reuses the `community-images` bucket the mobile app already uploads post
// photos into (see TheraHOME-APP/CLAUDE.md) rather than a new bucket — its
// RLS (`(storage.foldername(name))[1] = auth.uid()`, public reads) already
// permits any authenticated user, including a signed-in admin/cskh account,
// to write under their own uid, so no policy change was needed.
export async function uploadPostThumbnail(postId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("invalid_image_type");
  if (file.size > 15 * 1024 * 1024) throw new Error("image_too_large");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not_signed_in");
  const blob = await downscaleImage(file, 640);
  if (blob.size > 5 * 1024 * 1024) throw new Error("image_too_large");
  const safeExtension = IMAGE_EXTENSIONS[blob.type] ?? "jpg";
  const path = `${user.id}/pinned-${postId}-${Date.now()}.${safeExtension}`;
  const { error } = await supabase.storage.from("community-images").upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from("community-images").getPublicUrl(path).data.publicUrl;
}
export async function deleteCommunityPost(idKey: string) {
  const { error } = await supabase.from("community_posts").delete().eq("id", idKey);
  if (error) throw error;
}
export async function deleteCommunityComment(idKey: string) {
  const { error } = await supabase.from("post_comments").delete().eq("id", idKey);
  if (error) throw error;
}
export async function hideCommunityComment(idKey: string, hidden: boolean) {
  const { error } = await supabase.from("post_comments").update({ hidden }).eq("id", idKey);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Content reports (content_reports) — Admin moderation queue for both posts
// and comments. See TheraHOME-APP's community_moderation_and_notifications
// migration.
// ---------------------------------------------------------------------------

export interface ContentReport {
  id: string;
  contentType: "post" | "comment";
  contentId: string;
  reason: string;
  note: string | null;
  status: "pending" | "resolved" | "dismissed";
  createdAt: string;
  reporterName: string | null;
  // Resolved client-side by joining against the reported post/comment —
  // null if the underlying content was already hard-deleted.
  contentText: string | null;
  contentAuthorId: string | null;
  contentAuthorName: string | null;
  postId: string | null;
}

export async function fetchContentReports(): Promise<ContentReport[]> {
  const { data: reports, error } = await supabase
    .from("content_reports")
    .select("id, content_type, content_id, reporter_id, reason, note, status, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const postIds = (reports ?? []).filter((r) => r.content_type === "post").map((r) => r.content_id);
  const commentIds = (reports ?? []).filter((r) => r.content_type === "comment").map((r) => r.content_id);
  const reporterIds = Array.from(new Set((reports ?? []).map((r) => r.reporter_id)));

  const [{ data: posts, error: postErr }, { data: comments, error: commentErr }, { data: reporters, error: reporterErr }] = await Promise.all([
    postIds.length
      ? supabase.from("community_posts").select("id, text, author_id, author_name").in("id", postIds)
      : Promise.resolve({ data: [], error: null }),
    commentIds.length
      ? supabase.from("post_comments").select("id, post_id, text, author_id, author_name").in("id", commentIds)
      : Promise.resolve({ data: [], error: null }),
    reporterIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", reporterIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (postErr) throw postErr;
  if (commentErr) throw commentErr;
  if (reporterErr) throw reporterErr;

  const postById = new Map((posts ?? []).map((p) => [p.id, p]));
  const commentById = new Map((comments ?? []).map((c) => [c.id, c]));
  const reporterNameById = new Map((reporters ?? []).map((r) => [r.id, r.full_name || r.email || "Người dùng"]));

  return (reports ?? []).map((r): ContentReport => {
    const reporterName = reporterNameById.get(r.reporter_id) ?? null;
    if (r.content_type === "post") {
      const p = postById.get(r.content_id);
      return {
        id: r.id,
        contentType: "post",
        contentId: r.content_id,
        reason: r.reason,
        note: r.note,
        status: r.status as ContentReport["status"],
        createdAt: r.created_at,
        reporterName,
        contentText: p?.text ?? null,
        contentAuthorId: p?.author_id ?? null,
        contentAuthorName: p?.author_name ?? null,
        postId: p?.id ?? null,
      };
    }
    const c = commentById.get(r.content_id);
    return {
      id: r.id,
      contentType: "comment",
      contentId: r.content_id,
      reason: r.reason,
      note: r.note,
      status: r.status as ContentReport["status"],
      createdAt: r.created_at,
      reporterName,
      contentText: c?.text ?? null,
      contentAuthorId: c?.author_id ?? null,
      contentAuthorName: c?.author_name ?? null,
      postId: c?.post_id ?? null,
    };
  });
}

export async function resolveContentReport(id: string, status: "resolved" | "dismissed") {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("content_reports")
    .update({ status, resolved_by: user?.id ?? null, resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Notifications — real rows are per-user; a "campaign" here is a batch of
// rows inserted with the same title/body/created_at, grouped back together
// for display since there's no separate broadcast-log table.
// ---------------------------------------------------------------------------

export interface NotificationCampaign {
  key: string;
  type: NotificationItem["type"];
  title: string;
  body: string;
  time: string;
  reach: number;
}

export async function fetchNotificationCampaigns(): Promise<NotificationCampaign[]> {
  const { data, error } = await supabase.from("notifications").select("type, title, body, created_at").order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  const groups = new Map<string, NotificationCampaign>();
  for (const row of data ?? []) {
    const key = `${row.type}|${row.title}|${row.body}|${row.created_at}`;
    const existing = groups.get(key);
    if (existing) {
      existing.reach += 1;
    } else {
      groups.set(key, {
        key,
        type: row.type as NotificationItem["type"],
        title: row.title,
        body: row.body ?? "",
        time: new Date(row.created_at).toLocaleString("vi-VN"),
        reach: 1,
      });
    }
  }
  return Array.from(groups.values()).slice(0, 30);
}

export async function sendNotificationBroadcast(input: { type: NotificationItem["type"]; title: string; body: string; target: string }) {
  let userIds: string[];
  if (input.target === "all") {
    const { data, error } = await supabase.from("profiles").select("id").is("deleted_at", null);
    if (error) throw error;
    userIds = (data ?? []).map((r) => r.id);
  } else {
    const { data, error } = await supabase.from("user_programs").select("user_id").eq("product_id", input.target);
    if (error) throw error;
    userIds = (data ?? []).map((r) => r.user_id);
  }
  if (userIds.length === 0) return 0;
  const createdAt = new Date().toISOString();
  const { error } = await supabase.from("notifications").insert(
    userIds.map((user_id) => ({ user_id, type: input.type, title: input.title, body: input.body, created_at: createdAt }))
  );
  if (error) throw error;
  void supabase.functions.invoke("dispatch-push", {
    body: { mode: "broadcast", userIds, title: input.title, body: input.body, data: { type: input.type } },
  });
  return userIds.length;
}

// ---------------------------------------------------------------------------
// System notification copy — content is configured here, but delivery is
// always automatic (device reminder or the protected system worker).
// ---------------------------------------------------------------------------

export type SystemNotificationTemplateKey =
  | "daily_workout"
  | "evening_reminder"
  | "inactive_2"
  | "inactive_3"
  | "inactive_4"
  | "inactive_5"
  | "inactive_7"
  | "inactive_10"
  | "inactive_14";

export type NotificationLanguage = "vi" | "en" | "ms";
export interface SystemNotificationTemplateCopy {
  title: string;
  body: string;
  updatedAt: string;
}

// One row per (template_key, language) now — each key groups its up-to-3
// language rows so the admin UI can show VN/EN/MS as tabs of one card
// instead of 27 flat rows. A language with no row yet (not every template
// has been translated) is simply absent from byLanguage; the edge
// functions/mobile client fall back to 'vi' or a hardcoded copy in that
// case — see TheraHOME-APP/CLAUDE.md.
export interface SystemNotificationTemplate {
  templateKey: SystemNotificationTemplateKey;
  byLanguage: Partial<Record<NotificationLanguage, SystemNotificationTemplateCopy>>;
}

export async function fetchSystemNotificationTemplates(): Promise<SystemNotificationTemplate[]> {
  const { data, error } = await supabase
    .from("system_notification_templates")
    .select("template_key, language, title, body, updated_at")
    .order("template_key");
  if (error) throw error;
  const byKey = new Map<SystemNotificationTemplateKey, SystemNotificationTemplate>();
  for (const row of data ?? []) {
    const key = row.template_key as SystemNotificationTemplateKey;
    const entry = byKey.get(key) ?? { templateKey: key, byLanguage: {} };
    entry.byLanguage[row.language as NotificationLanguage] = { title: row.title, body: row.body, updatedAt: row.updated_at };
    byKey.set(key, entry);
  }
  return [...byKey.values()];
}

export async function saveSystemNotificationTemplate(input: { templateKey: SystemNotificationTemplateKey; language: NotificationLanguage; title: string; body: string }) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw userError ?? new Error("Bạn chưa đăng nhập");
  const { error } = await supabase.from("system_notification_templates").upsert({
    template_key: input.templateKey,
    language: input.language,
    title: input.title,
    body: input.body,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Scheduled Upsale campaigns (upsell_campaigns)
// ---------------------------------------------------------------------------

export interface UpsellCampaign {
  id: string;
  title: string;
  body: string;
  titleEn: string | null;
  bodyEn: string | null;
  titleMs: string | null;
  bodyMs: string | null;
  target: string;
  destination: "store" | "home" | "roadmap" | "community";
  scheduledFor: string;
  status: "scheduled" | "processing" | "sent" | "cancelled";
  createdAt: string;
  sentAt: string | null;
  recipientCount: number;
}

export async function fetchUpsellCampaigns(): Promise<UpsellCampaign[]> {
  const { data, error } = await supabase
    .from("upsell_campaigns")
    .select("id, title, body, title_en, body_en, title_ms, body_ms, target, destination, scheduled_for, status, created_at, sent_at, recipient_count")
    .order("scheduled_for", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((campaign): UpsellCampaign => ({
    id: campaign.id,
    title: campaign.title,
    body: campaign.body,
    titleEn: campaign.title_en,
    bodyEn: campaign.body_en,
    titleMs: campaign.title_ms,
    bodyMs: campaign.body_ms,
    target: campaign.target,
    destination: campaign.destination as UpsellCampaign["destination"],
    scheduledFor: campaign.scheduled_for,
    status: campaign.status as UpsellCampaign["status"],
    createdAt: campaign.created_at,
    sentAt: campaign.sent_at,
    recipientCount: campaign.recipient_count ?? 0,
  }));
}

export async function createUpsellCampaigns(input: {
  target: string;
  destination: UpsellCampaign["destination"];
  schedules: Array<{ title: string; body: string; scheduledFor: string; titleEn?: string; bodyEn?: string; titleMs?: string; bodyMs?: string }>;
}) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw userError ?? new Error("Bạn chưa đăng nhập");
  const { error } = await supabase.from("upsell_campaigns").insert(input.schedules.map((schedule) => ({
    title: schedule.title,
    body: schedule.body,
    title_en: schedule.titleEn || null,
    body_en: schedule.bodyEn || null,
    title_ms: schedule.titleMs || null,
    body_ms: schedule.bodyMs || null,
    target: input.target,
    destination: input.destination,
    scheduled_for: schedule.scheduledFor,
    created_by: user.id,
  })));
  if (error) throw error;
}

export async function cancelUpsellCampaign(id: string) {
  // A 0-row UPDATE is not an error in PostgREST, so a campaign that has
  // already moved to `processing` used to show "Đã hủy" while still sending.
  const { data, error } = await supabase.from("upsell_campaigns").update({ status: "cancelled" }).eq("id", id).eq("status", "scheduled").select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("not_cancellable");
}

// ---------------------------------------------------------------------------
// Chat (chat_threads / chat_messages) — CSKH specialist reply path
// ---------------------------------------------------------------------------

export async function fetchChatThreads(): Promise<ChatThread[]> {
  const [{ data: threads, error: tErr }, { data: messages, error: mErr }, { data: profiles, error: pErr }, { data: reactions, error: rErr }] = await Promise.all([
    supabase.from("chat_threads").select("id, user_id, created_at").eq("kind", "human").order("created_at", { ascending: false }),
    supabase.from("chat_messages").select("id, thread_id, sender_type, body, created_at, attachment_path, read_at, edited_at, deleted_at, reply_to_message_id").order("created_at"),
    supabase.from("profiles").select("id, full_name, email, language, country"),
    supabase.from("chat_message_reactions").select("id, message_id, user_id, emoji"),
  ]);
  if (tErr) throw tErr;
  if (mErr) throw mErr;
  if (pErr) throw pErr;
  if (rErr) throw rErr;

  const nameByUser = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email || "Người dùng"]));
  const profileByUser = new Map((profiles ?? []).map((p) => [p.id, p]));

  // Threads are auto-created the moment a user OPENS the chat screen — one
  // with zero messages is just that, so it stays out of the CSKH list (per
  // explicit request) until the user actually sends something.
  const threadsWithMessages = (threads ?? []).filter((t) => (messages ?? []).some((m) => m.thread_id === t.id));

  // ONE signing call for every attachment instead of one per message — this
  // fetch re-runs on every realtime change, and N+1 storage calls made the
  // CSKH tab crawl once threads had a few hundred photos.
  const attachmentPaths = [...new Set((messages ?? []).map((m) => m.attachment_path).filter((p): p is string => !!p))];
  const signedByPath = new Map<string, string>();
  if (attachmentPaths.length) {
    const { data: signedList } = await supabase.storage.from("chat-attachments").createSignedUrls(attachmentPaths, 3600);
    for (const item of signedList ?? []) if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
  }

  return Promise.all(threadsWithMessages.map(async (t) => {
    const msgs = (messages ?? []).filter((m) => m.thread_id === t.id);
    const chatMessages: ChatMessage[] = await Promise.all(msgs.map(async (m) => {
      const imageUrl: string | null = m.attachment_path ? signedByPath.get(m.attachment_path) ?? null : null;
      return {
        id: m.id,
        from: m.sender_type === "specialist" ? "admin" : "user",
        text: m.body,
        time: new Date(m.created_at).toLocaleString("vi-VN"),
        imageUrl,
        attachmentKind: m.attachment_path?.match(/\.(mp4|mov|m4v|webm)(?:$|\?)/i) ? "video" : m.attachment_path ? "image" : null,
        readAt: m.read_at,
        editedAt: m.edited_at,
        deletedAt: m.deleted_at,
        replyToMessageId: m.reply_to_message_id,
        reactions: (reactions ?? []).filter((reaction) => reaction.message_id === m.id).map((reaction) => ({ id: reaction.id, userId: reaction.user_id, emoji: reaction.emoji })),
      };
    }));
    return {
      id: t.id,
      userId: t.user_id,
      user: nameByUser.get(t.user_id) ?? "Người dùng",
      language: (profileByUser.get(t.user_id)?.language as ChatThread["language"]) ?? "vi",
      country: (profileByUser.get(t.user_id)?.country as ChatThread["country"]) ?? null,
      unread: msgs.some((m) => m.sender_type === "user" && !m.read_at),
      time: new Date(t.created_at).toLocaleString("vi-VN"),
      messages: chatMessages.length ? chatMessages : [{ from: "user", text: "(Chưa có tin nhắn)", time: "" }],
    };
  }));
}

export async function sendSpecialistMessage(threadId: string, text: string, attachmentPath?: string | null, replyToMessageId?: string | null) {
  const { error } = await supabase.from("chat_messages").insert({
    thread_id: threadId,
    sender_type: "specialist",
    body: text,
    attachment_path: attachmentPath ?? null,
    reply_to_message_id: replyToMessageId ?? null,
  });
  if (error) throw error;
  // `attachment` lets dispatch-push say "Sent a photo" in the customer's own language.
  void supabase.functions.invoke("dispatch-push", { body: { mode: "chat", threadId, senderType: "specialist", preview: text || undefined, attachment: !text } });
}

export async function editSpecialistMessage(messageId: string, body: string) {
  const { error } = await supabase.from("chat_messages").update({ body, edited_at: new Date().toISOString() }).eq("id", messageId);
  if (error) throw error;
}

export async function deleteSpecialistMessage(messageId: string) {
  const { error } = await supabase.from("chat_messages").update({ deleted_at: new Date().toISOString() }).eq("id", messageId);
  if (error) throw error;
}

export async function toggleSpecialistReaction(messageId: string, emoji: string, current?: { id: string; emoji: string }) {
  if (current?.emoji === emoji) {
    const { error } = await supabase.from("chat_message_reactions").delete().eq("id", current.id);
    if (error) throw error;
    return;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  const { error } = await supabase.from("chat_message_reactions").upsert({ message_id: messageId, user_id: user.id, emoji }, { onConflict: "message_id,user_id" });
  if (error) throw error;
}

export async function uploadSpecialistChatImage(userId: string, threadId: string, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${threadId}/${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from("chat-attachments").upload(path, file, {
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  return path;
}

export async function markThreadMessagesRead(threadId: string) {
  const { error } = await supabase
    .from("chat_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("sender_type", "user")
    .is("read_at", null);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// AI assistant config (ai_prompts / ai_suggested_replies) — read live by the
// chat-ai-reply Edge Function, and by the mobile app's suggestion chips.
// ---------------------------------------------------------------------------

export async function fetchAIPrompt(): Promise<string> {
  const { data, error } = await supabase.from("ai_prompts").select("system_prompt").eq("id", true).maybeSingle();
  if (error) throw error;
  return data?.system_prompt ?? "";
}

export async function updateAIPrompt(systemPrompt: string) {
  const { data: { user } } = await supabase.auth.getUser();
  // Upsert: an UPDATE on a missing singleton row is a silent 0-row no-op.
  const { error } = await supabase
    .from("ai_prompts")
    .upsert({ id: true, system_prompt: systemPrompt, updated_at: new Date().toISOString(), updated_by: user?.id ?? null }, { onConflict: "id" });
  if (error) throw error;
}

export interface AISuggestedReply {
  id: string;
  text: string;
  /** EN/MS versions shown to users on those app languages (VN fallback in
   * the app when empty). Auto-drafted on add, editable here. */
  textEn: string;
  textMs: string;
  sortOrder: number;
}

export async function fetchAISuggestedReplies(): Promise<AISuggestedReply[]> {
  const { data, error } = await supabase.from("ai_suggested_replies").select("id, text, text_en, text_ms, sort_order").order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, text: r.text, textEn: r.text_en ?? "", textMs: r.text_ms ?? "", sortOrder: r.sort_order }));
}

export async function addAISuggestedReply(text: string, sortOrder: number, drafts?: { textEn?: string; textMs?: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("ai_suggested_replies")
    .insert({ text, text_en: drafts?.textEn || null, text_ms: drafts?.textMs || null, sort_order: sortOrder, created_by: user?.id ?? null });
  if (error) throw error;
}

export async function updateAISuggestedReply(id: string, patch: { text?: string; textEn?: string; textMs?: string }) {
  const { error } = await supabase
    .from("ai_suggested_replies")
    .update({
      ...(patch.text !== undefined ? { text: patch.text } : {}),
      ...(patch.textEn !== undefined ? { text_en: patch.textEn || null } : {}),
      ...(patch.textMs !== undefined ? { text_ms: patch.textMs || null } : {}),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAISuggestedReply(id: string) {
  const { error } = await supabase.from("ai_suggested_replies").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// App content (app_config) — settings the mobile app used to hardcode
// ---------------------------------------------------------------------------

export interface AppConfigRow {
  key: string;
  valueVi: string;
  valueEn: string;
  valueMs: string;
}

export async function fetchAppConfig(): Promise<AppConfigRow[]> {
  const { data, error } = await supabase.from("app_config").select("key, value_vi, value_en, value_ms").order("key");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    key: r.key,
    valueVi: r.value_vi ?? "",
    valueEn: r.value_en ?? "",
    valueMs: r.value_ms ?? "",
  }));
}

/** Empty string clears an override — mobile then falls back to the VN value,
 * and to its own built-in default if that is empty too. */
export async function saveAppConfig(rows: AppConfigRow[]) {
  for (const row of rows) {
    const { error } = await supabase
      .from("app_config")
      .update({
        value_vi: row.valueVi.trim() || null,
        value_en: row.valueEn.trim() || null,
        value_ms: row.valueMs.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("key", row.key);
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------------
// Legal documents (legal_documents) — admin-publishable overrides
// ---------------------------------------------------------------------------

export type LegalLang = "vi" | "en" | "ms";

export interface LegalDocOverride {
  docKey: string;
  language: LegalLang;
  title: string;
  body: string;
  updatedAt: string;
}

/** Only rows an admin has actually published. Anything missing means the app
 * still renders its bundled text — deleting a row is how you revert. */
export async function fetchLegalOverrides(): Promise<LegalDocOverride[]> {
  const { data, error } = await supabase
    .from("legal_documents")
    .select("doc_key, language, title, body, updated_at");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    docKey: r.doc_key,
    language: r.language as LegalLang,
    title: r.title,
    body: r.body,
    updatedAt: r.updated_at,
  }));
}

export async function saveLegalOverride(input: { docKey: string; language: LegalLang; title: string; body: string }) {
  const { error } = await supabase.from("legal_documents").upsert(
    {
      doc_key: input.docKey,
      language: input.language,
      title: input.title,
      body: input.body,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "doc_key,language" }
  );
  if (error) throw error;
}

/** Reverts one document+language to the version bundled in the app. */
export async function deleteLegalOverride(docKey: string, language: LegalLang) {
  const { error } = await supabase.from("legal_documents").delete().eq("doc_key", docKey).eq("language", language);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// FAQ (faq_items) — Hồ sơ → Trợ giúp in the mobile app
// ---------------------------------------------------------------------------

export interface FaqItemAdmin {
  id: string;
  sortOrder: number;
  active: boolean;
  questionVi: string;
  answerVi: string;
  questionEn: string;
  answerEn: string;
  questionMs: string;
  answerMs: string;
}

export async function fetchFaqItems(): Promise<FaqItemAdmin[]> {
  const { data, error } = await supabase
    .from("faq_items")
    .select("id, sort_order, active, question_vi, answer_vi, question_en, answer_en, question_ms, answer_ms")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    sortOrder: r.sort_order,
    active: r.active,
    questionVi: r.question_vi,
    answerVi: r.answer_vi,
    questionEn: r.question_en ?? "",
    answerEn: r.answer_en ?? "",
    questionMs: r.question_ms ?? "",
    answerMs: r.answer_ms ?? "",
  }));
}

/** `id: "new"` inserts. Empty EN/MS fields clear the override — the app then
 * shows the Vietnamese text for those markets. */
export async function saveFaqItem(item: FaqItemAdmin) {
  const payload = {
    sort_order: item.sortOrder,
    active: item.active,
    question_vi: item.questionVi.trim(),
    answer_vi: item.answerVi.trim(),
    question_en: item.questionEn.trim() || null,
    answer_en: item.answerEn.trim() || null,
    question_ms: item.questionMs.trim() || null,
    answer_ms: item.answerMs.trim() || null,
    updated_at: new Date().toISOString(),
  };
  if (item.id === "new") {
    const { error } = await supabase.from("faq_items").insert(payload);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("faq_items").update(payload).eq("id", item.id);
  if (error) throw error;
}

export async function deleteFaqItem(id: string) {
  const { error } = await supabase.from("faq_items").delete().eq("id", id);
  if (error) throw error;
}

/** Persists a new order after a move up/down. */
export async function reorderFaqItems(ids: string[]) {
  for (let index = 0; index < ids.length; index++) {
    const { error } = await supabase.from("faq_items").update({ sort_order: index + 1 }).eq("id", ids[index]);
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------------
// Insights: survey answers (user_quiz_attempts) + IAP purchases
// ---------------------------------------------------------------------------

export interface SurveyAnswer {
  question: string;
  answer: string;
  optionIndex: number;
}

export interface SurveyAttempt {
  id: string;
  userName: string;
  phaseName: string;
  productName: string;
  completedAt: string;
  answers: SurveyAnswer[];
}

/** Every phase survey submitted, newest first. The mobile app stores the
 * question + chosen option AS THE USER SAW THEM, so answers stay readable
 * even after admin later edits the question. */
export async function fetchSurveyAttempts(limit = 200): Promise<SurveyAttempt[]> {
  const [{ data: attempts, error }, { data: phases }, { data: products }, { data: profs }] = await Promise.all([
    supabase.from("user_quiz_attempts").select("id, user_id, phase_id, completed_at, answers").order("completed_at", { ascending: false }).limit(limit),
    supabase.from("program_phases").select("id, name, product_id"),
    supabase.from("products").select("id, name"),
    supabase.from("profiles").select("id, full_name, username"),
  ]);
  if (error) throw error;

  const phaseById = new Map((phases ?? []).map((p) => [p.id, p]));
  const productById = new Map((products ?? []).map((p) => [p.id, p.name]));
  const profileById = new Map((profs ?? []).map((p) => [p.id, p.full_name || p.username || ""]));

  return (attempts ?? []).map((a) => {
    const phase = phaseById.get(a.phase_id);
    const raw = (a.answers ?? {}) as Record<string, { question?: string; answer?: string; optionIndex?: number }>;
    return {
      id: a.id,
      userName: profileById.get(a.user_id) || "Người dùng",
      phaseName: phase?.name ?? "",
      productName: phase ? productById.get(phase.product_id) ?? "" : "",
      completedAt: a.completed_at,
      answers: Object.values(raw).map((v) => ({
        question: v.question ?? "",
        answer: v.answer ?? "",
        optionIndex: v.optionIndex ?? 0,
      })),
    };
  });
}

export interface PurchaseRow {
  id: string;
  userName: string;
  productName: string;
  phaseName: string;
  platform: string;
  purchasedAt: string;
  revokedAt: string | null;
}

export async function fetchPhasePurchases(limit = 200): Promise<PurchaseRow[]> {
  const [{ data: rows, error }, { data: phases }, { data: products }, { data: profs }] = await Promise.all([
    supabase.from("phase_purchases").select("id, user_id, phase_id, platform, purchased_at, revoked_at").order("purchased_at", { ascending: false }).limit(limit),
    supabase.from("program_phases").select("id, name, product_id"),
    supabase.from("products").select("id, name"),
    supabase.from("profiles").select("id, full_name, username"),
  ]);
  if (error) throw error;

  const phaseById = new Map((phases ?? []).map((p) => [p.id, p]));
  const productById = new Map((products ?? []).map((p) => [p.id, p.name]));
  const profileById = new Map((profs ?? []).map((p) => [p.id, p.full_name || p.username || ""]));

  return (rows ?? []).map((r) => {
    const phase = phaseById.get(r.phase_id);
    return {
      id: r.id,
      userName: profileById.get(r.user_id) || "Người dùng",
      productName: phase ? productById.get(phase.product_id) ?? "" : "",
      phaseName: phase?.name ?? "",
      platform: r.platform,
      purchasedAt: r.purchased_at,
      revokedAt: r.revoked_at,
    };
  });
}

// ---------------------------------------------------------------------------
// Onboarding questionnaire wording (onboarding_question_texts)
// ---------------------------------------------------------------------------

export interface OnboardingQuestionText {
  questionKey: string;
  language: LegalLang;
  title: string;
  subtitle: string;
  options: string[];
}

export async function fetchOnboardingTexts(): Promise<OnboardingQuestionText[]> {
  const { data, error } = await supabase
    .from("onboarding_question_texts")
    .select("question_key, language, title, subtitle, options");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    questionKey: r.question_key,
    language: r.language as LegalLang,
    title: r.title,
    subtitle: r.subtitle ?? "",
    options: r.options ?? [],
  }));
}

/** Wording only. The caller must pass exactly as many options as the row
 * already has — the mobile app maps a user's saved answer by its POSITION in
 * this list, so adding/removing/reordering would silently re-map existing
 * profiles to a different answer. */
export async function saveOnboardingText(input: OnboardingQuestionText, expectedOptionCount: number) {
  if (input.options.length !== expectedOptionCount) {
    throw new Error("option_count_mismatch");
  }
  // Upsert so a language that has no row yet (e.g. a missing MS version) can
  // be created from Admin — UPDATE alone left it uncreatable forever.
  const { error } = await supabase
    .from("onboarding_question_texts")
    .upsert({
      question_key: input.questionKey,
      language: input.language,
      title: input.title.trim(),
      subtitle: input.subtitle.trim() || null,
      options: input.options.map((o) => o.trim()),
      updated_at: new Date().toISOString(),
    }, { onConflict: "question_key,language" });
  if (error) throw error;
}

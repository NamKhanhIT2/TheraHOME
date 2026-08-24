// Real Supabase queries for the Admin/CSKH surfaces, replacing the mock
// data in mockData.ts / adminMockData.ts. Same project as the mobile app
// (nyjvtvmllwbyfokldgtj) — see CLAUDE.md and TheraHOME APP/CLAUDE.md's
// Supabase schema section for the underlying tables. RLS for the
// admin/cskh-only reads and writes here comes from the
// `web admin ...`/`web admin cskh ...` policies added alongside
// `current_web_roles()` (see migrations); no react-query in this project
// yet, so callers do plain fetch-on-mount with useState/useEffect.
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Product, ProgramPhase, ProgramDay, MarketContent, StoreCategory, StoreItem, CommunityPost, CommunityComment, NotificationItem } from "./mockData";
import type {
  SampleUser,
  SampleUserRole,
  StaffMember,
  StaffRole,
  ChatThread,
  ChatMessage,
  TheraAccount,
  TheraAccountType,
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
    supabase.from("products").select("id, name, accent_color_key, total_days").order("id"),
    supabase.from("program_phases").select("id, product_id, name, day_start, day_end, sort_order").order("sort_order"),
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
      .map((ph) => ({ name: ph.name, range: [ph.day_start, ph.day_end] }));
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
      accent: accentFromKey(p.accent_color_key),
      totalDays: p.total_days,
      phases: productPhases,
      days: productDays,
      painLevels: [],
    };
  });
}

export async function createRoutineProduct(input: { name: string; category: "neck" | "back"; totalDays: number; link: string }) {
  const id = `routine-${Date.now()}`;
  const { error: prodErr } = await supabase.from("products").insert({ id, name: input.name, category: input.category, total_days: input.totalDays });
  if (prodErr) throw prodErr;

  const phases = buildPhases(input.totalDays);
  const { error: phaseErr } = await supabase.from("program_phases").insert(
    phases.map((ph, i) => ({ product_id: id, name: ph.name, day_start: ph.range[0], day_end: ph.range[1], sort_order: i }))
  );
  if (phaseErr) throw phaseErr;

  return id;
}

export async function updateProductInfo(productId: string, patch: { name?: string; link?: string }) {
  if (patch.name !== undefined) {
    const { error } = await supabase.from("products").update({ name: patch.name }).eq("id", productId);
    if (error) throw error;
  }
  if (patch.link !== undefined) {
    // Only persists if a matching store_items row already exists for this
    // product — routine products aren't required to have a storefront entry.
    await supabase.from("store_items").update({ external_link: patch.link }).eq("product_id", productId);
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

export async function deleteProgramDay(productId: string, dayNumber: number) {
  const { error } = await supabase.from("program_days").delete().eq("product_id", productId).eq("day_number", dayNumber);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Store catalog (store_categories / store_items)
// ---------------------------------------------------------------------------

export type AdminMarket = "VN" | "US" | "MALAY";

export async function fetchStoreCategories(market: AdminMarket = "VN"): Promise<StoreCategory[]> {
  const [{ data: cats, error: cErr }, { data: items, error: iErr }] = await Promise.all([
    supabase.from("store_categories").select("id, title, has_trial, sort_order, market").eq("market", market).order("sort_order"),
    supabase.from("store_items").select("id, category_id, name, description, price_text, accent_color_key, external_link, preview_url, image_url, market").eq("market", market).order("sort_order"),
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
        })
      ),
  }));
}

// ---------------------------------------------------------------------------
// Store catalog, grouped across markets (ProductsView's real shape) — a
// "product"/"category group" in Admin is up to 3 store_categories/
// store_items rows (VN/US/MALAY) sharing one group_key, edited together
// instead of one market at a time behind the old global market selector.
// See TheraHOME APP/CLAUDE.md's "Market content vs. UI language" entry.
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
  byMarket: Record<AdminMarket, StoreItemMarketFields & { itemId: string | null }>;
}

export interface StoreCategoryGroup {
  groupKey: string;
  byMarket: Record<AdminMarket, { id: string; title: string; hasTrial: boolean } | null>;
  items: StoreItemGroup[];
}

export async function fetchStoreCategoryGroups(): Promise<StoreCategoryGroup[]> {
  const [{ data: cats, error: cErr }, { data: items, error: iErr }] = await Promise.all([
    supabase.from("store_categories").select("id, title, has_trial, sort_order, market, group_key").order("sort_order"),
    supabase.from("store_items").select("id, category_id, name, description, price_text, accent_color_key, external_link, preview_url, image_url, market, group_key").order("sort_order"),
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
      return { groupKey: itemGroupKey, accent: accentFromKey(rows[0]?.accent_color_key), byMarket: itemByMarket };
    });

    return { groupKey, byMarket, items: itemGroups };
  });
}

/** Creates/updates all 3 market rows of one category group in one call —
 * `groupKey: "new"` mints a fresh group. Each market gets its own row id;
 * a market with no existing row is inserted, an existing one is updated. */
export async function saveStoreCategoryGroup(groupKey: string | "new", byMarket: Record<AdminMarket, { title: string; hasTrial: boolean }>): Promise<string> {
  const finalGroupKey = groupKey === "new" ? `group-${Date.now()}` : groupKey;
  const { data: existing, error: existingErr } = await supabase.from("store_categories").select("id, market").eq("group_key", finalGroupKey);
  if (existingErr) throw existingErr;
  const existingIdByMarket = new Map((existing ?? []).map((r) => [r.market, r.id]));

  for (const market of MARKETS) {
    const fields = byMarket[market];
    const existingId = existingIdByMarket.get(market);
    if (existingId) {
      const { error } = await supabase.from("store_categories").update({ title: fields.title, has_trial: fields.hasTrial }).eq("id", existingId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("store_categories")
        .insert({ id: `${finalGroupKey}-${market.toLowerCase()}`, title: fields.title, has_trial: fields.hasTrial, market, group_key: finalGroupKey });
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

/** Creates/updates all 3 market rows of one item group, linking each
 * market's item to that SAME market's category row within
 * `categoryGroupKey` (an item's US row must reference the US category
 * row's id, not the VN one) — throws if that market's category row
 * doesn't exist yet (the category group itself must be fully created
 * across all 3 markets first). */
export async function saveStoreItemGroup(categoryGroupKey: string, groupKey: string | "new", byMarket: Record<AdminMarket, StoreItemMarketFields>): Promise<string> {
  const finalGroupKey = groupKey === "new" ? `item-${Date.now()}` : groupKey;
  const [{ data: catRows, error: catErr }, { data: existingItems, error: existingErr }] = await Promise.all([
    supabase.from("store_categories").select("id, market").eq("group_key", categoryGroupKey),
    supabase.from("store_items").select("id, market").eq("group_key", finalGroupKey),
  ]);
  if (catErr) throw catErr;
  if (existingErr) throw existingErr;
  const categoryIdByMarket = new Map((catRows ?? []).map((r) => [r.market, r.id]));
  const existingIdByMarket = new Map((existingItems ?? []).map((r) => [r.market, r.id]));

  for (const market of MARKETS) {
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

export async function uploadStoreItemImage(itemId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("invalid_image_type");
  if (file.size > 5 * 1024 * 1024) throw new Error("image_too_large");
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension) ? extension : "jpg";
  const path = `${itemId}/${Date.now()}.${safeExtension}`;
  const { error } = await supabase.storage.from("store-images").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from("store-images").getPublicUrl(path).data.publicUrl;
}


// ---------------------------------------------------------------------------
// App users (profiles + user_programs)
// ---------------------------------------------------------------------------

export async function fetchAppUsers(): Promise<SampleUser[]> {
  const [{ data: contacts, error: cErr }, { data: profiles, error: pErr }, { data: programs, error: upErr }] = await Promise.all([
    supabase.from("user_access_contacts").select("user_id, contact_value"),
    supabase.from("profiles").select("id, full_name, email, phone, treatment_area, app_role, locked, created_at").is("deleted_at", null),
    supabase.from("user_programs").select("user_id, current_day, adherence_pct, product_id"),
  ]);
  if (cErr) throw cErr;
  if (pErr) throw pErr;
  if (upErr) throw upErr;

  const programByUser = new Map((programs ?? []).map((p) => [p.user_id, p]));
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return (contacts ?? []).flatMap((contact): SampleUser[] => {
    const p = profileById.get(contact.user_id);
    if (!p) return [];
    const program = programByUser.get(p.id);
    return [{
      id: p.id,
      name: p.full_name || p.email || "Người dùng",
      contact: contact.contact_value,
      area: p.treatment_area || "Chưa cập nhật",
      day: program?.current_day ?? 0,
      adherence: program ? Math.round(Number(program.adherence_pct)) : 0,
      status: program ? "active" : "inactive",
      joined: new Date(p.created_at).toLocaleDateString("vi-VN"),
      role: p.app_role as SampleUserRole,
      locked: p.locked,
    }];
  });
}

export async function updateAppUser(id: string, patch: { app_role?: SampleUserRole; locked?: boolean }) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

export async function fetchUserPainTrend(id: string): Promise<number[]> {
  const { data, error } = await supabase.from("pain_logs").select("score, logged_at").eq("user_id", id).order("logged_at", { ascending: false }).limit(7);
  if (error) throw error;
  return (data ?? []).map((r) => r.score).reverse();
}

// ---------------------------------------------------------------------------
// Staff / internal accounts (web_access_contacts)
// ---------------------------------------------------------------------------

export async function fetchStaff(): Promise<StaffMember[]> {
  const { data, error } = await supabase.from("web_access_contacts").select("id, email, phone, roles, disabled, created_at").order("created_at");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.email ?? r.phone ?? "—",
    email: r.email ?? r.phone ?? "—",
    role: (r.roles?.includes("admin") ? "admin" : "care") as StaffRole,
    status: r.disabled ? "disabled" : "active",
    joined: new Date(r.created_at).toLocaleDateString("vi-VN"),
  }));
}

export async function createStaffContact(input: { name: string; email: string; role: StaffRole }) {
  const roles = input.role === "admin" ? ["admin"] : ["cskh"];
  const { error } = await supabase.from("web_access_contacts").insert({ email: input.email, roles });
  if (error) throw error;
}

export async function toggleStaffDisabled(id: string, disabled: boolean) {
  const { error } = await supabase.from("web_access_contacts").update({ disabled }).eq("id", id);
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
    .select("id, username, full_name, account_type, access_level, locked, expires_at, onboarding_completed, created_at, last_login_at, notes")
    .neq("account_type", "normal")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r): TheraAccount => ({
    id: r.id,
    username: r.username ?? "",
    fullName: r.full_name ?? "",
    accountType: r.account_type as TheraAccountType,
    accessLevel: r.access_level as TheraAccessLevel,
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
    expires_at: string | null;
    locked: boolean;
    notes: string | null;
  }>
) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

export interface CreateTheraAccountInput {
  username: string;
  password: string;
  full_name: string;
  account_type: TheraAccountType;
  access_level: TheraAccessLevel;
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

export async function fetchCommunityPosts(): Promise<(CommunityPost & { pinned: boolean; hidden: boolean; imageUrl: string | null; pinnedDisplay: PinnedDisplay })[]> {
  const [{ data: posts, error: postErr }, { data: comments, error: commentErr }] = await Promise.all([
    supabase
      .from("community_posts")
      .select("id, is_official, author_name, title, tag, text, image_url, likes_count, comments_count, pinned, hidden, pinned_title, pinned_content, pinned_thumbnail_url")
      .order("created_at", { ascending: false }),
    supabase.from("post_comments").select("id, post_id, author_name, text, created_at, hidden").order("created_at"),
  ]);
  if (postErr) throw postErr;
  if (commentErr) throw commentErr;

  return (posts ?? []).map(
    (p): CommunityPost & { pinned: boolean; hidden: boolean; imageUrl: string | null; pinnedDisplay: PinnedDisplay } => ({
      id: p.id,
      official: p.is_official,
      name: p.author_name || "TheraHOME",
      meta: p.tag ?? undefined,
      title: p.title ?? undefined,
      text: p.text,
      imageUrl: p.image_url,
      likes: p.likes_count,
      comments: p.comments_count,
      pinned: p.pinned,
      hidden: p.hidden,
      pinnedDisplay: { title: p.pinned_title, content: p.pinned_content, thumbnailUrl: p.pinned_thumbnail_url },
      commentsList: (comments ?? [])
        .filter((c) => c.post_id === p.id)
        .map((c): CommunityComment => ({ name: c.author_name || "Người dùng", text: c.text, time: new Date(c.created_at).toLocaleDateString("vi-VN"), idKey: c.id })),
    })
  );
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
}) {
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
    void supabase.functions.invoke("dispatch-push", {
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
  }
}
export async function updateCommunityPost(idKey: string, patch: { meta?: string; title?: string; text?: string; pinned?: boolean; hidden?: boolean }) {
  const { error } = await supabase
    .from("community_posts")
    .update({ tag: patch.meta, title: patch.title, text: patch.text, pinned: patch.pinned, hidden: patch.hidden })
    .eq("id", idKey);
  if (error) throw error;
}
export async function setOfficialPostPinned(idKey: string, pinned: boolean, display?: { title: string; content: string; thumbnailUrl: string | null }) {
  const { error } = await supabase.rpc("set_official_post_pinned", {
    p_post_id: idKey,
    p_pinned: pinned,
    p_title: display?.title ?? null,
    p_content: display?.content ?? null,
    p_thumbnail_url: display?.thumbnailUrl ?? null,
  });
  if (error) throw error;
}

// Reuses the `community-images` bucket the mobile app already uploads post
// photos into (see TheraHOME APP/CLAUDE.md) rather than a new bucket — its
// RLS (`(storage.foldername(name))[1] = auth.uid()`, public reads) already
// permits any authenticated user, including a signed-in admin/cskh account,
// to write under their own uid, so no policy change was needed.
export async function uploadPostThumbnail(postId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("invalid_image_type");
  if (file.size > 5 * 1024 * 1024) throw new Error("image_too_large");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not_signed_in");
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension) ? extension : "jpg";
  const path = `${user.id}/pinned-${postId}-${Date.now()}.${safeExtension}`;
  const { error } = await supabase.storage.from("community-images").upload(path, file, {
    contentType: file.type || "image/jpeg",
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
// and comments. See TheraHOME APP's community_moderation_and_notifications
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
// case — see TheraHOME APP/CLAUDE.md.
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
  const { error } = await supabase.from("upsell_campaigns").update({ status: "cancelled" }).eq("id", id).eq("status", "scheduled");
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Chat (chat_threads / chat_messages) — CSKH specialist reply path
// ---------------------------------------------------------------------------

export async function fetchChatThreads(): Promise<ChatThread[]> {
  const [{ data: threads, error: tErr }, { data: messages, error: mErr }, { data: profiles, error: pErr }, { data: reactions, error: rErr }] = await Promise.all([
    supabase.from("chat_threads").select("id, user_id, created_at").eq("kind", "human").order("created_at", { ascending: false }),
    supabase.from("chat_messages").select("id, thread_id, sender_type, body, created_at, attachment_path, read_at, edited_at, deleted_at, reply_to_message_id").order("created_at"),
    supabase.from("profiles").select("id, full_name, email"),
    supabase.from("chat_message_reactions").select("id, message_id, user_id, emoji"),
  ]);
  if (tErr) throw tErr;
  if (mErr) throw mErr;
  if (pErr) throw pErr;
  if (rErr) throw rErr;

  const nameByUser = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email || "Người dùng"]));

  return Promise.all((threads ?? []).map(async (t) => {
    const msgs = (messages ?? []).filter((m) => m.thread_id === t.id);
    const chatMessages: ChatMessage[] = await Promise.all(msgs.map(async (m) => {
      let imageUrl: string | null = null;
      if (m.attachment_path) {
        const { data: signed } = await supabase.storage.from("chat-attachments").createSignedUrl(m.attachment_path, 3600);
        imageUrl = signed?.signedUrl ?? null;
      }
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
  void supabase.functions.invoke("dispatch-push", { body: { mode: "chat", threadId, senderType: "specialist", preview: text || "Đã gửi một ảnh" } });
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
  const { error } = await supabase
    .from("ai_prompts")
    .update({ system_prompt: systemPrompt, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
    .eq("id", true);
  if (error) throw error;
}

export interface AISuggestedReply {
  id: string;
  text: string;
  sortOrder: number;
}

export async function fetchAISuggestedReplies(): Promise<AISuggestedReply[]> {
  const { data, error } = await supabase.from("ai_suggested_replies").select("id, text, sort_order").order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, text: r.text, sortOrder: r.sort_order }));
}

export async function addAISuggestedReply(text: string, sortOrder: number) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("ai_suggested_replies").insert({ text, sort_order: sortOrder, created_by: user?.id ?? null });
  if (error) throw error;
}

export async function deleteAISuggestedReply(id: string) {
  const { error } = await supabase.from("ai_suggested_replies").delete().eq("id", id);
  if (error) throw error;
}

// Nội dung website — the marketing copy an admin can change without a deploy.
//
// Table: public.site_content (key text, value jsonb). Public read, admin
// write; the migration is
// TheraHOME-APP/supabase/migrations/202609160900_site_content.sql.
//
// Only the parts that actually change live here: prices, the promo line, the
// headline stats, the FAQ, contact details, social and store links. Structural
// copy — hero headlines, section prose, the pillars — stays in the page, where
// it belongs: it is written to fit a layout, not typed into a form.
//
// DEFAULTS are the exact strings the pages shipped with, and they are the
// fallback whenever the table cannot be read. That matters more than it looks:
// a marketing page must render even if Supabase is unreachable, and it must
// render the real price rather than an empty gap.
import { cache } from "react";
import { supabase } from "./supabase";

export interface Pricing { current: string; original: string; note: string; ratingLine: string }
export interface HeroStat { value: string; label: string }
export interface ResultStat { stat: string; body: string }
export interface FaqItem { q: string; a: string }
export interface Contact { address: string; phone: string; phoneHref: string; email: string; hours: string }
export interface Social { facebook: string; youtube: string }
export interface AppLinks { appStore: string; playStore: string }

export interface SiteContent {
  pricing: Pricing;
  stats_hero: HeroStat[];
  stats_results: ResultStat[];
  faq: FaqItem[];
  contact: Contact;
  social: Social;
  app_links: AppLinks;
}

export const DEFAULT_SITE_CONTENT: SiteContent = {
  pricing: { current: "990.000₫", original: "1.690.000₫", note: "Giảm 41% cho người mới", ratingLine: "4.8/5 — 1.186 đánh giá" },
  stats_hero: [
    { value: "+10.000", label: "khách hàng Việt Nam" },
    { value: "4.8/5", label: "1.186 đánh giá" },
    { value: "14 ngày", label: "lộ trình cá nhân hoá" },
  ],
  stats_results: [
    { stat: "93%", body: "Người dùng cho biết đã giảm đau cổ ngay từ buổi đầu tiên." },
    { stat: "91%", body: "Người dùng đã hoàn toàn hết đau cổ sau lộ trình 14 ngày do AI thiết lập, mỗi ngày chỉ 15–20 phút." },
    { stat: "88%", body: "Người dùng đã cải thiện được các triệu chứng đi kèm như tê tay, châm chích, đau đầu." },
    { stat: "79%", body: "Người dùng đã thoát khỏi vùng có nguy cơ phải phẫu thuật." },
  ],
  faq: [
    { q: "Tôi không rành công nghệ, có dùng được không?", a: "Có. TheraNECK + TheraAI dễ dùng, trực quan, có hướng dẫn bằng video và đội ngũ chăm sóc khách hàng đồng hành suốt lộ trình." },
    { q: "Tôi đau lâu năm rồi, có phù hợp không?", a: "Nhiều người đau kéo dài không thiếu cố gắng, mà thiếu một lộ trình rõ ràng và đúng hơn với cơ thể mình." },
    { q: "Bao lâu thì tôi bắt đầu thấy khác đi?", a: "Mỗi người sẽ khác nhau. Có người thấy dễ chịu hơn từ những ngày đầu, có người cần thêm thời gian." },
    { q: "Nếu không phù hợp thì sao?", a: "Bạn có 14 ngày trải nghiệm để tự cảm nhận mức độ phù hợp. Nếu không hài lòng, bạn có thể yêu cầu hoàn trả." },
    { q: "Chống chỉ định với ai?", a: "Chống chỉ định với người đặt máy tim nhân tạo. Người mới phẫu thuật cột sống cổ cần tham khảo ý kiến bác sĩ trước khi dùng." },
    { q: "TheraHome có bán ở Shopee hay TikTok không?", a: "Chúng tôi tạm thời không kinh doanh ở TikTok và Shopee vì phí sàn 30% quá cao. Chúng tôi dành phần đó cho sản phẩm và dịch vụ chăm sóc." },
  ],
  contact: {
    address: "Tầng 11, toà RoxCenter, số 136 Hồ Tùng Mậu, Phú Diễn, Hà Nội",
    phone: "0364.263.552",
    phoneHref: "tel:+84364263552",
    email: "support@therahomeai.com",
    hours: "Thứ Hai – Thứ Sáu, 9:00 – 17:00",
  },
  social: { facebook: "https://www.facebook.com/profile.php?id=61580995314862", youtube: "https://www.youtube.com/@bacsilong1974" },
  app_links: { appStore: "https://apps.apple.com/", playStore: "https://play.google.com/store/apps/details?id=ai.therahome" },
};

/** Merge a stored row over its default. A key the admin has never saved, or a
 * row that is the wrong shape, falls back to the shipped value rather than
 * blanking the page — per key, so one bad row cannot take the others with it. */
function mergeRow<K extends keyof SiteContent>(key: K, value: unknown): SiteContent[K] {
  const fallback = DEFAULT_SITE_CONTENT[key];
  if (Array.isArray(fallback)) {
    return (Array.isArray(value) && value.length ? value : fallback) as SiteContent[K];
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...fallback, ...(value as object) } as SiteContent[K];
  }
  return fallback;
}

export async function fetchSiteContent(): Promise<SiteContent> {
  const { data, error } = await supabase.from("site_content").select("key, value");
  if (error) {
    // Never throw: a marketing page that cannot reach the database must still
    // render, with the strings it was built with.
    console.error("Unable to read site_content — falling back to built-in copy", error);
    return DEFAULT_SITE_CONTENT;
  }
  const byKey = new Map((data ?? []).map((r) => [r.key, r.value]));
  const out = { ...DEFAULT_SITE_CONTENT };
  for (const key of Object.keys(DEFAULT_SITE_CONTENT) as (keyof SiteContent)[]) {
    if (byKey.has(key)) {
      // @ts-expect-error — key is a valid key of both sides; the generic index
      // is what TypeScript cannot follow through the loop.
      out[key] = mergeRow(key, byKey.get(key));
    }
  }
  return out;
}

/** For server components. React's `cache` dedupes it per request, so the
 * layout and the page it renders share one round trip. */
export const getSiteContent = cache(fetchSiteContent);

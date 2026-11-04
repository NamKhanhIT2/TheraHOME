import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/* Lớp đọc D1. Chỉ có SELECT — bản dự phòng này không bao giờ ghi từ web,
 * dữ liệu chỉ đi vào qua scripts/dong-bo.mjs. (04/11/2026) */

export type SanPham = {
  id: string;
  name: string;
  total_days: number;
};

export type GiaiDoan = {
  id: string;
  name: string;
  day_start: number;
  day_end: number;
  sort_order: number;
};

export type NgayTap = {
  day_number: number;
  title: string | null;
  day_type: string;
  video_url: string | null;
  support_tools_label: string | null;
  support_tools_url: string | null;
  phase_id: string | null;
};

async function db() {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

export async function laySanPham(): Promise<SanPham | null> {
  const r = await (await db())
    .prepare("SELECT id, name, total_days FROM products ORDER BY id LIMIT 1")
    .first<SanPham>();
  return r ?? null;
}

export async function layGiaiDoan(productId: string): Promise<GiaiDoan[]> {
  const r = await (await db())
    .prepare(
      "SELECT id, name, day_start, day_end, sort_order FROM program_phases WHERE product_id = ? ORDER BY sort_order",
    )
    .bind(productId)
    .all<GiaiDoan>();
  return r.results ?? [];
}

export async function layCacNgay(productId: string): Promise<NgayTap[]> {
  const r = await (await db())
    .prepare(
      "SELECT day_number, title, day_type, video_url, support_tools_label, support_tools_url, phase_id FROM program_days WHERE product_id = ? ORDER BY day_number",
    )
    .bind(productId)
    .all<NgayTap>();
  return r.results ?? [];
}

export async function layMotNgay(soNgay: number): Promise<NgayTap | null> {
  const r = await (await db())
    .prepare(
      "SELECT day_number, title, day_type, video_url, support_tools_label, support_tools_url, phase_id FROM program_days WHERE day_number = ? LIMIT 1",
    )
    .bind(soNgay)
    .first<NgayTap>();
  return r ?? null;
}

/** Lần đồng bộ gần nhất, để nói thẳng với người đọc nội dung cũ tới mức nào. */
export async function layLanDongBo(): Promise<string | null> {
  const r = await (await db())
    .prepare("SELECT chay_luc FROM dong_bo_log ORDER BY id DESC LIMIT 1")
    .first<{ chay_luc: string }>();
  return r?.chay_luc ?? null;
}

/** youtu.be/XXXX hoặc youtube.com/watch?v=XXXX -> mã video. */
export function maYouTube(url: string | null): string | null {
  if (!url) return null;
  const m =
    url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/) ??
    url.match(/[?&]v=([A-Za-z0-9_-]{6,})/) ??
    url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

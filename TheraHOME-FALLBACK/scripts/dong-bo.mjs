/**
 * Đồng bộ MỘT CHIỀU: Supabase (public) -> Cloudflare D1.
 *
 * Chỉ chép nội dung lộ trình (sản phẩm, giai đoạn, ngày tập + link video).
 * Không chép bất cứ thứ gì thuộc về một người dùng cụ thể — xem db/schema.sql.
 *
 * Chạy:  npm run dong-bo          (ghi vào D1 thật)
 *        npm run dong-bo:local    (ghi vào D1 local của wrangler dev)
 *
 * Cần .env.local có SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY (hoặc anon key —
 * mấy bảng này đều cho đọc công khai, nên anon là đủ và an toàn hơn).
 *
 * Cách ghi: sinh một file .sql rồi gọi `wrangler d1 execute`. Dài dòng hơn gọi
 * HTTP API, nhưng đổi lại không phải giữ thêm API token nào ngoài thứ wrangler
 * đã đăng nhập sẵn, và khi lỗi thì nhìn thẳng vào file SQL là biết vì sao.
 * (04/11/2026)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
const LOCAL = process.argv.includes('--local');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY trong .env.local');
  process.exit(1);
}

/** Nháy nháy chuỗi cho SQLite. null -> NULL. */
function q(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function lay(bang, cot) {
  const url = `${SUPABASE_URL}/rest/v1/${bang}?select=${encodeURIComponent(cot)}`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`Đọc ${bang} thất bại: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

const products = await lay('products', 'id,name,category,total_days,accent_color_key');
const tatCaGiaiDoan = await lay('program_phases', 'id,product_id,name,day_start,day_end,sort_order');
const tatCaNgay = await lay(
  'program_days',
  'id,product_id,phase_id,day_number,day_type,video_url_vn,support_tools_label_vn,support_tools_url_vn',
);

// Giai đoạn có apple_product_id hoặc google_product_id là nội dung khách mua
// thêm trong app (giai đoạn 3 của TheraNECK+, ngày 15–28). Trang dự phòng
// không có đăng nhập nên không biết ai đã mua — chép sang đây là phát không
// thứ đang bán. Lọc ngay từ khâu đồng bộ, để nó không nằm trong D1.
// Đọc phase_promos hỏng thì `lay` ném lỗi, cả lần đồng bộ dừng, D1 giữ
// nguyên. Cố ý. (04/11/2026)
const promos = await lay('phase_promos', 'phase_id,apple_product_id,google_product_id');
const phaiTra = new Set(
  promos.filter((k) => k.apple_product_id || k.google_product_id).map((k) => k.phase_id),
);
const phases = tatCaGiaiDoan.filter((f) => !phaiTra.has(f.id));
const moCua = new Set(phases.map((f) => f.id));
// Ngày không gắn giai đoạn thì không biết có bị khoá hay không — bỏ qua.
const days = tatCaNgay.filter((d) => d.phase_id && moCua.has(d.phase_id));

if (phaiTra.size) {
  console.log(`Bỏ qua ${phaiTra.size} giai đoạn trả phí (${tatCaNgay.length - days.length} ngày).`);
}

if (!products.length || !days.length) {
  // Thà dừng còn hơn xoá sạch D1 rồi chèn rỗng: nếu Supabase đang bị khoá thì
  // REST trả 2xx với mảng rỗng chứ không phải lỗi, và bản sao dự phòng sẽ bị
  // chính lần đồng bộ này xoá trắng — đúng lúc cần nó nhất.
  console.error(`Dừng: Supabase trả về ${products.length} sản phẩm, ${days.length} ngày. Không ghi đè D1.`);
  process.exit(1);
}

// D1 từ chối BEGIN TRANSACTION/COMMIT (nó muốn ta dùng API transaction của
// Durable Objects). Không cần: `wrangler d1 execute --file` đã chạy cả file
// như một khối, hỏng giữa chừng thì DB tự quay về trạng thái cũ. (04/11/2026)
// Tên bài nằm trên YouTube chứ không nằm trong Supabase. Hỏi oEmbed một lần
// cho mỗi ngày lúc đồng bộ; hỏng cái nào thì để trống chứ không làm hỏng cả
// lần đồng bộ — không có tên vẫn xem được video.
async function tieuDe(url) {
  if (!url) return null;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    return (await res.json()).title ?? null;
  } catch {
    return null;
  }
}

const ten = new Map();
for (const d of days) ten.set(d.id, await tieuDe(d.video_url_vn));
console.log(`Lấy được ${[...ten.values()].filter(Boolean).length}/${days.length} tên bài từ YouTube.`);

const sql = [];
sql.push('DELETE FROM program_days;');
sql.push('DELETE FROM program_phases;');
sql.push('DELETE FROM products;');

for (const p of products) {
  sql.push(
    `INSERT INTO products (id,name,category,total_days,accent_color_key) VALUES (${q(p.id)},${q(p.name)},${q(p.category)},${Number(p.total_days) || 0},${q(p.accent_color_key)});`,
  );
}
for (const f of phases) {
  sql.push(
    `INSERT INTO program_phases (id,product_id,name,day_start,day_end,sort_order) VALUES (${q(f.id)},${q(f.product_id)},${q(f.name)},${Number(f.day_start)},${Number(f.day_end)},${Number(f.sort_order)});`,
  );
}
for (const d of days) {
  sql.push(
    `INSERT INTO program_days (id,product_id,phase_id,day_number,day_type,title,video_url,support_tools_label,support_tools_url) VALUES (${q(d.id)},${q(d.product_id)},${q(d.phase_id)},${Number(d.day_number)},${q(d.day_type)},${q(ten.get(d.id))},${q(d.video_url_vn)},${q(d.support_tools_label_vn)},${q(d.support_tools_url_vn)});`,
  );
}
sql.push(
  `INSERT INTO dong_bo_log (chay_luc,so_ngay,so_giai_doan) VALUES (${q(new Date().toISOString())},${days.length},${phases.length});`,
);

const duong_dan = join(tmpdir(), `therahome-dong-bo-${Date.now()}.sql`);
mkdirSync(tmpdir(), { recursive: true });
writeFileSync(duong_dan, sql.join('\n'), 'utf8');

console.log(`Đọc xong Supabase: ${products.length} sản phẩm, ${phases.length} giai đoạn, ${days.length} ngày.`);
console.log(`Đang ghi vào D1 (${LOCAL ? 'local' : 'remote'})…`);

execFileSync(
  'npx',
  ['wrangler', 'd1', 'execute', 'therahome-duphong', LOCAL ? '--local' : '--remote', '--file', duong_dan, '--yes'],
  { stdio: 'inherit' },
);

console.log('Đồng bộ xong.');

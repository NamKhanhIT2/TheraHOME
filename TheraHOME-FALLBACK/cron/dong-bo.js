/**
 * Đồng bộ một chiều Supabase -> D1, chạy theo lịch.
 *
 * Cùng việc với scripts/dong-bo.mjs nhưng chạy trên Cloudflare thay vì máy
 * Hoan, để bản dự phòng tự cập nhật mà không cần ai nhớ. Script kia vẫn giữ
 * để chạy tay khi vừa sửa nội dung và muốn thấy ngay.
 *
 * Secret cần đặt:  npx wrangler secret put SUPABASE_ANON_KEY --config cron/wrangler.jsonc
 */

async function layBang(env, bang, cot) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${bang}?select=${encodeURIComponent(cot)}`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`Đọc ${bang} thất bại: ${res.status} ${await res.text()}`);
  return res.json();
}

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

export async function dongBo(env) {
  const products = await layBang(env, 'products', 'id,name,category,total_days,accent_color_key');
  const tatCaGiaiDoan = await layBang(env, 'program_phases', 'id,product_id,name,day_start,day_end,sort_order');
  const tatCaNgay = await layBang(
    env,
    'program_days',
    'id,product_id,phase_id,day_number,day_type,video_url_vn,support_tools_label_vn,support_tools_url_vn',
  );

  // Giai đoạn nào có apple_product_id hoặc google_product_id thì đó là nội
  // dung khách phải mua thêm trong app (giai đoạn 3 của TheraNECK+, ngày
  // 15–28). Trang dự phòng không có đăng nhập, không biết ai đã mua, nên
  // chép nó sang đây là đem bán thành cho không. Lọc ngay từ khâu đồng bộ
  // để nó không nằm trong D1 chứ không chỉ ẩn lúc hiển thị.
  //
  // Đọc phase_promos hỏng thì layBang ném lỗi và cả lần đồng bộ dừng — D1 giữ
  // nguyên. Cố ý: thà bản dự phòng cũ còn hơn lỡ phát nội dung trả phí.
  // (04/11/2026)
  const promos = await layBang(env, 'phase_promos', 'phase_id,apple_product_id,google_product_id');
  const phaiTra = new Set(
    promos.filter((k) => k.apple_product_id || k.google_product_id).map((k) => k.phase_id),
  );
  const phases = tatCaGiaiDoan.filter((f) => !phaiTra.has(f.id));
  const moCua = new Set(phases.map((f) => f.id));
  // Ngày không gắn giai đoạn nào thì không biết nó có bị khoá hay không —
  // bỏ qua, cùng một lý do.
  const days = tatCaNgay.filter((d) => d.phase_id && moCua.has(d.phase_id));

  // Giống script chạy tay: Supabase bị khoá thì REST trả 200 với mảng rỗng chứ
  // không phải lỗi. Ghi đè lúc đó là tự tay xoá bản dự phòng đúng lúc cần nó.
  if (!products.length || !days.length) {
    throw new Error(`Supabase trả ${products.length} sản phẩm / ${days.length} ngày mở — không ghi đè D1.`);
  }

  const ten = new Map();
  for (const d of days) ten.set(d.id, await tieuDe(d.video_url_vn));

  const lenh = [
    env.DB.prepare('DELETE FROM program_days'),
    env.DB.prepare('DELETE FROM program_phases'),
    env.DB.prepare('DELETE FROM products'),
  ];
  for (const p of products) {
    lenh.push(
      env.DB.prepare('INSERT INTO products (id,name,category,total_days,accent_color_key) VALUES (?,?,?,?,?)').bind(
        p.id, p.name, p.category ?? null, Number(p.total_days) || 0, p.accent_color_key ?? null,
      ),
    );
  }
  for (const f of phases) {
    lenh.push(
      env.DB.prepare('INSERT INTO program_phases (id,product_id,name,day_start,day_end,sort_order) VALUES (?,?,?,?,?,?)').bind(
        f.id, f.product_id, f.name, Number(f.day_start), Number(f.day_end), Number(f.sort_order),
      ),
    );
  }
  for (const d of days) {
    lenh.push(
      env.DB.prepare(
        'INSERT INTO program_days (id,product_id,phase_id,day_number,day_type,title,video_url,support_tools_label,support_tools_url) VALUES (?,?,?,?,?,?,?,?,?)',
      ).bind(
        d.id, d.product_id, d.phase_id ?? null, Number(d.day_number), d.day_type,
        ten.get(d.id) ?? null, d.video_url_vn ?? null,
        d.support_tools_label_vn ?? null, d.support_tools_url_vn ?? null,
      ),
    );
  }
  lenh.push(
    env.DB.prepare('INSERT INTO dong_bo_log (chay_luc,so_ngay,so_giai_doan) VALUES (?,?,?)').bind(
      new Date().toISOString(), days.length, phases.length,
    ),
  );

  // d1.batch chạy cả mẻ trong một transaction ngầm: hỏng giữa chừng thì không
  // có gì được ghi, nên bản dự phòng không bao giờ ở trạng thái chép dở.
  await env.DB.batch(lenh);
  return { products: products.length, phases: phases.length, days: days.length };
}

const worker = {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      dongBo(env).then(
        (k) => console.log(`Đồng bộ xong: ${k.products} sản phẩm, ${k.phases} giai đoạn, ${k.days} ngày.`),
        (e) => { console.error('Đồng bộ lỗi:', e.message); throw e; },
      ),
    );
  },
};

export default worker;

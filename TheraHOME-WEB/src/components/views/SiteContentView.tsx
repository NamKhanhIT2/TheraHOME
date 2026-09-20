"use client";

// Nội dung website — the marketing copy on therahomeai.com's public pages.
//
// Real data: the `site_content` table. Before this, changing a price or an FAQ
// answer meant editing TSX and redeploying; saving here shows up on the public
// pages within about a minute (the (public) layout revalidates every 60s).
//
// Deliberately NOT everything on those pages. Headlines, section prose and the
// pillar cards stay in code: they are written to fit a specific layout, and a
// form that lets someone paste three paragraphs into a one-line hero would
// break the page silently. What is here is what actually changes — price,
// promo line, the headline numbers, the FAQ, contact details, links.
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { SectionCard, PrimaryBtn, GhostBtn, FieldLabel, inputStyle } from "@/components/ui/primitives";
import { pushToast } from "@/components/ui/Toast";
import { fetchSiteContentRows, saveSiteContentRows } from "@/lib/db";
import type { SiteContent } from "@/lib/siteContent";

const grid2: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 };
const rowBox: CSSProperties = { display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 12, border: "1px solid var(--border-subtle, #e3e8ee)", background: "var(--bg-card-alt, #f7f9fb)" };
const areaStyle: CSSProperties = { ...inputStyle, minHeight: 78, resize: "vertical", lineHeight: 1.55 };
const hint: CSSProperties = { margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--text-muted, #7b8794)" };

export function SiteContentView() {
  const [c, setC] = useState<SiteContent | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSiteContentRows()
      .then(setC)
      .catch(() => pushToast("Không thể tải nội dung website"));
  }, []);

  if (!c) return <p style={{ color: "var(--text-muted, #7b8794)" }}>Đang tải nội dung website...</p>;

  /** Every editor below writes through this, so the form always holds the
   * whole document and Lưu sends exactly what is on screen. */
  function set<K extends keyof SiteContent>(key: K, value: SiteContent[K]) {
    setC((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!c || saving) return;
    setSaving(true);
    try {
      await saveSiteContentRows(c);
      pushToast("Đã lưu. Trang web cập nhật trong khoảng 1 phút.");
    } catch (e) {
      console.error("Unable to save site content", e);
      pushToast("Lưu không thành công, vui lòng thử lại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <p style={hint}>
        Nội dung hiển thị trên trang giới thiệu công khai (Trang chủ, Sản phẩm, App, Về chúng tôi). Lưu xong,
        trang web tự cập nhật trong khoảng 1 phút — không cần deploy lại. Để trống một ô thì trang sẽ dùng lại
        nội dung mặc định đi kèm mã nguồn.
      </p>

      <SectionCard title="Giá & khuyến mãi (trang Sản phẩm)">
        <div style={grid2}>
          <div>
            <FieldLabel>Giá đang bán</FieldLabel>
            <input style={inputStyle} value={c.pricing.current} onChange={(e) => set("pricing", { ...c.pricing, current: e.target.value })} placeholder="990.000₫" />
          </div>
          <div>
            <FieldLabel>Giá gạch ngang</FieldLabel>
            <input style={inputStyle} value={c.pricing.original} onChange={(e) => set("pricing", { ...c.pricing, original: e.target.value })} placeholder="1.690.000₫" />
          </div>
          <div>
            <FieldLabel>Nhãn khuyến mãi</FieldLabel>
            <input style={inputStyle} value={c.pricing.note} onChange={(e) => set("pricing", { ...c.pricing, note: e.target.value })} placeholder="Giảm 41% cho người mới" />
          </div>
          <div>
            <FieldLabel>Dòng đánh giá</FieldLabel>
            <input style={inputStyle} value={c.pricing.ratingLine} onChange={(e) => set("pricing", { ...c.pricing, ratingLine: e.target.value })} placeholder="4.8/5 — 1.186 đánh giá" />
          </div>
        </div>
        <p style={hint}>Gõ cả ký tự ₫ và dấu chấm hàng nghìn — trang hiển thị đúng như bạn nhập.</p>
      </SectionCard>

      <SectionCard title="Gói combo (trang Sản phẩm)">
        <div style={grid2}>
          <div>
            <FieldLabel>Tên gói</FieldLabel>
            <input style={inputStyle} value={c.pricing.comboName} onChange={(e) => set("pricing", { ...c.pricing, comboName: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Giá đang bán</FieldLabel>
            <input style={inputStyle} value={c.pricing.comboCurrent} onChange={(e) => set("pricing", { ...c.pricing, comboCurrent: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Giá gạch ngang</FieldLabel>
            <input style={inputStyle} value={c.pricing.comboOriginal} onChange={(e) => set("pricing", { ...c.pricing, comboOriginal: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Nhãn ưu đãi</FieldLabel>
            <input style={inputStyle} value={c.pricing.comboNote} onChange={(e) => set("pricing", { ...c.pricing, comboNote: e.target.value })} />
          </div>
        </div>
        <div>
          <FieldLabel>Mô tả thêm so với gói cơ bản</FieldLabel>
          <input style={inputStyle} value={c.pricing.comboDesc} onChange={(e) => set("pricing", { ...c.pricing, comboDesc: e.target.value })} />
        </div>
      </SectionCard>

      <SectionCard title="Link thanh toán (nút Mua ngay)">
        <div>
          <FieldLabel>Gói cơ bản</FieldLabel>
          <input style={inputStyle} value={c.buy.solo} onChange={(e) => set("buy", { ...c.buy, solo: e.target.value })} />
        </div>
        <div>
          <FieldLabel>Gói combo</FieldLabel>
          <input style={inputStyle} value={c.buy.combo} onChange={(e) => set("buy", { ...c.buy, combo: e.target.value })} />
        </div>
        <p style={hint}>
          Đây là <strong>link giỏ hàng Shopify</strong> dạng <code>/cart/&lt;mã biến thể&gt;:&lt;số lượng&gt;</code>. Nó dẫn thẳng vào
          đúng cổng thanh toán của cửa hàng nhưng luôn tạo giỏ mới, nên không hết hạn. Đừng dán link dạng
          <code> /checkouts/cn/…</code> — đó là phiên thanh toán của một giỏ cụ thể, mỗi lần mở lại sinh mã khác.
          Đổi sản phẩm thì lấy mã biến thể mới tại <code>therahomeai.com/products/&lt;tên&gt;.js</code>.
        </p>
      </SectionCard>

      <SectionCard title="Ba con số ở đầu Trang chủ">
        {c.stats_hero.map((s, i) => (
          <div key={i} style={{ ...grid2, marginBottom: 10 }}>
            <div>
              <FieldLabel>Con số {i + 1}</FieldLabel>
              <input style={inputStyle} value={s.value} onChange={(e) => set("stats_hero", c.stats_hero.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
            </div>
            <div>
              <FieldLabel>Chú thích {i + 1}</FieldLabel>
              <input style={inputStyle} value={s.label} onChange={(e) => set("stats_hero", c.stats_hero.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            </div>
          </div>
        ))}
        <p style={hint}>Đúng ba ô — bố cục trang chủ chia ba cột, thêm hoặc bớt sẽ vỡ hàng.</p>
      </SectionCard>

      <SectionCard title="Bốn số liệu hiệu quả (Trang chủ + Sản phẩm)">
        {c.stats_results.map((s, i) => (
          <div key={i} style={{ ...rowBox, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ flex: "0 0 110px" }}>
                <FieldLabel>Số liệu</FieldLabel>
                <input style={inputStyle} value={s.stat} onChange={(e) => set("stats_results", c.stats_results.map((x, j) => (j === i ? { ...x, stat: e.target.value } : x)))} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FieldLabel>Diễn giải</FieldLabel>
                <textarea style={areaStyle} value={s.body} onChange={(e) => set("stats_results", c.stats_results.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
              </div>
            </div>
          </div>
        ))}
        <p style={hint}>Bốn khối này hiện ở cả Trang chủ và trang Sản phẩm — sửa một lần, đổi cả hai nơi.</p>
      </SectionCard>

      <SectionCard
        title="Câu hỏi thường gặp (trang Sản phẩm)"
        action={<GhostBtn onClick={() => set("faq", [...c.faq, { q: "", a: "" }])}>+ Thêm câu hỏi</GhostBtn>}
      >
        {c.faq.map((f, i) => (
          <div key={i} style={{ ...rowBox, marginBottom: 10 }}>
            <div>
              <FieldLabel>Câu hỏi {i + 1}</FieldLabel>
              <input style={inputStyle} value={f.q} onChange={(e) => set("faq", c.faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
            </div>
            <div>
              <FieldLabel>Trả lời</FieldLabel>
              <textarea style={areaStyle} value={f.a} onChange={(e) => set("faq", c.faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <GhostBtn color="var(--color-error, #d64545)" onClick={() => set("faq", c.faq.filter((_, j) => j !== i))}>Xoá câu này</GhostBtn>
            </div>
          </div>
        ))}
        <p style={hint}>
          Đây là FAQ của trang web bán hàng. FAQ trong app là mục riêng — Nội dung ứng dụng → Câu hỏi thường gặp.
        </p>
      </SectionCard>

      <SectionCard title="Thông tin liên hệ (chân trang + Về chúng tôi)">
        <div>
          <FieldLabel>Địa chỉ</FieldLabel>
          <input style={inputStyle} value={c.contact.address} onChange={(e) => set("contact", { ...c.contact, address: e.target.value })} />
        </div>
        <div style={grid2}>
          <div>
            <FieldLabel>Điện thoại (hiển thị)</FieldLabel>
            <input style={inputStyle} value={c.contact.phone} onChange={(e) => set("contact", { ...c.contact, phone: e.target.value })} placeholder="0364.263.552" />
          </div>
          <div>
            <FieldLabel>Link khi bấm số</FieldLabel>
            <input style={inputStyle} value={c.contact.phoneHref} onChange={(e) => set("contact", { ...c.contact, phoneHref: e.target.value })} placeholder="tel:+84364263552" />
          </div>
          <div>
            <FieldLabel>Email</FieldLabel>
            <input style={inputStyle} value={c.contact.email} onChange={(e) => set("contact", { ...c.contact, email: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Giờ làm việc</FieldLabel>
            <input style={inputStyle} value={c.contact.hours} onChange={(e) => set("contact", { ...c.contact, hours: e.target.value })} />
          </div>
        </div>
        <p style={hint}>
          Số hiển thị có thể viết đẹp (0364.263.552), nhưng &quot;Link khi bấm số&quot; phải ở dạng quốc tế
          <code> tel:+84…</code> thì bấm trên điện thoại mới gọi được.
        </p>
      </SectionCard>

      <SectionCard title="Mạng xã hội & link tải app">
        <div style={grid2}>
          <div>
            <FieldLabel>Facebook</FieldLabel>
            <input style={inputStyle} value={c.social.facebook} onChange={(e) => set("social", { ...c.social, facebook: e.target.value })} />
          </div>
          <div>
            <FieldLabel>YouTube</FieldLabel>
            <input style={inputStyle} value={c.social.youtube} onChange={(e) => set("social", { ...c.social, youtube: e.target.value })} placeholder="https://www.youtube.com/@therahomeai" />
          </div>
          <div>
            <FieldLabel>Link App Store</FieldLabel>
            <input style={inputStyle} value={c.app_links.appStore} onChange={(e) => set("app_links", { ...c.app_links, appStore: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Link Google Play</FieldLabel>
            <input style={inputStyle} value={c.app_links.playStore} onChange={(e) => set("app_links", { ...c.app_links, playStore: e.target.value })} />
          </div>
        </div>
        <p style={hint}>
          <strong>Để trống một link tải app thì nút đó sẽ ẩn hẳn trên trang Ứng dụng.</strong> Google Play đang
          để trống vì bản Android còn ở closed testing, link chưa công khai nên bấm vào ra trang 404 — khi app
          lên store chính thức, dán lại link là nút hiện lại ngay.
        </p>
      </SectionCard>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <PrimaryBtn onClick={() => void save()} disabled={saving} icon="save">
          {saving ? "Đang lưu..." : "Lưu nội dung website"}
        </PrimaryBtn>
      </div>
    </div>
  );
}

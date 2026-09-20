"use client";

// Cửa hàng — the store tab of Dashboard.dc.html, reading the real
// store_categories / store_items the mobile app and the Admin console share.
//
// The design hard-codes two cards ("TheraNECK+ 120$", "Ergonomic Pillow 45$")
// because it had no data to read. Here the catalog is live and market-scoped,
// so Admin editing an item in the Sản phẩm tab changes this page too — and the
// prices are the real Vietnamese ones, not the design's placeholder dollars.
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { fetchStore, type StoreCategory } from "@/lib/appTabs";
import { SafeImg } from "@/components/landing/SafeImg";

const card: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "clamp(16px, 2.5vw, 30px)",
  padding: "clamp(18px, 2vw, 24px)",
  borderRadius: "var(--radius-lg, 24px)",
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.07)",
};

function Placeholder() {
  return (
    <svg width="58" height="58" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M3.5 12.5c0-2.5 3.2-4.2 8.5-4.2s8.5 1.7 8.5 4.2-3.2 4.2-8.5 4.2-8.5-1.7-8.5-4.2z" />
      <path d="M8.6 11.2c1.6-1 5.2-1 6.8 0" />
    </svg>
  );
}

export function StoreTab({ market }: { market: string | null }) {
  const [cats, setCats] = useState<StoreCategory[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchStore(market);
        if (!cancelled) setCats(data);
      } catch (error) {
        console.error("Unable to load the store catalog", error);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [market]);

  if (failed) return <p style={{ margin: 0, color: "rgba(255,255,255,0.6)" }}>Không tải được cửa hàng. Vui lòng thử lại.</p>;
  if (!cats) return <p style={{ margin: 0, color: "rgba(255,255,255,0.6)" }}>Đang tải cửa hàng...</p>;

  const withItems = cats.filter((c) => c.items.length > 0);
  if (!withItems.length) return <p style={{ margin: 0, color: "rgba(255,255,255,0.6)" }}>Chưa có sản phẩm nào cho thị trường này.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {withItems.map((cat) => (
        <section key={cat.id} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#fff" }}>{cat.title}</h2>
          {cat.items.map((item) => (
            <article key={item.id} style={card}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", width: 116, height: 116, borderRadius: 22, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", overflow: "hidden" }}>
                {item.imageUrl ? (
                  <SafeImg src={item.imageUrl} style={{ width: 96, height: 96, objectFit: "contain", display: "block" }} />
                ) : (
                  <Placeholder />
                )}
              </span>

              <div style={{ flex: "1 1 240px", minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#fff" }}>{item.name}</h3>
                {item.description ? (
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "rgba(255,255,255,0.62)" }}>{item.description}</p>
                ) : null}
                {item.priceText ? (
                  <span style={{ fontSize: 21, fontWeight: 700, color: "#4FB0F5" }}>{item.priceText}</span>
                ) : null}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginLeft: "auto" }}>
                {/* "Dùng thử" only where the category actually offers it and the
                    item has something to preview — the design showed it always. */}
                {cat.hasTrial && item.previewUrl ? (
                  <a href={item.previewUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 130, height: 50, padding: "0 22px", border: "1.5px solid rgba(0,127,217,0.7)", borderRadius: 999, color: "#4FB0F5", fontSize: 15, fontWeight: 600 }}>
                    Dùng thử
                  </a>
                ) : null}
                {/* Only when the item actually has somewhere to buy it. The
                    fallback used to be the shop's front page, which is not a
                    purchase — a button labelled "Mua ngay" that lands you on a
                    homepage is a dead end wearing a CTA's clothes. The links
                    themselves are Shopify cart permalinks now (Admin → Sản
                    Phẩm), so this goes to the same checkout as everywhere
                    else. */}
                {item.externalLink ? (
                  <a
                    href={item.externalLink}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 150, height: 50, padding: "0 24px", borderRadius: 999, background: "var(--color-primary)", color: "#fff", fontSize: 15, fontWeight: 600, boxShadow: "0 12px 28px rgba(0,127,217,0.28)" }}
                  >
                    Mua ngay
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      ))}

      <p style={{ margin: 0, textAlign: "center", fontSize: 15 }}>
        <a href="https://therahomeai.com" target="_blank" rel="noreferrer" style={{ color: "#7FBFFF" }}>
          Xem tất cả tại therahomeai.com
        </a>
      </p>
    </div>
  );
}

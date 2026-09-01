"use client";

// Real data: products / program_phases / program_days (see src/lib/db.ts).
// Mutate-then-refetch rather than optimistic local state, for simplicity —
// this is a low-traffic internal admin screen, not worth the extra
// bookkeeping. `category` (neck/back) is a new required field here that the
// mock version never needed, since the real `products.category` column has
// a NOT NULL check constraint.
import { Fragment, useEffect, useState } from "react";
import type { Product, ProgramDay, ProgramPhase, MarketContent } from "@/lib/mockData";
import { fetchRoutineProducts, fetchStoreCategories, createRoutineProduct, updateProductInfo, createProgramDay, updateProgramDay, deleteProgramDay } from "@/lib/db";
import { SectionCard, GhostBtn, PrimaryBtn, Badge, FieldLabel, inputStyle, PillTabs, MarketSelect } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { HeaderAccessory } from "@/components/shell/HeaderAccessory";
import { Icon } from "@/components/ui/Icon";
import { pushToast } from "@/components/ui/Toast";
import { PhaseContentModal } from "@/components/views/PhaseContentModal";

type DayModalState = "new" | number | null;
type MarketKey = "vn" | "us" | "malay";
const MARKET_TABS: Array<[MarketKey, string]> = [["vn", "VN"], ["us", "UK"], ["malay", "ML"]];
const EMPTY_MARKET_CONTENT: MarketContent = { vn: "", us: "", malay: "" };

/** Content across the 3 markets must be all-filled or all-empty — a day
 * can legitimately have no video at all (e.g. a rest day), but can't have
 * it for only some markets, which is exactly the gap that left UK/ML users
 * with an empty roadmap in practice. */
function isMarketContentComplete(content: MarketContent): boolean {
  const filled = [content.vn, content.us, content.malay].filter((value) => value.trim());
  return filled.length === 0 || filled.length === 3;
}

export function RoutineView() {
  const [products, setProducts] = useState<Product[] | null>(null);
  // Top-row market dropdown — the day table shows the selected market's
  // video/support links; the day modal still edits all 3 (all-or-none rule
  // below), just opened at the selected market's tab.
  const [viewMarket, setViewMarket] = useState<MarketKey>("vn");
  const [storeLinks, setStoreLinks] = useState<Record<string, string>>({});
  const [productId, setProductId] = useState<string | null>(null);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState<"neck" | "back">("neck");
  const [newProductDays, setNewProductDays] = useState("28");
  const [newProductLink, setNewProductLink] = useState("");
  const [editInfo, setEditInfo] = useState(false);
  const [infoName, setInfoName] = useState("");
  const [infoLink, setInfoLink] = useState("");
  const [dayModal, setDayModal] = useState<DayModalState>(null);
  const [phaseContentTarget, setPhaseContentTarget] = useState<ProgramPhase | null>(null);
  const [dayMarketTab, setDayMarketTab] = useState<MarketKey>("vn");
  const [phase, setPhase] = useState("");
  const [type, setType] = useState<"train" | "rest">("train");
  const [video, setVideo] = useState<MarketContent>(EMPTY_MARKET_CONTENT);
  const [supportToolsUrl, setSupportToolsUrl] = useState<MarketContent>(EMPTY_MARKET_CONTENT);
  const [deleteDayConfirm, setDeleteDayConfirm] = useState<number | null>(null);
  const [deletingDay, setDeletingDay] = useState(false);

  function reload(selectId?: string) {
    Promise.all([fetchRoutineProducts(), fetchStoreCategories()])
      .then(([prods, cats]) => {
        setProducts(prods);
        const links: Record<string, string> = {};
        for (const c of cats) for (const it of c.items) if (it.link) links[it.id] = it.link;
        setStoreLinks(links);
        if (selectId) setProductId(selectId);
        else if (!productId && prods.length) setProductId(prods[0].id);
      })
      .catch(() => pushToast("Không thể tải dữ liệu Lộ trình"));
  }
  useEffect(() => reload(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const product = products?.find((p) => p.id === productId);

  function openNewProduct() {
    setNewProductName("");
    setNewProductCategory("neck");
    setNewProductDays("28");
    setNewProductLink("");
    setNewProductOpen(true);
  }
  async function saveProduct() {
    const name = newProductName.trim();
    const totalDays = Number.parseInt(newProductDays, 10);
    if (!name || !Number.isInteger(totalDays) || totalDays < 1 || totalDays > 365) {
      pushToast("Vui lòng nhập tên và số ngày từ 1 đến 365");
      return;
    }
    try {
      const id = await createRoutineProduct({ name, category: newProductCategory, totalDays, link: newProductLink.trim() });
      setNewProductOpen(false);
      pushToast("Đã thêm sản phẩm mới vào Lộ trình");
      reload(id);
    } catch {
      pushToast("Không thể thêm sản phẩm");
    }
  }

  function openEditInfo() {
    if (!product) return;
    setInfoName(product.name);
    setInfoLink(storeLinks[product.id] ?? "");
    setEditInfo(true);
  }
  async function saveInfo() {
    if (!product) return;
    try {
      await updateProductInfo(product.id, { name: infoName, link: infoLink });
      setEditInfo(false);
      pushToast("Đã lưu thông tin " + infoName);
      reload(product.id);
    } catch {
      pushToast("Không thể lưu thông tin");
    }
  }
  function openNewDay() {
    if (!product) return;
    setDayModal("new");
    setDayMarketTab(viewMarket);
    setPhase(product.phases[0]?.name ?? "");
    setType("train");
    setVideo(EMPTY_MARKET_CONTENT);
    setSupportToolsUrl(EMPTY_MARKET_CONTENT);
  }
  function openEditDay(d: ProgramDay) {
    setDayModal(d.id);
    setDayMarketTab(viewMarket);
    setPhase(d.phase);
    setType(d.type);
    setVideo(d.video);
    setSupportToolsUrl(d.supportToolsUrl);
  }
  async function saveDay() {
    if (!product) return;
    const trimmedVideo: MarketContent = { vn: video.vn.trim(), us: video.us.trim(), malay: video.malay.trim() };
    const trimmedSupportToolsUrl: MarketContent = { vn: supportToolsUrl.vn.trim(), us: supportToolsUrl.us.trim(), malay: supportToolsUrl.malay.trim() };
    if (!isMarketContentComplete(trimmedVideo) || !isMarketContentComplete(trimmedSupportToolsUrl)) {
      pushToast("Vui lòng điền đầy đủ Video/Dụng cụ hỗ trợ cho cả 3 thị trường (VN/UK/ML), hoặc để trống cả 3.");
      return;
    }
    try {
      if (dayModal === "new") {
        const nextDayNumber = product.days.length ? Math.max(...product.days.map((d) => d.id)) + 1 : 1;
        await createProgramDay(product.id, phase, nextDayNumber, type, trimmedVideo, trimmedSupportToolsUrl);
        pushToast("Đã thêm ngày mới");
      } else if (dayModal !== null) {
        await updateProgramDay(product.id, dayModal, phase, type, trimmedVideo, trimmedSupportToolsUrl);
        pushToast("Đã lưu Ngày " + dayModal);
      }
      setDayModal(null);
      reload(product.id);
    } catch {
      pushToast("Không thể lưu ngày tập");
    }
  }
  async function confirmDeleteDay() {
    if (!product || deleteDayConfirm === null) return;
    try {
      setDeletingDay(true);
      await deleteProgramDay(product.id, deleteDayConfirm);
      setDeleteDayConfirm(null);
      pushToast("Đã xoá Ngày " + deleteDayConfirm);
      reload(product.id);
    } catch {
      pushToast("Không thể xoá ngày tập");
    } finally {
      setDeletingDay(false);
    }
  }

  if (!products) return <div style={{ color: "var(--text-secondary)" }}>Đang tải...</div>;
  if (!product) return <div style={{ color: "var(--text-secondary)" }}>Chưa có sản phẩm nào trong Lộ trình.</div>;

  const dayList = [...product.days].sort((a, b) => a.id - b.id);
  const viewMarketLabel = MARKET_TABS.find(([key]) => key === viewMarket)?.[1] ?? "VN";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <HeaderAccessory>
        <MarketSelect options={MARKET_TABS} value={viewMarket} onChange={setViewMarket} />
      </HeaderAccessory>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => setProductId(p.id)}
              style={{
                border: productId === p.id ? "none" : "1px solid var(--border-input)",
                background: productId === p.id ? "var(--color-primary)" : "#fff",
                color: productId === p.id ? "#fff" : "var(--text-primary)",
                borderRadius: 999,
                padding: "9px 18px",
                fontFamily: "var(--font-family)",
                fontWeight: 600,
                fontSize: 13.5,
                cursor: "pointer",
              }}
            >
              {p.name.split("·")[1] ? p.name.split("·")[1].trim() : p.name}
            </button>
          ))}
        </div>
        <PrimaryBtn icon="plus" onClick={openNewProduct}>Thêm sản phẩm mới</PrimaryBtn>
      </div>
      <SectionCard title={product.name} action={<GhostBtn onClick={openEditInfo}>Sửa thông tin</GhostBtn>}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13.5, color: "var(--text-secondary)" }}>
          <div>
            <strong style={{ color: "var(--text-primary)" }}>{dayList.length}</strong>/{product.totalDays} ngày · {product.phases.length} giai đoạn
          </div>
          <div>
            Link sản phẩm:{" "}
            {storeLinks[product.id] ? (
              <a href={storeLinks[product.id]} target="_blank" rel="noopener">Xem trang sản phẩm ↗</a>
            ) : (
              <span style={{ color: "var(--text-muted)" }}>Chưa có link</span>
            )}
          </div>
        </div>
      </SectionCard>
      <SectionCard title="Giai đoạn · Khảo sát & Upsell">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {product.phases.map((ph) => (
            <div key={ph.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 10, background: "var(--bg-card-alt)" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-primary)" }}>{ph.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>Ngày {ph.range[0]}–{ph.range[1]}</div>
              </div>
              <GhostBtn onClick={() => setPhaseContentTarget(ph)}>Quản lý Khảo sát &amp; Upsell</GhostBtn>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title={"Lịch trình " + product.totalDays + " ngày"} action={<PrimaryBtn icon="plus" onClick={openNewDay}>Thêm ngày mới</PrimaryBtn>}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase" }}>
              <th style={{ padding: "0 8px 10px" }}>Ngày</th>
              <th style={{ padding: "0 8px 10px" }}>Giai đoạn</th>
              <th style={{ padding: "0 8px 10px" }}>Loại</th>
              <th style={{ padding: "0 8px 10px" }}>Video</th>
              <th style={{ padding: "0 8px 10px" }}>Dụng cụ hỗ trợ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {dayList.slice(0, 14).map((d) => (
              <tr key={d.id} style={{ borderTop: "1px solid var(--divider)" }}>
                <td style={{ padding: "10px 8px", fontWeight: 600, color: "var(--text-primary)" }}>Ngày {d.id}</td>
                <td style={{ padding: "10px 8px", color: "var(--text-secondary)" }}>{d.phase}</td>
                <td style={{ padding: "10px 8px" }}>
                  {d.type === "rest" ? (
                    <Badge color="#B9860B" bg="rgba(185,134,11,0.12)">Nghỉ</Badge>
                  ) : (
                    <Badge color="#1E9E5E" bg="rgba(30,158,94,0.12)">Tập</Badge>
                  )}
                </td>
                <td style={{ padding: "10px 8px" }}>
                  {d.video[viewMarket] ? (
                    <a href={d.video[viewMarket]} target="_blank" rel="noopener" style={{ fontSize: 13 }}>Xem video ({viewMarketLabel}) ↗</a>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
                <td style={{ padding: "10px 8px" }}>
                  {d.supportToolsUrl[viewMarket] ? (
                    <a href={d.supportToolsUrl[viewMarket]} target="_blank" rel="noopener" style={{ fontSize: 13 }}>Mở link ({viewMarketLabel}) ↗</a>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
                <td style={{ padding: "10px 8px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button onClick={() => openEditDay(d)} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                      <Icon name="pencil" size={16} color="var(--color-primary)" />
                    </button>
                    <button onClick={() => setDeleteDayConfirm(d.id)} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                      <Icon name="trash-2" size={16} color="var(--error)" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 10 }}>Hiển thị {Math.min(14, dayList.length)}/{dayList.length} ngày</div>
      </SectionCard>
      {newProductOpen ? (
        <Modal
          title="Thêm sản phẩm vào Lộ trình"
          onClose={() => setNewProductOpen(false)}
          width={440}
          footer={
            <Fragment>
              <GhostBtn onClick={() => setNewProductOpen(false)}>Hủy</GhostBtn>
              <PrimaryBtn onClick={saveProduct}>Thêm sản phẩm</PrimaryBtn>
            </Fragment>
          }
        >
          <FieldLabel>Tên sản phẩm</FieldLabel>
          <input value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="Ví dụ: TheraKNEE+" style={{ ...inputStyle, marginBottom: 14 }} />
          <FieldLabel>Nhóm</FieldLabel>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {([["neck", "Cổ"], ["back", "Lưng"]] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setNewProductCategory(k)}
                style={{ flex: 1, border: newProductCategory === k ? "none" : "1px solid var(--border-input)", background: newProductCategory === k ? "var(--color-primary)" : "none", color: newProductCategory === k ? "#fff" : "var(--text-primary)", borderRadius: 10, padding: "9px 0", fontFamily: "var(--font-family)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                {l}
              </button>
            ))}
          </div>
          <FieldLabel>Thời lượng lộ trình (ngày)</FieldLabel>
          <input type="number" min={1} max={365} value={newProductDays} onChange={(e) => setNewProductDays(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
          <FieldLabel>Link trang sản phẩm</FieldLabel>
          <input value={newProductLink} onChange={(e) => setNewProductLink(e.target.value)} placeholder="https://..." style={inputStyle} />
          <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--text-muted)" }}>Hệ thống sẽ tạo sẵn 3 giai đoạn; bạn có thể thêm từng ngày sau khi tạo sản phẩm.</div>
        </Modal>
      ) : null}
      {editInfo ? (
        <Modal
          title={"Sửa thông tin " + product.name}
          onClose={() => setEditInfo(false)}
          width={440}
          footer={
            <Fragment>
              <GhostBtn onClick={() => setEditInfo(false)}>Hủy</GhostBtn>
              <PrimaryBtn onClick={saveInfo}>Lưu thay đổi</PrimaryBtn>
            </Fragment>
          }
        >
          <FieldLabel>Tên hiển thị</FieldLabel>
          <input value={infoName} onChange={(e) => setInfoName(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
          <FieldLabel>Link trang sản phẩm</FieldLabel>
          <input value={infoLink} onChange={(e) => setInfoLink(e.target.value)} placeholder="https://..." style={inputStyle} />
          <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--text-muted)" }}>Link chỉ được lưu nếu sản phẩm này đã có mục tương ứng trong Sản Phẩm (Cửa hàng).</div>
        </Modal>
      ) : null}
      {dayModal !== null ? (
        <Modal
          title={dayModal === "new" ? "Thêm ngày mới" : "Sửa Ngày " + dayModal}
          onClose={() => setDayModal(null)}
          width={420}
          footer={
            <Fragment>
              <GhostBtn onClick={() => setDayModal(null)}>Hủy</GhostBtn>
              <PrimaryBtn onClick={saveDay}>{dayModal === "new" ? "Thêm ngày" : "Lưu thay đổi"}</PrimaryBtn>
            </Fragment>
          }
        >
          <FieldLabel>Giai đoạn</FieldLabel>
          <select value={phase} onChange={(e) => setPhase(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }}>
            {product.phases.map((ph) => (
              <option key={ph.name} value={ph.name}>{ph.name}</option>
            ))}
          </select>
          <FieldLabel>Loại ngày</FieldLabel>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {([["train", "Tập"], ["rest", "Nghỉ"]] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setType(k)}
                style={{
                  flex: 1,
                  border: type === k ? "none" : "1px solid var(--border-input)",
                  background: type === k ? "var(--color-primary)" : "none",
                  color: type === k ? "#fff" : "var(--text-primary)",
                  borderRadius: 10,
                  padding: "9px 0",
                  fontFamily: "var(--font-family)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {l}
              </button>
            ))}
          </div>
          <FieldLabel>Nội dung theo thị trường</FieldLabel>
          <PillTabs options={MARKET_TABS} value={dayMarketTab} onChange={setDayMarketTab} />
          <div style={{ marginBottom: 8, fontSize: 12, color: "var(--text-muted)" }}>
            Điền đầy đủ cho cả 3 thị trường (hoặc để trống cả 3 — ví dụ ngày nghỉ không cần video).
          </div>
          <FieldLabel>Link video</FieldLabel>
          <input
            value={video[dayMarketTab]}
            onChange={(e) => setVideo((v) => ({ ...v, [dayMarketTab]: e.target.value }))}
            placeholder="https://..."
            style={{ ...inputStyle, marginBottom: 14 }}
          />
          <FieldLabel>Link Dụng cụ hỗ trợ tập luyện</FieldLabel>
          <input
            value={supportToolsUrl[dayMarketTab]}
            onChange={(e) => setSupportToolsUrl((v) => ({ ...v, [dayMarketTab]: e.target.value }))}
            placeholder="https://..."
            style={inputStyle}
          />
        </Modal>
      ) : null}
      {phaseContentTarget ? (
        <PhaseContentModal phase={phaseContentTarget} onClose={() => setPhaseContentTarget(null)} />
      ) : null}
      {deleteDayConfirm !== null ? (
        <ConfirmModal
          title="Xoá ngày tập"
          message={`Xoá Ngày ${deleteDayConfirm} khỏi lộ trình ${product.name}? Nội dung của cả 3 thị trường cho ngày này sẽ bị xoá và không thể hoàn tác.`}
          confirmLabel="Xoá vĩnh viễn"
          busy={deletingDay}
          onConfirm={confirmDeleteDay}
          onCancel={() => setDeleteDayConfirm(null)}
        />
      ) : null}
    </div>
  );
}

"use client";

// Real data: products / program_phases / program_days (see src/lib/db.ts).
// Mutate-then-refetch rather than optimistic local state, for simplicity —
// this is a low-traffic internal admin screen, not worth the extra
// bookkeeping. `category` (neck/back) is a new required field here that the
// mock version never needed, since the real `products.category` column has
// a NOT NULL check constraint.
import { Fragment, useEffect, useState } from "react";
import type { Product, ProgramDay, ProgramPhase, MarketContent } from "@/lib/mockData";
import { fetchRoutineProducts, fetchStoreCategories, createRoutineProduct, updateProductInfo, saveLocalizedNames, createProgramDay, updateProgramDay, deleteProgramDay,
  fetchRoadmapReadiness,
  setRoadmapPublished,
  deleteRoutineProduct,
  countRoadmapOwners,
  createProgramPhase,
  updateProgramPhase,
  deleteProgramPhase,
  fetchPhaseDeleteImpact,
  reassignDaysToPhases,
  type RoadmapReadiness,
} from "@/lib/db";
import { SectionCard, GhostBtn, PrimaryBtn, Badge, FieldLabel, inputStyle, PillTabs, MarketSelect } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { HeaderAccessory } from "@/components/shell/HeaderAccessory";
import { Icon } from "@/components/ui/Icon";
import { pushToast } from "@/components/ui/Toast";
import { PhaseContentModal } from "@/components/views/PhaseContentModal";
import { translateDrafts } from "@/lib/translate";

type DayModalState = "new" | number | null;
type MarketKey = "vn" | "us" | "malay";
const MARKET_TABS: Array<[MarketKey, string]> = [["vn", "VN"], ["us", "UK"], ["malay", "ML"]];
// Readiness rows come back keyed by the DB market codes.
const MARKET_LABEL: Record<string, string> = { VN: "VN", US: "UK", MALAY: "ML" };
const MARKET_DB_CODE: Record<MarketKey, string> = { vn: "VN", us: "US", malay: "MALAY" };
const EMPTY_MARKET_CONTENT: MarketContent = { vn: "", us: "", malay: "" };

/** Names are stored VN + optional EN/MS. The tab is scoped to one market by
 * the header dropdown, so it must read in that market's language instead of
 * always showing Vietnamese (owner 2026-09-05); `fallback` flags a variant
 * that was never authored, so the row can say so rather than look translated. */
function marketText(vn: string, en: string, ms: string, market: MarketKey): { text: string; fallback: boolean } {
  const variant = market === "us" ? en : market === "malay" ? ms : "";
  if (market === "vn") return { text: vn, fallback: false };
  return variant.trim() ? { text: variant.trim(), fallback: false } : { text: vn, fallback: true };
}

export function RoutineView() {
  const [products, setProducts] = useState<Product[] | null>(null);
  // Top-row market dropdown — the day table shows the selected market's
  // video/support links; the day modal still edits all 3 (all-or-none rule
  // below), just opened at the selected market's tab.
  const [viewMarket, setViewMarket] = useState<MarketKey>("vn");
  const [storeLinks, setStoreLinks] = useState<Record<string, string>>({});
  // Publish switch + readiness readout (2026-09-05): the app lists a roadmap
  // only when `roadmapPublished`; this panel tells Admin how complete the
  // videos are before flipping it.
  const [readiness, setReadiness] = useState<RoadmapReadiness[] | null>(null);
  const [publishAction, setPublishAction] = useState<"publish" | "unpublish" | "delete" | null>(null);
  const [deleteOwners, setDeleteOwners] = useState<number | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState<"neck" | "back">("neck");
  const [newProductDays, setNewProductDays] = useState("28");
  const [editInfo, setEditInfo] = useState(false);
  // EN/MS display names for this product + its phases. Before 2026-09-04
  // these lived in a hardcoded lookup inside the mobile app, keyed by the
  // Vietnamese string — so renaming a phase here silently pushed UK/ML
  // users back to Vietnamese names.
  const [infoNameEn, setInfoNameEn] = useState("");
  const [infoNameMs, setInfoNameMs] = useState("");
  const [infoName, setInfoName] = useState("");
  const [infoLink, setInfoLink] = useState("");
  const [infoTotalDays, setInfoTotalDays] = useState("28");
  // Phase editor (2026-09-05): phases used to be fixed at 3, created with the
  // product and renameable only. Now add/edit/delete, since a roadmap that
  // only has 14 days of video should not carry an empty phase 3.
  const [phaseModal, setPhaseModal] = useState<"new" | ProgramPhase | null>(null);
  const [phaseName, setPhaseName] = useState("");
  const [phaseNameEn, setPhaseNameEn] = useState("");
  const [phaseNameMs, setPhaseNameMs] = useState("");
  const [phaseStart, setPhaseStart] = useState("1");
  const [phaseEnd, setPhaseEnd] = useState("7");
  const [phaseBusy, setPhaseBusy] = useState(false);
  const [deletePhaseTarget, setDeletePhaseTarget] = useState<ProgramPhase | null>(null);
  const [deletePhaseImpact, setDeletePhaseImpact] = useState<{ days: number; purchases: number; quizAttempts: number } | null>(null);
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
        // Keyed by products.id (what this view looks up), not store_items.id.
        for (const c of cats) for (const it of c.items) if (it.link) links[it.productId ?? it.id] = it.link;
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
      const { id, translated } = await createRoutineProduct({ name, category: newProductCategory, totalDays });
      setNewProductOpen(false);
      pushToast(
        translated
          ? "Đã thêm sản phẩm + tự dịch nháp tên UK/ML — kiểm tra ở Sửa thông tin"
          : "Đã thêm sản phẩm — chưa dịch được tên UK/ML, nhập tay ở Sửa thông tin",
      );
      reload(id);
    } catch {
      pushToast("Không thể thêm sản phẩm");
    }
  }

  function openEditInfo() {
    if (!product) return;
    setInfoName(product.name);
    setInfoNameEn(product.nameEn);
    setInfoNameMs(product.nameMs);
    setInfoLink(storeLinks[product.id] ?? "");
    setInfoTotalDays(String(product.totalDays));
    setEditInfo(true);
  }

  function openNewPhase() {
    if (!product) return;
    const lastEnd = product.phases.reduce((max, ph) => Math.max(max, ph.range[1]), 0);
    setPhaseModal("new");
    setPhaseName("");
    setPhaseNameEn("");
    setPhaseNameMs("");
    setPhaseStart(String(lastEnd + 1));
    setPhaseEnd(String(lastEnd + 7));
  }
  function openEditPhase(ph: ProgramPhase) {
    setPhaseModal(ph);
    setPhaseName(ph.name);
    setPhaseNameEn(ph.nameEn);
    setPhaseNameMs(ph.nameMs);
    setPhaseStart(String(ph.range[0]));
    setPhaseEnd(String(ph.range[1]));
  }
  async function savePhase() {
    if (!product || !phaseModal) return;
    const name = phaseName.trim();
    const start = Number.parseInt(phaseStart, 10);
    const end = Number.parseInt(phaseEnd, 10);
    if (!name) {
      pushToast("Vui lòng nhập tên giai đoạn (VN)");
      return;
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > 365) {
      pushToast("Khoảng ngày không hợp lệ — ngày bắt đầu phải ≥ 1 và ≤ ngày kết thúc");
      return;
    }
    const editingId = phaseModal === "new" ? null : phaseModal.id;
    // createProgramDay/updateProgramDay resolve a phase by (product, name),
    // so two phases of one product may not share a name.
    if (product.phases.some((ph) => ph.id !== editingId && ph.name.trim().toLowerCase() === name.toLowerCase())) {
      pushToast("Đã có giai đoạn trùng tên trong lộ trình này");
      return;
    }
    const overlap = product.phases.find((ph) => ph.id !== editingId && start <= ph.range[1] && end >= ph.range[0]);
    if (overlap) {
      pushToast(`Khoảng ngày trùng với "${overlap.name}" (ngày ${overlap.range[0]}–${overlap.range[1]})`);
      return;
    }
    setPhaseBusy(true);
    try {
      // Empty UK/ML names are machine-drafted from the VN name, same pattern
      // as the quiz/upsell editors — staff can edit the draft later, and a
      // translator outage just saves VN-only rather than blocking the save.
      let nameEn = phaseNameEn;
      let nameMs = phaseNameMs;
      let drafted = false;
      if (!nameEn.trim() || !nameMs.trim()) {
        const drafts = await translateDrafts({ name });
        if (drafts) {
          if (!nameEn.trim()) nameEn = drafts.en.name ?? "";
          if (!nameMs.trim()) nameMs = drafts.ms.name ?? "";
          drafted = true;
        }
      }
      const input = { name, nameEn, nameMs, dayStart: start, dayEnd: end };
      if (editingId) await updateProgramPhase(editingId, input);
      else await createProgramPhase(product.id, input);
      setPhaseModal(null);
      pushToast(
        drafted
          ? (editingId ? "Đã lưu giai đoạn" : "Đã thêm giai đoạn") + " + tự dịch nháp UK/ML (kiểm tra lại)"
          : editingId ? "Đã lưu giai đoạn" : "Đã thêm giai đoạn",
      );
      reload(product.id);
    } catch {
      pushToast("Không thể lưu giai đoạn");
    } finally {
      setPhaseBusy(false);
    }
  }
  function askDeletePhase(ph: ProgramPhase) {
    setDeletePhaseImpact(null);
    setDeletePhaseTarget(ph);
    fetchPhaseDeleteImpact(ph.id).then(setDeletePhaseImpact).catch(() => setDeletePhaseImpact(null));
  }
  async function confirmDeletePhase() {
    if (!product || !deletePhaseTarget) return;
    setPhaseBusy(true);
    try {
      await deleteProgramPhase(deletePhaseTarget.id);
      setDeletePhaseTarget(null);
      pushToast("Đã xoá " + deletePhaseTarget.name);
      reload(product.id);
    } catch {
      pushToast("Không thể xoá giai đoạn");
    } finally {
      setPhaseBusy(false);
    }
  }
  async function runReassignDays() {
    if (!product) return;
    try {
      const moved = await reassignDaysToPhases(product.id);
      pushToast(moved ? `Đã gán lại ${moved} ngày theo khoảng giai đoạn` : "Không có ngày nào cần gán lại");
      reload(product.id);
    } catch {
      pushToast("Không thể gán lại ngày tập");
    }
  }
  useEffect(() => {
    if (!productId) return;
    fetchRoadmapReadiness(productId).then(setReadiness).catch(() => setReadiness(null));
  }, [productId, products]);

  async function runPublishAction() {
    if (!product || !publishAction) return;
    setPublishBusy(true);
    try {
      if (publishAction === "delete") {
        await deleteRoutineProduct(product.id);
        setPublishAction(null);
        pushToast("Đã xoá lộ trình " + product.name);
        setProductId(null);
        reload();
        return;
      }
      const { pushError } = await setRoadmapPublished(product.id, publishAction === "publish");
      setPublishAction(null);
      pushToast(
        publishAction === "publish"
          ? pushError
            ? "Đã xuất bản — hộp thư trong app đã có thông báo, nhưng push THẤT BẠI"
            : "Đã xuất bản lộ trình — khách đã kích hoạt được thông báo"
          : "Đã ẩn lộ trình khỏi app (khách đã kích hoạt thấy thẻ 'đang hoàn thiện')",
      );
      reload(product.id);
    } catch (error) {
      pushToast(
        error instanceof Error && error.message === "has_orders"
          ? "Không xoá được: đã có đơn hàng gắn với sản phẩm này."
          : "Không thể cập nhật trạng thái lộ trình",
      );
    } finally {
      setPublishBusy(false);
    }
  }

  async function saveInfo() {
    if (!product) return;
    const totalDays = Number.parseInt(infoTotalDays, 10);
    if (!Number.isInteger(totalDays) || totalDays < 1 || totalDays > 365) {
      pushToast("Thời lượng lộ trình phải từ 1 đến 365 ngày");
      return;
    }
    try {
      await updateProductInfo(product.id, { name: infoName, link: infoLink, totalDays });
      // Same auto-draft rule as the phase editor: a blank UK/ML name is
      // machine-translated from the VN one and stays editable here.
      let nameEn = infoNameEn;
      let nameMs = infoNameMs;
      let drafted = false;
      if (!nameEn.trim() || !nameMs.trim()) {
        const drafts = await translateDrafts({ name: infoName });
        if (drafts) {
          if (!nameEn.trim()) nameEn = drafts.en.name ?? "";
          if (!nameMs.trim()) nameMs = drafts.ms.name ?? "";
          drafted = true;
        }
      }
      // Phase names now live in the phase editor; this only carries the
      // product's own EN/MS names.
      await saveLocalizedNames({
        productId: product.id,
        productNameEn: nameEn,
        productNameMs: nameMs,
        phases: [],
      });
      setEditInfo(false);
      pushToast(drafted ? "Đã lưu thông tin + tự dịch nháp tên UK/ML (kiểm tra lại)" : "Đã lưu thông tin " + infoName);
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
    // Markets are managed independently (owner rule 2026-09-05) — a day may
    // be filled for VN only. The per-market readiness panel and the publish
    // confirm are what flag a market that is still short of videos.
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
  // Only the market being viewed — showing all 3 side by side read as noise
  // when the header already scopes the page to one (owner, 2026-09-05).
  const marketReadiness = readiness?.find((r) => r.market === MARKET_DB_CODE[viewMarket]) ?? null;
  const marketComplete =
    !!marketReadiness && marketReadiness.missingDays.length === 0 && marketReadiness.duplicateDays.length === 0 && marketReadiness.daysWithVideo > 0;
  const phaseList = [...product.phases].sort((a, b) => a.range[0] - b.range[0]);
  const productLabel = marketText(product.name, product.nameEn, product.nameMs, viewMarket);
  /** Day rows store the phase by its VN name; this maps that to the label for
   * the market being viewed without touching the stored value. */
  const phaseLabel = (vnName: string) => {
    const ph = phaseList.find((p) => p.name === vnName);
    return ph ? marketText(ph.name, ph.nameEn, ph.nameMs, viewMarket) : { text: vnName, fallback: false };
  };
  const missingVariantHint = viewMarket === "vn" ? "" : `Chưa có bản ${viewMarketLabel} — đang hiện bản VN.`;
  const daysOutOfPhaseRange = dayList.filter((d) => {
    const phase = phaseList.find((ph) => ph.name === d.phase);
    return !phase || d.id < phase.range[0] || d.id > phase.range[1];
  });
  const marketsWithGaps = (readiness ?? []).filter((r) => r.missingDays.length || r.duplicateDays.length || r.daysWithVideo === 0);

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
              {(() => {
                const label = marketText(p.name, p.nameEn, p.nameMs, viewMarket).text;
                return label.split("·")[1] ? label.split("·")[1].trim() : label;
              })()}
              {!p.roadmapPublished ? <span style={{ marginLeft: 6, fontSize: 10.5, opacity: 0.85 }}>· nháp</span> : null}
            </button>
          ))}
        </div>
        <PrimaryBtn icon="plus" onClick={openNewProduct}>Thêm sản phẩm mới</PrimaryBtn>
      </div>
      <SectionCard
        title={productLabel.text}
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                padding: "3px 9px",
                borderRadius: 999,
                color: product.roadmapPublished ? "#2BB673" : "#B9860B",
                background: product.roadmapPublished ? "rgba(43,182,115,0.12)" : "rgba(185,134,11,0.12)",
              }}
            >
              {product.roadmapPublished ? "Đang hiển thị trên app" : "Nháp · chưa hiển thị"}
            </span>
            <GhostBtn onClick={openEditInfo}>Sửa thông tin</GhostBtn>
            {product.roadmapPublished ? (
              <GhostBtn onClick={() => setPublishAction("unpublish")}>Ẩn lộ trình</GhostBtn>
            ) : (
              <PrimaryBtn
                onClick={() => {
                  // Publishing with zero days leaves every owner on a blank
                  // roadmap and a Home card that cannot finish loading.
                  if (dayList.length === 0) {
                    pushToast("Chưa có ngày tập nào — thêm ít nhất 1 ngày trước khi xuất bản.");
                    return;
                  }
                  setPublishAction("publish");
                }}
              >
                Xuất bản lộ trình
              </PrimaryBtn>
            )}
            <GhostBtn
              color="var(--error)"
              onClick={() => {
                setDeleteOwners(null);
                countRoadmapOwners(product.id).then(setDeleteOwners).catch(() => setDeleteOwners(null));
                setPublishAction("delete");
              }}
            >
              Xoá
            </GhostBtn>
          </div>
        }
      >
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
        {!marketReadiness && dayList.length === 0 ? (
          <div style={{ marginTop: 14, background: "rgba(185,134,11,0.10)", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: "#B9860B" }}>
            <strong>Chưa có ngày tập nào.</strong> Thêm ngày ở bảng bên dưới rồi mới xuất bản được — lộ trình rỗng làm app của khách kẹt ở màn hình chờ.
          </div>
        ) : null}
        {marketReadiness ? (
          <div style={{ marginTop: 14, background: "var(--bg-card-alt)", borderRadius: 10, padding: "10px 12px", fontSize: 12.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ color: "var(--text-primary)" }}>Video thị trường {viewMarketLabel}</strong>
              <span style={{ fontWeight: 700, color: marketComplete ? "#2BB673" : "#B9860B" }}>
                {marketReadiness.daysWithVideo}/{marketReadiness.totalDays} ngày
              </span>
            </div>
            {marketReadiness.missingDays.length ? (
              <div style={{ color: "var(--text-secondary)", marginTop: 4 }}>Thiếu video: ngày {marketReadiness.missingDays.join(", ")}</div>
            ) : null}
            {marketReadiness.duplicateDays.length ? (
              <div style={{ color: "#B9860B", marginTop: 4 }}>Lặp video ngày trước: ngày {marketReadiness.duplicateDays.join(", ")}</div>
            ) : null}
            {marketComplete ? <div style={{ color: "#2BB673", marginTop: 4 }}>Đủ video, không trùng.</div> : null}
            <div style={{ color: "var(--text-muted)", marginTop: 6 }}>
              Mỗi thị trường quản lý riêng — đổi thị trường ở đầu trang để xem VN / UK / ML.
            </div>
          </div>
        ) : null}
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
          App chỉ liệt kê lộ trình <strong>đang hiển thị</strong>. Lộ trình nháp bị ẩn với mọi người trừ khách đã kích hoạt thiết bị đó — họ thấy thẻ &quot;đang hoàn thiện&quot; và sẽ nhận thông báo khi bạn xuất bản.
        </div>
      </SectionCard>
      <SectionCard
        title="Giai đoạn · Khảo sát & Upsell"
        action={<PrimaryBtn icon="plus" onClick={openNewPhase}>Thêm giai đoạn</PrimaryBtn>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {phaseList.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Chưa có giai đoạn nào — thêm giai đoạn trước khi thêm ngày tập.</div>
          ) : null}
          {phaseList.map((ph) => {
            const phaseDays = dayList.filter((d) => d.phase === ph.name);
            return (
              <div key={ph.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 10, background: "var(--bg-card-alt)", flexWrap: "wrap" }}>
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-primary)" }}>
                    {marketText(ph.name, ph.nameEn, ph.nameMs, viewMarket).text}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                    Ngày {ph.range[0]}–{ph.range[1]} · {phaseDays.length} ngày đã tạo
                    {marketText(ph.name, ph.nameEn, ph.nameMs, viewMarket).fallback ? (
                      <span style={{ color: "#B9860B" }}>{" · " + missingVariantHint}</span>
                    ) : null}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <GhostBtn onClick={() => setPhaseContentTarget(ph)}>Quản lý Khảo sát &amp; Upsell</GhostBtn>
                  <button onClick={() => openEditPhase(ph)} title="Sửa giai đoạn" style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                    <Icon name="pencil" size={16} color="var(--color-primary)" />
                  </button>
                  <button onClick={() => askDeletePhase(ph)} title="Xoá giai đoạn" style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                    <Icon name="trash-2" size={16} color="var(--error)" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {daysOutOfPhaseRange.length ? (
          <div style={{ marginTop: 12, fontSize: 12.5, color: "#B9860B", background: "rgba(185,134,11,0.10)", borderRadius: 10, padding: "10px 12px" }}>
            <strong>{daysOutOfPhaseRange.length} ngày</strong> đang thuộc giai đoạn không khớp khoảng ngày (ngày{" "}
            {daysOutOfPhaseRange.map((d) => d.id).join(", ")}).
            <div style={{ marginTop: 8 }}>
              <GhostBtn onClick={runReassignDays}>Gán lại ngày theo khoảng giai đoạn</GhostBtn>
            </div>
          </div>
        ) : null}
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
          Xoá một giai đoạn sẽ xoá luôn các ngày tập, câu hỏi khảo sát và thẻ Upsell thuộc giai đoạn đó.
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
            {dayList.map((d) => (
              <tr key={d.id} style={{ borderTop: "1px solid var(--divider)" }}>
                <td style={{ padding: "10px 8px", fontWeight: 600, color: "var(--text-primary)" }}>Ngày {d.id}</td>
                <td style={{ padding: "10px 8px", color: "var(--text-secondary)" }}>{phaseLabel(d.phase).text}</td>
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
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 10 }}>{dayList.length} ngày</div>
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
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Hệ thống tạo sẵn 3 giai đoạn (sửa/xoá/thêm được ở thẻ Giai đoạn) và tự dịch nháp tên sang UK/ML.
            Sau khi tạo: thêm từng ngày tập, rồi bấm <strong>Xuất bản lộ trình</strong> thì app mới hiện.
            <br />
            Link trang sản phẩm đặt ở tab <strong>Sản Phẩm</strong> (Cửa hàng) — link gắn với mục bán hàng, không gắn với lộ trình.
          </div>
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
          <FieldLabel>Tên hiển thị (VN)</FieldLabel>
          <input value={infoName} onChange={(e) => setInfoName(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <FieldLabel>Tên (UK)</FieldLabel>
              <input value={infoNameEn} onChange={(e) => setInfoNameEn(e.target.value)} placeholder={infoName} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <FieldLabel>Tên (ML)</FieldLabel>
              <input value={infoNameMs} onChange={(e) => setInfoNameMs(e.target.value)} placeholder={infoName} style={inputStyle} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -8, marginBottom: 14 }}>
            Để trống ô UK/ML thì khi lưu hệ thống tự dịch từ bản VN thành bản nháp — bạn sửa lại lúc nào cũng được.
          </div>

          <FieldLabel>Thời lượng lộ trình (ngày)</FieldLabel>
          <input type="number" min={1} max={365} value={infoTotalDays} onChange={(e) => setInfoTotalDays(e.target.value)} style={{ ...inputStyle, marginBottom: 4 }} />
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
            Con số app đếm tới — &quot;NGÀY 12 / {infoTotalDays || "…"}&quot;. Hiện có {dayList.length} ngày đã tạo.
          </div>

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
              <option key={ph.name} value={ph.name}>{marketText(ph.name, ph.nameEn, ph.nameMs, viewMarket).text}</option>
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
            Mỗi thị trường lưu riêng — có thể chỉ điền VN. Thị trường bỏ trống sẽ hiện trong bảng &quot;Thiếu video&quot;.
          </div>
          <FieldLabel>Link video ({MARKET_TABS.find(([k]) => k === dayMarketTab)?.[1]})</FieldLabel>
          <input
            value={video[dayMarketTab]}
            onChange={(e) => setVideo((v) => ({ ...v, [dayMarketTab]: e.target.value }))}
            placeholder="https://..."
            style={{ ...inputStyle, marginBottom: 6 }}
          />
          <div style={{ marginBottom: 14 }}>
            <GhostBtn onClick={() => setVideo({ vn: video[dayMarketTab], us: video[dayMarketTab], malay: video[dayMarketTab] })}>
              Dùng link này cho cả 3 thị trường
            </GhostBtn>
          </div>
          <FieldLabel>Link Dụng cụ hỗ trợ tập luyện ({MARKET_TABS.find(([k]) => k === dayMarketTab)?.[1]})</FieldLabel>
          <input
            value={supportToolsUrl[dayMarketTab]}
            onChange={(e) => setSupportToolsUrl((v) => ({ ...v, [dayMarketTab]: e.target.value }))}
            placeholder="https://..."
            style={{ ...inputStyle, marginBottom: 6 }}
          />
          <GhostBtn
            onClick={() =>
              setSupportToolsUrl({ vn: supportToolsUrl[dayMarketTab], us: supportToolsUrl[dayMarketTab], malay: supportToolsUrl[dayMarketTab] })
            }
          >
            Dùng link này cho cả 3 thị trường
          </GhostBtn>
        </Modal>
      ) : null}
      {phaseContentTarget ? (
        <PhaseContentModal phase={phaseContentTarget} productId={product.id} onClose={() => setPhaseContentTarget(null)} />
      ) : null}
      {publishAction ? (
        <ConfirmModal
          title={publishAction === "publish" ? "Xuất bản lộ trình" : publishAction === "unpublish" ? "Ẩn lộ trình khỏi app" : "Xoá lộ trình"}
          message={
            publishAction === "publish"
              ? `Xuất bản "${product.name}"? Lộ trình hiện lên app cho mọi người, và MỌI khách đã kích hoạt thiết bị này nhận thông báo "lộ trình đã sẵn sàng".${
                  dayList.length < product.totalDays
                    ? ` CẢNH BÁO: mới có ${dayList.length}/${product.totalDays} ngày tập.`
                    : ""
                }${
                  marketsWithGaps.length
                    ? ` Lưu ý: thị trường ${marketsWithGaps.map((r) => MARKET_LABEL[r.market]).join(", ")} còn ngày thiếu video hoặc lặp video.`
                    : ""
                }`
              : publishAction === "unpublish"
                ? `Ẩn "${product.name}" khỏi app? Khách chưa kích hoạt sẽ không thấy; khách đã kích hoạt thấy thẻ "đang hoàn thiện" thay cho các ngày tập.`
                : `Xoá hẳn "${product.name}" cùng toàn bộ ngày tập, giai đoạn và danh sách kích hoạt?${
                    deleteOwners ? ` ${deleteOwners} tài khoản đang có lộ trình này sẽ mất tiến trình tập và nhật ký đau.` : ""
                  } Không thể hoàn tác.`
          }
          confirmLabel={publishAction === "publish" ? "Xuất bản" : publishAction === "unpublish" ? "Ẩn lộ trình" : "Xoá vĩnh viễn"}
          busy={publishBusy}
          onConfirm={runPublishAction}
          onCancel={() => setPublishAction(null)}
        />
      ) : null}
      {phaseModal ? (
        <Modal
          title={phaseModal === "new" ? "Thêm giai đoạn" : "Sửa giai đoạn"}
          onClose={() => setPhaseModal(null)}
          width={440}
          footer={
            <Fragment>
              <GhostBtn onClick={() => setPhaseModal(null)}>Hủy</GhostBtn>
              <PrimaryBtn onClick={savePhase} disabled={phaseBusy}>
                {phaseBusy ? "Đang lưu..." : phaseModal === "new" ? "Thêm giai đoạn" : "Lưu thay đổi"}
              </PrimaryBtn>
            </Fragment>
          }
        >
          <FieldLabel>Tên giai đoạn (VN)</FieldLabel>
          <input
            value={phaseName}
            onChange={(e) => setPhaseName(e.target.value)}
            placeholder="Ví dụ: Giai đoạn 1 · Giảm khó chịu & làm quen"
            style={{ ...inputStyle, marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
            <div style={{ flex: 1 }}>
              <FieldLabel>Tên (UK)</FieldLabel>
              <input value={phaseNameEn} onChange={(e) => setPhaseNameEn(e.target.value)} placeholder={phaseName} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <FieldLabel>Tên (ML)</FieldLabel>
              <input value={phaseNameMs} onChange={(e) => setPhaseNameMs(e.target.value)} placeholder={phaseName} style={inputStyle} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
            Để trống ô UK/ML thì khi lưu hệ thống tự dịch từ bản VN thành bản nháp — bạn sửa lại lúc nào cũng được.
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
            <div style={{ flex: 1 }}>
              <FieldLabel>Ngày bắt đầu</FieldLabel>
              <input type="number" min={1} max={365} value={phaseStart} onChange={(e) => setPhaseStart(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <FieldLabel>Ngày kết thúc</FieldLabel>
              <input type="number" min={1} max={365} value={phaseEnd} onChange={(e) => setPhaseEnd(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Khoảng ngày không được trùng với giai đoạn khác. Sau khi đổi khoảng, dùng nút &quot;Gán lại ngày theo khoảng giai đoạn&quot; nếu có ngày báo lệch.
          </div>
        </Modal>
      ) : null}
      {deletePhaseTarget ? (
        <ConfirmModal
          title="Xoá giai đoạn"
          message={
            `Xoá "${deletePhaseTarget.name}" (ngày ${deletePhaseTarget.range[0]}–${deletePhaseTarget.range[1]}) khỏi ${product.name}?` +
            (deletePhaseImpact
              ? ` Sẽ xoá luôn ${deletePhaseImpact.days} ngày tập cùng câu hỏi khảo sát và thẻ Upsell của giai đoạn này.` +
                (deletePhaseImpact.purchases ? ` CẢNH BÁO: ${deletePhaseImpact.purchases} lượt mua giai đoạn này cũng bị xoá.` : "") +
                (deletePhaseImpact.quizAttempts ? ` ${deletePhaseImpact.quizAttempts} lượt làm khảo sát của khách cũng bị xoá.` : "")
              : " Đang kiểm tra dữ liệu liên quan...") +
            " Không thể hoàn tác."
          }
          confirmLabel="Xoá vĩnh viễn"
          busy={phaseBusy}
          onConfirm={confirmDeletePhase}
          onCancel={() => setDeletePhaseTarget(null)}
        />
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

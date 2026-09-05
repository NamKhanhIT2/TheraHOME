"use client";
/* eslint-disable @next/next/no-img-element -- thumbnail previews are dynamic Supabase Storage/user-pasted URLs, not static site assets. */

// Real data: community_posts / post_comments (see src/lib/db.ts). likes_count
// / comments_count are trigger-maintained server-side (see
// TheraHOME-APP/CLAUDE.md), so mutations here reload from the DB rather than
// adjusting counts locally.
import { Fragment, useEffect, useState } from "react";
import type { CommunityPost } from "@/lib/mockData";
import {
  fetchCommunityPosts,
  createOfficialPost,
  setOfficialPostPinned,
  uploadPostThumbnail,
  updateCommunityPost,
  deleteCommunityPost,
  deleteCommunityComment,
  setCommunityPostStatus,
  fetchChallenges,
  createChallenge,
  setChallengeActive,
  type Challenge,
  type PinnedDisplay,
  type AdminMarket,
  type PinnedMarketDisplay,
  type PostMarketContent,
  type PostModerationStatus,
} from "@/lib/db";
import { PrimaryBtn, GhostBtn, Badge, FieldLabel, inputStyle, Avatar, PillTabs } from "@/components/ui/primitives";
import { translateDrafts } from "@/lib/translate";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { TableShell } from "@/components/ui/TableShell";
import { Icon } from "@/components/ui/Icon";
import { pushToast } from "@/components/ui/Toast";

type PinnedPost = CommunityPost & {
  pinned: boolean;
  hidden: boolean;
  status: PostModerationStatus;
  imageUrl: string | null;
  pinnedDisplay: PinnedDisplay;
  pinnedMarketDisplay: PinnedMarketDisplay;
  marketContent: PostMarketContent;
  targetMarkets: string[] | null;
};

type AuthorTab = "official" | "users";
const AUTHOR_TABS: Array<[AuthorTab, string]> = [
  ["official", "Từ TheraHOME"],
  ["users", "Khác"],
];

function NewChallengeModal({ onClose, onSave }: { onClose: () => void; onSave: (input: { title: string; description: string; icon: string; targetStreakDays: number }) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🔥");
  const [targetStreakDays, setTargetStreakDays] = useState(7);

  function submit() {
    if (!title.trim()) return;
    onSave({ title: title.trim(), description: description.trim(), icon: icon.trim() || "🔥", targetStreakDays });
  }

  return (
    <Modal
      title="Tạo thử thách mới"
      onClose={onClose}
      width={440}
      footer={
        <Fragment>
          <GhostBtn onClick={onClose}>Hủy</GhostBtn>
          <PrimaryBtn onClick={submit}>Tạo thử thách</PrimaryBtn>
        </Fragment>
      }
    >
      <FieldLabel>Tiêu đề</FieldLabel>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Thử thách 7 ngày – Cổ nhẹ hơn mỗi ngày" style={{ ...inputStyle, marginBottom: 14 }} />
      <FieldLabel>Mô tả (tùy chọn)</FieldLabel>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 14 }}>
        <div style={{ flex: 1 }}>
          <FieldLabel>Emoji</FieldLabel>
          <input value={icon} onChange={(e) => setIcon(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: 2 }}>
          <FieldLabel>Số ngày liên tục để hoàn thành</FieldLabel>
          <input type="number" min={1} value={targetStreakDays} onChange={(e) => setTargetStreakDays(Math.max(1, Number(e.target.value) || 1))} style={inputStyle} />
        </div>
      </div>
    </Modal>
  );
}

function ChallengesAdminView() {
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [creating, setCreating] = useState(false);

  function reload() {
    fetchChallenges().then(setChallenges).catch(() => pushToast("Không thể tải danh sách thử thách"));
  }
  useEffect(reload, []);

  async function handleCreate(input: { title: string; description: string; icon: string; targetStreakDays: number }) {
    try {
      await createChallenge(input);
      setCreating(false);
      pushToast("Đã tạo thử thách " + input.title);
      reload();
    } catch {
      pushToast("Không thể tạo thử thách");
    }
  }

  async function toggleActive(c: Challenge) {
    try {
      await setChallengeActive(c.id, !c.active);
      pushToast(c.active ? "Đã kết thúc thử thách" : "Đã kích hoạt lại thử thách");
      reload();
    } catch {
      pushToast("Không thể cập nhật thử thách");
    }
  }

  if (!challenges) return <div style={{ color: "var(--text-secondary)", padding: 20 }}>Đang tải...</div>;

  return (
    <TableShell
      subtitle="Thử thách xuất hiện dưới dạng banner đầu feed Cộng đồng khi đang hoạt động."
      action={<PrimaryBtn icon="plus" onClick={() => setCreating(true)}>Tạo thử thách</PrimaryBtn>}
      columns={["Thử thách", "Mục tiêu", "Trạng thái", "Người tham gia", "Hoàn thành", "Thao tác"]}
      modals={creating ? <NewChallengeModal onClose={() => setCreating(false)} onSave={handleCreate} /> : null}
    >
      {challenges.map((c) => (
        <tr key={c.id} style={{ borderTop: "1px solid var(--divider)" }}>
          <td style={{ padding: "14px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>{c.icon}</span>
              <div>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{c.title}</div>
                {c.description ? <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.description}</div> : null}
              </div>
            </div>
          </td>
          <td style={{ padding: "14px 20px", color: "var(--text-secondary)" }}>{c.targetStreakDays} ngày liên tục</td>
          <td style={{ padding: "14px 20px" }}>
            {c.active ? (
              <Badge color="#1E9E5E" bg="rgba(30,158,94,0.12)">Đang hoạt động</Badge>
            ) : (
              <Badge color="#8A93A3" bg="rgba(138,147,163,0.12)">Đã kết thúc</Badge>
            )}
          </td>
          <td style={{ padding: "14px 20px", color: "var(--text-secondary)" }}>{c.participantCount}</td>
          <td style={{ padding: "14px 20px", color: "var(--text-secondary)" }}>{c.completedCount}</td>
          <td style={{ padding: "14px 20px" }}>
            <GhostBtn color={c.active ? "var(--error)" : undefined} onClick={() => toggleActive(c)}>
              {c.active ? "Kết thúc" : "Kích hoạt lại"}
            </GhostBtn>
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

const MARKET_TABS: Array<[AdminMarket, string]> = [["VN", "VN"], ["US", "UK"], ["MALAY", "ML"]];
const MARKET_LABEL: Record<AdminMarket, string> = { VN: "VN", US: "UK", MALAY: "ML" };

function PinDisplayModal({
  post,
  onClose,
  onConfirm,
}: {
  post: PinnedPost;
  onClose: () => void;
  onConfirm: (input: {
    markets: AdminMarket[];
    byMarket: Record<AdminMarket, { title: string; content: string; thumbnailUrl: string }>;
    thumbnailFiles: Partial<Record<AdminMarket, File>>;
  }) => Promise<void>;
}) {
  // A pin can never go wider than the post itself: `targetMarkets` null
  // means the post reaches every market.
  const postMarkets: AdminMarket[] = post.targetMarkets?.length
    ? (MARKET_TABS.map(([code]) => code).filter((code) => post.targetMarkets!.includes(code)) as AdminMarket[])
    : (MARKET_TABS.map(([code]) => code) as AdminMarket[]);
  const alreadyPinned = post.pinnedMarketDisplay.markets?.length
    ? (post.pinnedMarketDisplay.markets.filter((code: AdminMarket) => postMarkets.includes(code)) as AdminMarket[])
    : postMarkets;

  const [markets, setMarkets] = useState<AdminMarket[]>(alreadyPinned);
  const [tab, setTab] = useState<AdminMarket>(alreadyPinned[0] ?? postMarkets[0]);
  const [byMarket, setByMarket] = useState<Record<AdminMarket, { title: string; content: string; thumbnailUrl: string }>>(() => {
    // Each market's card defaults to THAT market's post content, so a UK pin
    // never starts life holding Vietnamese copy.
    const saved = post.pinnedMarketDisplay;
    const base = { title: post.title || post.name, content: post.text, thumbnailUrl: post.imageUrl || "" };
    return {
      VN: { title: saved.vn.title || base.title, content: saved.vn.content || base.content, thumbnailUrl: saved.vn.thumbnailUrl || base.thumbnailUrl },
      US: {
        title: saved.us.title || post.marketContent.titleUs || base.title,
        content: saved.us.content || post.marketContent.textUs || base.content,
        thumbnailUrl: saved.us.thumbnailUrl || base.thumbnailUrl,
      },
      MALAY: {
        title: saved.malay.title || post.marketContent.titleMalay || base.title,
        content: saved.malay.content || post.marketContent.textMalay || base.content,
        thumbnailUrl: saved.malay.thumbnailUrl || base.thumbnailUrl,
      },
    };
  });
  const [thumbnailFiles, setThumbnailFiles] = useState<Partial<Record<AdminMarket, File>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(code: AdminMarket, next: Partial<{ title: string; content: string; thumbnailUrl: string }>) {
    setByMarket((current) => ({ ...current, [code]: { ...current[code], ...next } }));
  }

  const canSubmit = markets.length > 0 && markets.every((code) => byMarket[code].title.trim() && byMarket[code].content.trim()) && !submitting;

  async function submit() {
    if (submitting) return;
    if (!markets.length) {
      setError("Chọn ít nhất một thị trường để ghim.");
      return;
    }
    const missing = markets.find((code) => !byMarket[code].title.trim() || !byMarket[code].content.trim());
    if (missing) {
      setTab(missing);
      setError(`Chưa nhập tiêu đề và nội dung thẻ ghim cho thị trường ${MARKET_LABEL[missing]}.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm({ markets, byMarket, thumbnailFiles });
    } finally {
      setSubmitting(false);
    }
  }

  const activeTab = markets.includes(tab) ? tab : markets[0];

  return (
    <Modal
      title="Ghim bài viết lên đầu Cộng đồng"
      onClose={onClose}
      width={480}
      footer={
        <Fragment>
          <GhostBtn onClick={onClose}>Hủy</GhostBtn>
          <PrimaryBtn onClick={submit} disabled={!canSubmit}>
            {submitting ? "Đang ghim..." : "Ghim bài viết"}
          </PrimaryBtn>
        </Fragment>
      }
    >
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 14 }}>
        Nội dung hiển thị trên card ghim ở Trang chủ và Cộng đồng của app — có thể khác với bài viết gốc (ví dụ rút gọn nội dung dài, hoặc thêm ảnh minh họa).
      </div>

      <FieldLabel>Ghim ở thị trường</FieldLabel>
      <div style={{ display: "flex", gap: 14, marginBottom: 6 }}>
        {MARKET_TABS.filter(([code]) => postMarkets.includes(code)).map(([code, label]) => (
          <label key={code} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--text-primary)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={markets.includes(code)}
              onChange={(e) => {
                setMarkets((current) => (e.target.checked ? [...current, code] : current.filter((m) => m !== code)));
                if (e.target.checked) setTab(code);
              }}
            />
            {label}
          </label>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
        Mỗi thị trường chỉ có một bài ghim — ghim ở thị trường nào thì bài ghim cũ của riêng thị trường đó được thay, các thị trường khác giữ nguyên.
        {postMarkets.length < 3 ? ` Bài này chỉ hiển thị ở ${postMarkets.map((code) => MARKET_LABEL[code]).join(", ")} nên không ghim ra ngoài được.` : ""}
      </div>

      {markets.length ? (
        <Fragment>
          <PillTabs options={MARKET_TABS.filter(([code]) => markets.includes(code))} value={activeTab} onChange={setTab} />
          <FieldLabel>Tiêu đề hiển thị ({MARKET_LABEL[activeTab]})</FieldLabel>
          <input value={byMarket[activeTab].title} onChange={(e) => patch(activeTab, { title: e.target.value })} style={{ ...inputStyle, marginBottom: 14 }} />
          <FieldLabel>Nội dung hiển thị ({MARKET_LABEL[activeTab]})</FieldLabel>
          <textarea
            value={byMarket[activeTab].content}
            onChange={(e) => patch(activeTab, { content: e.target.value })}
            rows={3}
            style={{ ...inputStyle, resize: "vertical", marginBottom: 14 }}
          />
          <FieldLabel>Ảnh thumbnail (tùy chọn)</FieldLabel>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setThumbnailFiles((current) => ({ ...current, [activeTab]: e.target.files?.[0] ?? undefined }))}
            style={{ ...inputStyle, padding: 8, marginBottom: 8 }}
          />
          {thumbnailFiles[activeTab] ? (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>Sẵn sàng tải lên: {thumbnailFiles[activeTab]!.name}</div>
          ) : (
            <Fragment>
              <input
                value={byMarket[activeTab].thumbnailUrl}
                onChange={(e) => patch(activeTab, { thumbnailUrl: e.target.value })}
                placeholder="Hoặc dán link ảnh..."
                style={{ ...inputStyle, marginBottom: 8 }}
              />
              {byMarket[activeTab].thumbnailUrl ? (
                <img src={byMarket[activeTab].thumbnailUrl} alt="" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 10, border: "1px solid var(--divider)" }} />
              ) : null}
            </Fragment>
          )}
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>JPG, PNG hoặc WebP, tối đa 15 MB (tự nén khi tải lên).</div>
        </Fragment>
      ) : null}
      {error ? (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "rgba(220,53,69,0.08)", fontSize: 12.5, fontWeight: 600, color: "var(--error)", lineHeight: 1.5 }}>
          {error}
        </div>
      ) : null}
    </Modal>
  );
}

// Single full-featured view. The old `pinOnly` prop (a cut-down CSKH
// variant) is gone: Community management moved wholesale to CSKH on
// 2026-09-05 and the RLS policies now grant cskh the same writes as admin.
export function CommunityView() {
  const [subTab, setSubTab] = useState<"posts" | "challenges">("posts");
  const [items, setItems] = useState<PinnedPost[] | null>(null);
  const [modal, setModal] = useState<string | number | "new" | null>(null);
  // Edit-modal image fields (per explicit request: CSKH can revise a
  // published post's image as well as its text).
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [commentsFor, setCommentsFor] = useState<string | number | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [sendNotification, setSendNotification] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");
  // New-post market targeting. `title`/`text` are the BASE content (also the
  // fallback for any targeted market with no variant filled in); UK/ML can
  // additionally carry their own variant fields. VN is now un-tickable
  // (fix 2026-09-04: it used to be force-added to every post, so a UK-only
  // post still reached Vietnamese users). Ticking nothing but UK posts to
  // UK only.
  const [vnTargeted, setVnTargeted] = useState(true);
  // "Ghim ngay khi đăng" (owner request 2026-09-05) — pins with the post's
  // own title/text as the card copy; staff can refine via the pin editor.
  const [pinAfterPost, setPinAfterPost] = useState(false);
  const [extraMarkets, setExtraMarkets] = useState<Array<"US" | "MALAY">>([]);
  const [composerMarketTab, setComposerMarketTab] = useState<AdminMarket>("VN");
  const [titleUs, setTitleUs] = useState("");
  const [textUs, setTextUs] = useState("");
  const [titleMalay, setTitleMalay] = useState("");
  const [textMalay, setTextMalay] = useState("");
  const [notifyTitleUs, setNotifyTitleUs] = useState("");
  const [notifyBodyUs, setNotifyBodyUs] = useState("");
  const [notifyTitleMalay, setNotifyTitleMalay] = useState("");
  const [notifyBodyMalay, setNotifyBodyMalay] = useState("");
  const [q, setQ] = useState("");
  // Split into two genuinely separate lists (not a mixed list with a
  // filter dropdown) per explicit request — official TheraHOME posts and
  // regular app-user posts read as different content, so browsing one
  // shouldn't require scrolling past rows of the other.
  const [authorTab, setAuthorTab] = useState<AuthorTab>("official");
  const [pinning, setPinning] = useState<PinnedPost | null>(null);
  // Long posts used to be printed in full inside the table cell, which made
  // one article push every other row off-screen. Clamp to 3 lines and let
  // staff expand a row on demand.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function reload() {
    fetchCommunityPosts().then(setItems).catch(() => pushToast("Không thể tải bài viết Cộng đồng"));
  }
  useEffect(reload, []);

  function openNew() {
    setModal("new");
    setTitle("");
    setText("");
    setSendNotification(false);
    setNotifyTitle("");
    setNotifyBody("");
    setVnTargeted(true);
    setPinAfterPost(false);
    setExtraMarkets([]);
    setComposerMarketTab("VN");
    setTitleUs("");
    setTextUs("");
    setTitleMalay("");
    setTextMalay("");
    setNotifyTitleUs("");
    setNotifyBodyUs("");
    setNotifyTitleMalay("");
    setNotifyBodyMalay("");
  }
  function openEdit(it: PinnedPost) {
    setModal(it.id);
    setTitle(it.title || "");
    setText(it.text);
    // Load the UK/ML versions too — editing used to write only the VN base,
    // so a published translation could never be corrected (owner report
    // 2026-09-05: "chỉnh sửa mới chỉ có ở VN").
    setTitleUs(it.marketContent.titleUs);
    setTextUs(it.marketContent.textUs);
    setTitleMalay(it.marketContent.titleMalay);
    setTextMalay(it.marketContent.textMalay);
    const targets = it.targetMarkets?.length ? (it.targetMarkets as AdminMarket[]) : (["VN", "US", "MALAY"] as AdminMarket[]);
    setVnTargeted(targets.includes("VN"));
    setExtraMarkets(targets.filter((m): m is "US" | "MALAY" => m === "US" || m === "MALAY"));
    setComposerMarketTab(targets.includes("VN") ? "VN" : targets[0]);
    setEditImageUrl(it.imageUrl || "");
    setEditImageFile(null);
    setSendNotification(false);
    setNotifyTitle("");
    setNotifyBody("");
  }
  async function save() {
    try {
      if (modal === "new") {
        if (!vnTargeted && extraMarkets.length === 0) {
          pushToast("Hãy chọn ít nhất một thị trường được xem bài này");
          return;
        }
        // The VN fields are the BASE content. They are only mandatory when
        // VN is actually a target; for a UK/ML-only post (owner request
        // 2026-09-05: "đôi khi tôi chỉ muốn đăng ở 1 số quốc gia") staff can
        // leave them empty and the first filled market variant becomes the
        // base (the DB requires `text`, and the app falls back to base for
        // any market without its own variant).
        const baseFilled = !!title.trim() && !!text.trim();
        if (vnTargeted && !baseFilled) {
          pushToast("Vui lòng nhập tiêu đề và nội dung bài viết (VN)");
          return;
        }
        const firstVariant =
          extraMarkets.includes("US") && titleUs.trim() && textUs.trim()
            ? { title: titleUs.trim(), text: textUs.trim(), notifyTitle: notifyTitleUs.trim(), notifyBody: notifyBodyUs.trim() }
            : extraMarkets.includes("MALAY") && titleMalay.trim() && textMalay.trim()
              ? { title: titleMalay.trim(), text: textMalay.trim(), notifyTitle: notifyTitleMalay.trim(), notifyBody: notifyBodyMalay.trim() }
              : null;
        if (!baseFilled && !firstVariant) {
          pushToast(`Nhập tiêu đề và nội dung cho bản ${extraMarkets[0] === "US" ? "UK" : "ML"} (VN không được tick nên có thể bỏ trống phần VN)`);
          return;
        }
        const source = baseFilled
          ? { title: title.trim(), text: text.trim(), notifyTitle: notifyTitle.trim(), notifyBody: notifyBody.trim() }
          : firstVariant!;
        // UK/ML variants left empty auto-draft from the VN content (per
        // explicit request 2026-09-04) instead of blocking the publish —
        // staff can refine them later by editing the post. Only when the
        // translator itself fails do we fall back to the old "please fill
        // in" error for the still-empty variant.
        let finalTitleUs = titleUs.trim();
        let finalTextUs = textUs.trim();
        let finalTitleMalay = titleMalay.trim();
        let finalTextMalay = textMalay.trim();
        let finalNotifyTitleUs = notifyTitleUs.trim();
        let finalNotifyBodyUs = notifyBodyUs.trim();
        let finalNotifyTitleMalay = notifyTitleMalay.trim();
        let finalNotifyBodyMalay = notifyBodyMalay.trim();
        const needUs = extraMarkets.includes("US") && (!finalTitleUs || !finalTextUs);
        const needMalay = extraMarkets.includes("MALAY") && (!finalTitleMalay || !finalTextMalay);
        let drafted = false;
        if (needUs || needMalay) {
          const drafts = await translateDrafts(source);
          if (drafts) {
            if (needUs) {
              finalTitleUs = finalTitleUs || drafts.en.title || "";
              finalTextUs = finalTextUs || drafts.en.text || "";
              finalNotifyTitleUs = finalNotifyTitleUs || drafts.en.notifyTitle || "";
              finalNotifyBodyUs = finalNotifyBodyUs || drafts.en.notifyBody || "";
            }
            if (needMalay) {
              finalTitleMalay = finalTitleMalay || drafts.ms.title || "";
              finalTextMalay = finalTextMalay || drafts.ms.text || "";
              finalNotifyTitleMalay = finalNotifyTitleMalay || drafts.ms.notifyTitle || "";
              finalNotifyBodyMalay = finalNotifyBodyMalay || drafts.ms.notifyBody || "";
            }
            drafted = true;
          }
        }
        if (extraMarkets.includes("US") && (!finalTitleUs || !finalTextUs)) {
          pushToast("Vui lòng nhập tiêu đề và nội dung bản UK");
          return;
        }
        if (extraMarkets.includes("MALAY") && (!finalTitleMalay || !finalTextMalay)) {
          pushToast("Vui lòng nhập tiêu đề và nội dung bản ML");
          return;
        }
        const newPostId = await createOfficialPost({
          title: source.title,
          text: source.text,
          sendNotification,
          notifyTitle: notifyTitle.trim() || source.notifyTitle,
          notifyBody: notifyBody.trim() || source.notifyBody,
          // Exactly the ticked markets. All three ticked => undefined (null
          // in the DB = "everywhere", which also covers markets added
          // later). Untick VN to post for UK/ML only.
          targetMarkets:
            vnTargeted && extraMarkets.length === 2
              ? undefined
              : [...(vnTargeted ? (["VN"] as AdminMarket[]) : []), ...extraMarkets],
          titleUs: extraMarkets.includes("US") ? finalTitleUs : undefined,
          textUs: extraMarkets.includes("US") ? finalTextUs : undefined,
          titleMalay: extraMarkets.includes("MALAY") ? finalTitleMalay : undefined,
          textMalay: extraMarkets.includes("MALAY") ? finalTextMalay : undefined,
          notifyTitleUs: extraMarkets.includes("US") ? finalNotifyTitleUs : undefined,
          notifyBodyUs: extraMarkets.includes("US") ? finalNotifyBodyUs : undefined,
          notifyTitleMalay: extraMarkets.includes("MALAY") ? finalNotifyTitleMalay : undefined,
          notifyBodyMalay: extraMarkets.includes("MALAY") ? finalNotifyBodyMalay : undefined,
        });
        let pinned = false;
        if (pinAfterPost) {
          try {
            // Pin into exactly the markets this post targets, each with its
            // own copy (VN base falls back in when a variant is empty).
            const pinMarkets: AdminMarket[] = [...(vnTargeted ? (["VN"] as AdminMarket[]) : []), ...extraMarkets];
            await setOfficialPostPinned(newPostId, true, {
              markets: pinMarkets,
              vn: { title: source.title.slice(0, 80), content: source.text.slice(0, 160), thumbnailUrl: null },
              us: pinMarkets.includes("US") ? { title: (finalTitleUs || source.title).slice(0, 80), content: (finalTextUs || source.text).slice(0, 160), thumbnailUrl: null } : undefined,
              malay: pinMarkets.includes("MALAY") ? { title: (finalTitleMalay || source.title).slice(0, 80), content: (finalTextMalay || source.text).slice(0, 160), thumbnailUrl: null } : undefined,
            });
            pinned = true;
          } catch {
            pushToast("Đã đăng bài nhưng chưa ghim được — bấm biểu tượng ghim trong danh sách để thử lại");
          }
        }
        pushToast(
          (sendNotification ? "Đã đăng bài và gửi thông báo" : "Đã đăng bài viết mới lên Cộng đồng") +
            (pinned ? " · đã ghim lên đầu" : "") +
            (drafted ? " · đã tự dịch nháp UK/ML" : ""),
        );
      } else if (modal !== null) {
        if (!vnTargeted && extraMarkets.length === 0) {
          pushToast("Hãy chọn ít nhất một thị trường được xem bài này");
          return;
        }
        const editedMarkets: AdminMarket[] = [...(vnTargeted ? (["VN"] as AdminMarket[]) : []), ...extraMarkets];
        const missingEdit = editedMarkets.find((code) =>
          code === "VN" ? !title.trim() || !text.trim() : code === "US" ? !titleUs.trim() || !textUs.trim() : !titleMalay.trim() || !textMalay.trim(),
        );
        if (missingEdit) {
          setComposerMarketTab(missingEdit);
          pushToast(`Chưa có tiêu đề và nội dung cho thị trường ${MARKET_LABEL[missingEdit]}`);
          return;
        }
        const imageUrl = editImageFile
          ? await uploadPostThumbnail(String(modal), editImageFile)
          : editImageUrl.trim() || null;
        await updateCommunityPost(String(modal), {
          title: title.trim() || undefined,
          text: text.trim() || (titleUs.trim() ? textUs.trim() : textMalay.trim()),
          imageUrl,
          titleUs: titleUs.trim() || null,
          textUs: textUs.trim() || null,
          titleMalay: titleMalay.trim() || null,
          textMalay: textMalay.trim() || null,
          // All three ticked => null = "hiển thị ở mọi thị trường", which
          // also covers markets added later.
          targetMarkets: editedMarkets.length === 3 ? null : editedMarkets,
        });
        pushToast("Đã lưu bài viết");
      }
      setModal(null);
      reload();
    } catch {
      pushToast("Không thể lưu bài viết");
    }
  }
  function togglePin(it: PinnedPost) {
    if (!it.official) return;
    if (it.pinned) {
      // Unpinning needs no display info — just clear the flag.
      void unpin(it);
      return;
    }
    // Pinning opens a modal first so staff can curate what actually shows
    // on the card (a post's own text may run long, and official posts have
    // no image of their own to use as a thumbnail).
    setPinning(it);
  }
  async function unpin(it: PinnedPost) {
    try {
      await setOfficialPostPinned(String(it.id), false);
      reload();
    } catch {
      pushToast("Không thể bỏ ghim bài viết");
    }
  }
  async function confirmPin(input: {
    markets: AdminMarket[];
    byMarket: Record<AdminMarket, { title: string; content: string; thumbnailUrl: string }>;
    thumbnailFiles: Partial<Record<AdminMarket, File>>;
  }) {
    if (!pinning) return;
    try {
      const resolved = { ...input.byMarket };
      for (const code of input.markets) {
        const file = input.thumbnailFiles[code];
        if (file) {
          resolved[code] = { ...resolved[code], thumbnailUrl: await uploadPostThumbnail(`${String(pinning.id)}-${code.toLowerCase()}`, file) };
        }
      }
      const forMarket = (code: AdminMarket) => ({
        title: resolved[code].title.trim(),
        content: resolved[code].content.trim(),
        thumbnailUrl: resolved[code].thumbnailUrl.trim() || null,
      });
      await setOfficialPostPinned(String(pinning.id), true, {
        markets: input.markets,
        vn: forMarket("VN"),
        us: input.markets.includes("US") ? forMarket("US") : undefined,
        malay: input.markets.includes("MALAY") ? forMarket("MALAY") : undefined,
      });
      setPinning(null);
      pushToast(`Đã ghim bài viết ở ${input.markets.map((code) => MARKET_LABEL[code]).join(", ")}`);
      reload();
    } catch (error) {
      console.error("Unable to pin post", error);
      pushToast(
        error instanceof Error && error.message.includes("pin_market_not_targeted")
          ? "Không ghim được ở thị trường bài viết không hiển thị"
          : "Không thể ghim bài viết",
      );
    }
  }
  async function moderate(it: PinnedPost, status: PostModerationStatus) {
    try {
      await setCommunityPostStatus(String(it.id), status);
      pushToast(status === "approved" ? "Đã duyệt bài viết — tác giả sẽ nhận thông báo" : "Đã từ chối bài viết — tác giả sẽ nhận thông báo");
      reload();
    } catch {
      pushToast("Không thể cập nhật trạng thái duyệt");
    }
  }
  async function toggleHidden(it: PinnedPost) {
    try {
      await updateCommunityPost(String(it.id), { hidden: !it.hidden });
      pushToast(it.hidden ? "Đã hiện lại bài viết" : "Đã ẩn bài viết");
      reload();
    } catch {
      pushToast("Không thể cập nhật trạng thái bài viết");
    }
  }
  const [deletingPost, setDeletingPost] = useState<{ id: string | number; label: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  async function removePost() {
    if (!deletingPost) return;
    try {
      setDeleteBusy(true);
      await deleteCommunityPost(String(deletingPost.id));
      setDeletingPost(null);
      pushToast("Đã xoá bài viết");
      reload();
    } catch {
      pushToast("Không thể xoá bài viết");
    } finally {
      setDeleteBusy(false);
    }
  }
  async function removeComment(id: string) {
    try {
      await deleteCommunityComment(id);
      reload();
    } catch {
      pushToast("Không thể xoá bình luận");
    }
  }

  const communityTabs: Array<[typeof subTab, string]> = [["posts", "Bài viết"], ["challenges", "Thử thách"]];
  const subTabSwitcher = (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      {communityTabs.map(([k, l]) => (
        <button
          key={k}
          onClick={() => setSubTab(k)}
          style={{
            border: subTab === k ? "none" : "1px solid var(--border-input)",
            background: subTab === k ? "var(--color-primary)" : "#fff",
            color: subTab === k ? "#fff" : "var(--text-primary)",
            borderRadius: 999,
            padding: "9px 18px",
            fontFamily: "var(--font-family)",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );

  if (subTab === "challenges") {
    return (
      <div>
        {subTabSwitcher}
        <ChallengesAdminView />
      </div>
    );
  }

  if (!items) return (
    <div>
      {subTabSwitcher}
      <div style={{ color: "var(--text-secondary)" }}>Đang tải...</div>
    </div>
  );

  const filtered = items.filter((it) => {
    const matchesQuery = !q.trim() || it.text.toLowerCase().includes(q.trim().toLowerCase()) || it.name.toLowerCase().includes(q.trim().toLowerCase());
    const matchesAuthor = authorTab === "official" ? it.official : !it.official;
    return matchesQuery && matchesAuthor;
  });
  // Pinned first (official tab); pending-review first (user tab) so new
  // member posts waiting on CSKH sit at the top of the moderation queue.
  const sorted = [...filtered].sort(
    (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.status === "pending" ? 1 : 0) - (a.status === "pending" ? 1 : 0),
  );
  const pendingCount = items.filter((it) => !it.official && it.status === "pending").length;
  const commentPost = items.find((it) => it.id === commentsFor);

  const postModal = modal !== null ? (
    <Modal
      title={modal === "new" ? "Đăng bài viết mới" : "Sửa bài viết"}
      onClose={() => setModal(null)}
      width={480}
      footer={
        <Fragment>
          <GhostBtn onClick={() => setModal(null)}>Hủy</GhostBtn>
          <PrimaryBtn onClick={save}>{modal === "new" ? "Đăng bài" : "Lưu thay đổi"}</PrimaryBtn>
        </Fragment>
      }
    >
      <FieldLabel>{!vnTargeted ? "Tiêu đề (VN · không đăng cho VN, có thể bỏ trống)" : "Tiêu đề (VN)"}</FieldLabel>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: 5 phút thư giãn cổ vai" style={{ ...inputStyle, marginBottom: 14 }} />
      <FieldLabel>{!vnTargeted ? "Nội dung (VN · có thể bỏ trống)" : "Nội dung (VN)"}</FieldLabel>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Nội dung bài viết đăng lên Cộng đồng..." style={{ ...inputStyle, minHeight: 100, resize: "vertical", marginBottom: 14 }} />
      {modal !== "new" ? (
        <Fragment>
          <FieldLabel>Ảnh bài viết (tùy chọn)</FieldLabel>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setEditImageFile(e.target.files?.[0] ?? null)}
            style={{ ...inputStyle, padding: 8, marginBottom: 10 }}
          />
          {editImageFile ? (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>Sẵn sàng tải lên: {editImageFile.name}</div>
          ) : (
            <Fragment>
              <FieldLabel>Hoặc dán URL ảnh (xoá trống để gỡ ảnh)</FieldLabel>
              <input value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} placeholder="https://..." style={{ ...inputStyle, marginBottom: 10 }} />
              {editImageUrl.trim() ? (
                <img src={editImageUrl} alt="" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 10, border: "1px solid var(--divider)", marginBottom: 8 }} />
              ) : null}
            </Fragment>
          )}
        </Fragment>
      ) : null}
      {/* Market targeting + per-market content: shown for BOTH new and edit
          (editing used to expose the VN base only). The notification and
          pin options below stay new-post-only. */}
      <Fragment>
          <FieldLabel>Hiển thị cho thị trường</FieldLabel>
          <div style={{ display: "flex", gap: 14, marginBottom: 6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--text-primary)", cursor: "pointer" }}>
              <input type="checkbox" checked={vnTargeted} onChange={(e) => setVnTargeted(e.target.checked)} />
              VN
            </label>
            {([["US", "UK"], ["MALAY", "ML"]] as const).map(([code, label]) => (
              <label key={code} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--text-primary)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={extraMarkets.includes(code)}
                  onChange={(e) => {
                    setExtraMarkets((current) => (e.target.checked ? [...current, code] : current.filter((m) => m !== code)));
                    if (e.target.checked) setComposerMarketTab(code);
                  }}
                />
                {label}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: extraMarkets.length ? 10 : 16 }}>
            Chỉ người dùng ở thị trường được tick mới thấy bài này. Bỏ tick VN nếu bài chỉ dành cho UK/ML — khi đó phần VN ở trên có thể bỏ trống,
            bài sẽ lấy bản UK/ML bạn điền làm nội dung gốc.
            {modal === "new" ? " Thị trường được tick mà chưa điền bản riêng sẽ được dịch nháp tự động." : " Sửa xong nhớ điền bản của mọi thị trường đang tick."}
          </div>
          {extraMarkets.length ? (
            <div style={{ marginBottom: 16 }}>
              <PillTabs
                options={(["US", "MALAY"] as const).filter((m) => extraMarkets.includes(m)).map((m) => [m, m === "US" ? "UK" : "ML"] as [AdminMarket, string])}
                value={composerMarketTab === "VN" ? extraMarkets[0] : composerMarketTab}
                onChange={setComposerMarketTab}
              />
              <FieldLabel>Tiêu đề ({composerMarketTab === "US" ? "UK" : "ML"})</FieldLabel>
              <input
                value={composerMarketTab === "US" ? titleUs : titleMalay}
                onChange={(e) => (composerMarketTab === "US" ? setTitleUs(e.target.value) : setTitleMalay(e.target.value))}
                style={{ ...inputStyle, marginBottom: 14 }}
              />
              <FieldLabel>Nội dung ({composerMarketTab === "US" ? "UK" : "ML"})</FieldLabel>
              <textarea
                value={composerMarketTab === "US" ? textUs : textMalay}
                onChange={(e) => (composerMarketTab === "US" ? setTextUs(e.target.value) : setTextMalay(e.target.value))}
                style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
              />
            </div>
          ) : null}
      </Fragment>
      {modal === "new" ? (
        <Fragment>
          <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: "var(--text-primary)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={sendNotification}
              onChange={(e) => {
                const checked = e.target.checked;
                setSendNotification(checked);
                // Prefill from the post content on first check so staff
                // aren't starting from a blank box, but never overwrite
                // anything they've already customized.
                if (checked && !notifyTitle && !notifyBody) {
                  setNotifyTitle(title.trim());
                  setNotifyBody(text.trim());
                }
              }}
            />
            Gửi thông báo đến người dùng
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: "var(--text-primary)", cursor: "pointer", marginTop: 8 }}>
            <input type="checkbox" checked={pinAfterPost} onChange={(e) => setPinAfterPost(e.target.checked)} />
            Ghim bài lên đầu Cộng đồng ngay khi đăng
          </label>
          {pinAfterPost ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              Thẻ ghim sẽ dùng tiêu đề và đoạn đầu nội dung; mỗi thị trường chỉ có một bài ghim nên bài ghim cũ của các thị trường được tick sẽ tự bỏ ghim.
              Muốn đổi ảnh/chữ trên thẻ, bấm biểu tượng ghim trong danh sách sau khi đăng.
            </div>
          ) : null}
          {sendNotification ? (
            <div style={{ marginTop: 14 }}>
              {extraMarkets.length ? <PillTabs options={[["VN", "VN"] as [AdminMarket, string], ...(["US", "MALAY"] as const).filter((m) => extraMarkets.includes(m)).map((m) => [m, m === "US" ? "UK" : "ML"] as [AdminMarket, string])]} value={composerMarketTab} onChange={setComposerMarketTab} /> : null}
              {composerMarketTab === "VN" ? (
                <Fragment>
                  <FieldLabel>Tiêu đề thông báo {extraMarkets.length ? "(VN)" : ""}</FieldLabel>
                  <input
                    value={notifyTitle}
                    onChange={(e) => setNotifyTitle(e.target.value)}
                    placeholder={title.trim() || "Tiêu đề hiển thị trên thông báo"}
                    style={{ ...inputStyle, marginBottom: 14 }}
                  />
                  <FieldLabel>Nội dung thông báo {extraMarkets.length ? "(VN)" : ""}</FieldLabel>
                  <textarea
                    value={notifyBody}
                    onChange={(e) => setNotifyBody(e.target.value)}
                    rows={2}
                    placeholder={text.trim() || "Nội dung hiển thị trên thông báo"}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </Fragment>
              ) : (
                <Fragment>
                  <FieldLabel>Tiêu đề thông báo ({composerMarketTab === "US" ? "UK" : "ML"}, tùy chọn)</FieldLabel>
                  <input
                    value={composerMarketTab === "US" ? notifyTitleUs : notifyTitleMalay}
                    onChange={(e) => (composerMarketTab === "US" ? setNotifyTitleUs(e.target.value) : setNotifyTitleMalay(e.target.value))}
                    placeholder={(composerMarketTab === "US" ? titleUs : titleMalay).trim() || "Tiêu đề hiển thị trên thông báo"}
                    style={{ ...inputStyle, marginBottom: 14 }}
                  />
                  <FieldLabel>Nội dung thông báo ({composerMarketTab === "US" ? "UK" : "ML"}, tùy chọn)</FieldLabel>
                  <textarea
                    value={composerMarketTab === "US" ? notifyBodyUs : notifyBodyMalay}
                    onChange={(e) => (composerMarketTab === "US" ? setNotifyBodyUs(e.target.value) : setNotifyBodyMalay(e.target.value))}
                    rows={2}
                    placeholder={(composerMarketTab === "US" ? textUs : textMalay).trim() || "Nội dung hiển thị trên thông báo"}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>Bỏ trống để dùng đúng tiêu đề/nội dung bài viết ({composerMarketTab === "US" ? "UK" : "ML"}).</div>
                </Fragment>
              )}
            </div>
          ) : null}
        </Fragment>
      ) : null}
    </Modal>
  ) : null;

  const commentsModal = commentPost ? (
    <Modal title={"Bình luận · " + commentPost.name} onClose={() => setCommentsFor(null)} width={460}>
      {!commentPost.commentsList || commentPost.commentsList.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Chưa có bình luận nào.</div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {(commentPost.commentsList || []).map((c, i) => (
          <div key={i} style={{ display: "flex", gap: 10, padding: "12px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
            <Avatar name={c.name} color={c.avatarColor} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                {c.name}
                {c.official ? <span style={{ color: "var(--color-primary)" }}> ✓</span> : null}{" "}
                <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>· {c.time}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{c.text}</div>
            </div>
            {c.idKey ? (
              <button onClick={() => removeComment(c.idKey!)} style={{ border: "none", background: "none", cursor: "pointer", display: "flex", alignSelf: "flex-start" }}>
                <Icon name="trash-2" size={14} color="var(--error)" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </Modal>
  ) : null;

  return (
    <div>
      {subTabSwitcher}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {AUTHOR_TABS.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setAuthorTab(k)}
            style={{
              border: "1px solid " + (authorTab === k ? "var(--color-primary)" : "var(--border-input)"),
              background: authorTab === k ? "var(--color-primary-tint-10)" : "#fff",
              color: authorTab === k ? "var(--color-primary)" : "var(--text-secondary)",
              borderRadius: 8,
              padding: "7px 14px",
              fontFamily: "var(--font-family)",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {l}
            {k === "users" && pendingCount > 0 ? ` · ${pendingCount} chờ duyệt` : ""}
          </button>
        ))}
      </div>
      <TableShell
      subtitle={
        authorTab === "official"
          ? "Bài viết do TheraHOME đăng — ghim bài quan trọng lên đầu Trang chủ/Cộng đồng của app."
          : "Bài chia sẻ từ người dùng app — bài mới cần được duyệt trước khi hiển thị với cộng đồng; kiểm duyệt bình luận và ẩn/xoá nếu cần."
      }
      action={authorTab === "official" ? <PrimaryBtn icon="plus" onClick={openNew}>Đăng bài viết mới</PrimaryBtn> : undefined}
      searchPlaceholder="Tìm theo nội dung..."
      searchValue={q}
      onSearchChange={setQ}
      modals={
        <Fragment>
          {postModal}
          {commentsModal}
          {pinning ? <PinDisplayModal post={pinning} onClose={() => setPinning(null)} onConfirm={confirmPin} /> : null}
          {deletingPost ? (
            <ConfirmModal
              title="Xoá bài viết"
              message={`Xoá vĩnh viễn bài viết "${String(deletingPost.label).slice(0, 80)}"? Bình luận và cảm xúc của bài cũng bị xoá, không thể hoàn tác.`}
              confirmLabel="Xoá vĩnh viễn"
              busy={deleteBusy}
              onConfirm={removePost}
              onCancel={() => setDeletingPost(null)}
            />
          ) : null}
        </Fragment>
      }
      columns={["Ghim", "Tác giả", "Nội dung", "Lượt thích", "Bình luận", "Thao tác"]}
    >
      {sorted.map((it) => (
        <tr key={it.id} style={{ borderTop: "1px solid var(--divider)", background: it.pinned ? "var(--color-primary-tint-10)" : "none" }}>
          <td style={{ padding: "14px 20px 14px 20px" }}>
            {it.official ? (
              <button
                onClick={() => togglePin(it)}
                title={it.pinned ? "Bỏ ghim bài TheraHOME" : "Ghim bài TheraHOME lên đầu Cộng đồng"}
                style={{
                  border: "1px solid " + (it.pinned ? "var(--color-primary)" : "var(--border-input)"),
                  background: it.pinned ? "var(--color-primary-tint-10)" : "#fff",
                  color: it.pinned ? "var(--color-primary)" : "var(--text-secondary)",
                  borderRadius: 999,
                  padding: "6px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  fontFamily: "var(--font-family)",
                  fontWeight: 600,
                  fontSize: 12.5,
                  whiteSpace: "nowrap",
                }}
              >
                <Icon name="bookmark" size={14} color={it.pinned ? "var(--color-primary)" : "var(--text-secondary)"} />
                {it.pinned ? "Đã ghim" : "Ghim"}
              </button>
            ) : (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
            )}
          </td>
          <td style={{ padding: "14px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar name={it.name} color={it.avatarColor} size={32} />
              <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                {it.name}
                {it.official ? <span style={{ color: "var(--color-primary)" }}> ✓</span> : null}
              </div>
            </div>
          </td>
          <td style={{ padding: "14px 20px", color: "var(--text-secondary)", maxWidth: 420, verticalAlign: "top" }}>
            {it.title ? <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>{it.title}</div> : null}
            {(() => {
              const expanded = expandedIds.has(String(it.id));
              const isLong = it.text.length > 180 || it.text.split("\n").length > 3;
              return (
                <Fragment>
                  <div
                    style={
                      expanded
                        ? { whiteSpace: "pre-wrap", lineHeight: 1.55 }
                        : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.55, whiteSpace: "pre-wrap" }
                    }
                  >
                    {it.text}
                  </div>
                  {isLong ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedIds((current) => {
                          const next = new Set(current);
                          if (next.has(String(it.id))) next.delete(String(it.id));
                          else next.add(String(it.id));
                          return next;
                        })
                      }
                      style={{ border: "none", background: "none", padding: 0, marginTop: 4, color: "var(--color-primary)", fontFamily: "var(--font-family)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                    >
                      {expanded ? "Thu gọn" : "Xem thêm"}
                    </button>
                  ) : null}
                </Fragment>
              );
            })()}
            {/* Which markets actually see this post — without it staff had
                no way to tell a VN-only post from a UK-only one, and no way
                to know which market a pin belongs to (pins are per-market
                since 2026-09-04). */}
            {it.official ? (
              <span style={{ marginLeft: 8 }}>
                <Badge color="var(--color-primary)" bg="var(--color-primary-tint-10)">
                  {it.targetMarkets === null || it.targetMarkets.length === 0
                    ? "Mọi thị trường"
                    : it.targetMarkets.map((m) => (m === "US" ? "UK" : m === "MALAY" ? "ML" : m)).join(" · ")}
                </Badge>
              </span>
            ) : null}
            {it.hidden ? (
              <span style={{ marginLeft: 8 }}>
                <Badge color="#8A93A3" bg="rgba(138,147,163,0.12)">Đã ẩn</Badge>
              </span>
            ) : null}
            {!it.official && it.status === "pending" ? (
              <span style={{ marginLeft: 8 }}>
                <Badge color="#B9860B" bg="rgba(185,134,11,0.12)">Chờ duyệt</Badge>
              </span>
            ) : null}
            {!it.official && it.status === "rejected" ? (
              <span style={{ marginLeft: 8 }}>
                <Badge color="var(--error)" bg="rgba(220,60,60,0.10)">Không duyệt</Badge>
              </span>
            ) : null}
          </td>
          <td style={{ padding: "14px 20px", color: "var(--text-secondary)" }}>{it.likes}</td>
          <td style={{ padding: "14px 20px" }}>
            <button onClick={() => setCommentsFor(it.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--color-primary)", fontFamily: "var(--font-family)", fontWeight: 600, fontSize: 13 }}>
              {it.comments}
            </button>
          </td>
          {/* Moderation (duyệt/từ chối/ẩn user posts) shows for BOTH Admin
              and CSKH — RLS grants cskh post updates and the pending queue
              is CSKH's job, and so is everything else on this screen since
              the tab moved to CSKH (2026-09-05). */}
          <td style={{ padding: "14px 20px" }}>
            <div style={{ display: "flex", gap: 10 }}>
              {!it.official && it.status !== "approved" ? (
                <button onClick={() => moderate(it, "approved")} title="Duyệt bài viết" style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                  <Icon name="check" size={16} color="var(--success, #2BB673)" />
                </button>
              ) : null}
              {!it.official && it.status === "pending" ? (
                <button onClick={() => moderate(it, "rejected")} title="Từ chối bài viết" style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                  <Icon name="x" size={16} color="var(--error)" />
                </button>
              ) : null}
              {/* Edit covers content AND image, for member and official
                  posts alike. */}
              <button onClick={() => openEdit(it)} title="Sửa bài viết" style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                <Icon name="pencil" size={16} color="var(--color-primary)" />
              </button>
              <button onClick={() => toggleHidden(it)} title={it.hidden ? "Hiện lại" : "Ẩn bài viết"} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                <Icon name="eye" size={16} color={it.hidden ? "var(--text-muted)" : "var(--text-secondary)"} />
              </button>
              {/* Delete: Admin and CSKH on every post — CSKH publishes the
                  official ones, so they can retract them too (RLS policy
                  "web cskh delete any post", 2026-09-05). Confirmed via
                  ConfirmModal; comments/reactions/inbox rows cascade. */}
              {(
                <button
                  onClick={() => setDeletingPost({ id: it.id, label: it.title || it.text || it.name })}
                  title="Xoá bài viết"
                  style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}
                >
                  <Icon name="trash-2" size={16} color="var(--error)" />
                </button>
              )}
            </div>
          </td>
        </tr>
      ))}
      </TableShell>
    </div>
  );
}

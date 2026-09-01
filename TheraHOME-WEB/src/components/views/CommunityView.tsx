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
  type PostModerationStatus,
} from "@/lib/db";
import { PrimaryBtn, GhostBtn, Badge, FieldLabel, inputStyle, Avatar, PillTabs } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { TableShell } from "@/components/ui/TableShell";
import { Icon } from "@/components/ui/Icon";
import { pushToast } from "@/components/ui/Toast";

type PinnedPost = CommunityPost & { pinned: boolean; hidden: boolean; status: PostModerationStatus; imageUrl: string | null; pinnedDisplay: PinnedDisplay };

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

function PinDisplayModal({
  post,
  onClose,
  onConfirm,
}: {
  post: PinnedPost;
  onClose: () => void;
  onConfirm: (input: { title: string; content: string; thumbnailFile: File | null; thumbnailUrl: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState(post.title || post.name);
  const [content, setContent] = useState(post.text);
  const [thumbnailUrl, setThumbnailUrl] = useState(post.imageUrl || "");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = !!title.trim() && !!content.trim() && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onConfirm({ title: title.trim(), content: content.trim(), thumbnailFile, thumbnailUrl: thumbnailUrl.trim() });
    } finally {
      setSubmitting(false);
    }
  }

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
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 16 }}>
        Nội dung hiển thị trên card ghim ở Trang chủ và Cộng đồng của app — có thể khác với bài viết gốc (ví dụ rút gọn nội dung dài, hoặc thêm ảnh minh họa).
      </div>
      <FieldLabel>Tiêu đề hiển thị</FieldLabel>
      <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
      <FieldLabel>Nội dung hiển thị</FieldLabel>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical", marginBottom: 14 }} />
      <FieldLabel>Ảnh thumbnail (tùy chọn)</FieldLabel>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)}
        style={{ ...inputStyle, padding: 8, marginBottom: 8 }}
      />
      {thumbnailFile ? (
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>Sẵn sàng tải lên: {thumbnailFile.name}</div>
      ) : (
        <input
          value={thumbnailUrl}
          onChange={(e) => setThumbnailUrl(e.target.value)}
          placeholder="Hoặc dán link ảnh..."
          style={{ ...inputStyle, marginBottom: 8 }}
        />
      )}
      {!thumbnailFile && thumbnailUrl ? (
        <img src={thumbnailUrl} alt="" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 10, border: "1px solid var(--divider)" }} />
      ) : null}
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>JPG, PNG hoặc WebP, tối đa 5 MB.</div>
    </Modal>
  );
}

export function CommunityView({ pinOnly = false }: { pinOnly?: boolean }) {
  const [subTab, setSubTab] = useState<"posts" | "challenges">("posts");
  const [items, setItems] = useState<PinnedPost[] | null>(null);
  const [modal, setModal] = useState<string | number | "new" | null>(null);
  const [commentsFor, setCommentsFor] = useState<string | number | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [sendNotification, setSendNotification] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");
  // New-post market targeting: VN content is always the `title`/`text`
  // fields above and always shown; UK/ML are opt-in extra variants — only
  // checking one reveals its own fields and adds it to targetMarkets, so
  // posting stays a one-field-set action unless staff actually wants a
  // market-specific version (matches the explicit "chỉ quốc gia nào được
  // hiển thị mới cần điền nội dung" instruction).
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
    setSendNotification(false);
    setNotifyTitle("");
    setNotifyBody("");
  }
  async function save() {
    try {
      if (modal === "new") {
        if (!title.trim() || !text.trim()) {
          pushToast("Vui lòng nhập tiêu đề và nội dung bài viết");
          return;
        }
        if (extraMarkets.includes("US") && (!titleUs.trim() || !textUs.trim())) {
          pushToast("Vui lòng nhập tiêu đề và nội dung bản UK");
          return;
        }
        if (extraMarkets.includes("MALAY") && (!titleMalay.trim() || !textMalay.trim())) {
          pushToast("Vui lòng nhập tiêu đề và nội dung bản ML");
          return;
        }
        await createOfficialPost({
          title: title.trim(),
          text: text.trim(),
          sendNotification,
          notifyTitle,
          notifyBody,
          targetMarkets: extraMarkets.length ? ["VN", ...extraMarkets] : undefined,
          titleUs: extraMarkets.includes("US") ? titleUs.trim() : undefined,
          textUs: extraMarkets.includes("US") ? textUs.trim() : undefined,
          titleMalay: extraMarkets.includes("MALAY") ? titleMalay.trim() : undefined,
          textMalay: extraMarkets.includes("MALAY") ? textMalay.trim() : undefined,
          notifyTitleUs: extraMarkets.includes("US") ? notifyTitleUs.trim() : undefined,
          notifyBodyUs: extraMarkets.includes("US") ? notifyBodyUs.trim() : undefined,
          notifyTitleMalay: extraMarkets.includes("MALAY") ? notifyTitleMalay.trim() : undefined,
          notifyBodyMalay: extraMarkets.includes("MALAY") ? notifyBodyMalay.trim() : undefined,
        });
        pushToast(sendNotification ? "Đã đăng bài và gửi thông báo" : "Đã đăng bài viết mới lên Cộng đồng");
      } else if (modal !== null) {
        await updateCommunityPost(String(modal), { title: title.trim() || undefined, text: text.trim() });
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
  async function confirmPin(input: { title: string; content: string; thumbnailFile: File | null; thumbnailUrl: string }) {
    if (!pinning) return;
    try {
      const thumbnailUrl = input.thumbnailFile ? await uploadPostThumbnail(String(pinning.id), input.thumbnailFile) : input.thumbnailUrl || null;
      await setOfficialPostPinned(String(pinning.id), true, { title: input.title, content: input.content, thumbnailUrl });
      setPinning(null);
      pushToast("Đã ghim bài viết");
      reload();
    } catch {
      pushToast("Không thể ghim bài viết");
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
  async function removePost(id: string | number) {
    try {
      await deleteCommunityPost(String(id));
      reload();
    } catch {
      pushToast("Không thể xoá bài viết");
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

  const communityTabs: Array<[typeof subTab, string]> = pinOnly
    ? [["posts", "Bài viết"]]
    : [["posts", "Bài viết"], ["challenges", "Thử thách"]];
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
      <FieldLabel>Tiêu đề (VN)</FieldLabel>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: 5 phút thư giãn cổ vai" style={{ ...inputStyle, marginBottom: 14 }} />
      <FieldLabel>Nội dung (VN)</FieldLabel>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Nội dung bài viết đăng lên Cộng đồng..." style={{ ...inputStyle, minHeight: 100, resize: "vertical", marginBottom: 14 }} />
      {modal === "new" ? (
        <Fragment>
          <FieldLabel>Cũng hiển thị bản riêng cho</FieldLabel>
          <div style={{ display: "flex", gap: 14, marginBottom: extraMarkets.length ? 10 : 16 }}>
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
          <td style={{ padding: "14px 20px", color: "var(--text-secondary)", maxWidth: 320 }}>
            {it.title ? <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>{it.title}</div> : null}
            {it.text}
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
              is CSKH's job. Edit/delete (and touching official posts) stay
              Admin-only (`pinOnly` is the CSKH variant; post deletes are
              admin-only in RLS anyway). */}
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
              {!pinOnly ? (
                <button onClick={() => openEdit(it)} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                  <Icon name="pencil" size={16} color="var(--color-primary)" />
                </button>
              ) : null}
              {!pinOnly || !it.official ? (
                <button onClick={() => toggleHidden(it)} title={it.hidden ? "Hiện lại" : "Ẩn bài viết"} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                  <Icon name="eye" size={16} color={it.hidden ? "var(--text-muted)" : "var(--text-secondary)"} />
                </button>
              ) : null}
              {!pinOnly ? (
                <button onClick={() => removePost(it.id)} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                  <Icon name="trash-2" size={16} color="var(--error)" />
                </button>
              ) : null}
            </div>
          </td>
        </tr>
      ))}
      </TableShell>
    </div>
  );
}

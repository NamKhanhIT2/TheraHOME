"use client";

// Cộng đồng — the community tab of Dashboard.dc.html, on the real feed the
// mobile app posts into.
//
// Two things the design could not show, because it had mock data:
//  - A new post starts `status = 'pending'`. The database decides that
//    (set_post_moderation_status), CSKH approves it, and until then only its
//    author and staff can see it. So a post that appears with a "chờ duyệt"
//    badge is correct, not a bug, and saying so beats leaving someone to
//    wonder why nobody replied.
//  - Posting is rate-limited by a trigger. That surfaces as a plain insert
//    error, so the message has to be readable rather than a raw Postgres one.
//
// The feed needs a signed-in viewer, and not by choice here. The `public read
// posts` policy ORs together "approved and not hidden", "your own post" and
// two current_web_roles() checks — and EXECUTE on current_web_roles is granted
// to `authenticated` only. An anonymous reader therefore fails the whole
// SELECT with `42501 permission denied for function current_web_roles`, even
// though the first branch would have matched. Rather than widen that function
// to `anon` (it guards every staff policy in the schema), the tab asks the
// visitor to sign in — which is also where the design puts it, inside the
// logged-in dashboard.
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  addComment,
  createPost,
  fetchComments,
  fetchFeed,
  timeAgo,
  toggleLike,
  type CommunityPost,
  type FeedFilter,
  type PostComment,
} from "@/lib/appTabs";
import { SafeImg } from "@/components/landing/SafeImg";
import { LandingButton } from "@/components/landing/LandingButton";

const card: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: "clamp(18px, 2vw, 22px)",
  borderRadius: "var(--radius-lg, 24px)",
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.07)",
};

function initials(name: string): string {
  return (name || "Bạn").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function postErrorMessage(error: unknown): string {
  const m = error instanceof Error ? error.message.toLowerCase() : "";
  if (m.includes("rate") || m.includes("too many") || m.includes("limit")) {
    return "Bạn vừa đăng xong — chờ một lát rồi đăng tiếp nhé.";
  }
  if (m.includes("unsafe") || m.includes("content")) return "Nội dung chưa phù hợp với quy tắc cộng đồng.";
  if (m.includes("row-level security") || m.includes("permission")) return "Bạn cần đăng nhập để đăng bài.";
  return "Không đăng được. Vui lòng thử lại.";
}

function Avatar({ name, official }: { name: string; official?: boolean }) {
  if (official) {
    return (
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 999, background: "rgba(255,255,255,0.06)", flex: "0 0 auto", overflow: "hidden" }}>
        <SafeImg src="/landing/logo.png" style={{ width: 26, height: 26, display: "block" }} />
      </span>
    );
  }
  return (
    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 999, background: "rgba(0,127,217,0.16)", color: "#4FB0F5", fontSize: 13, fontWeight: 700, flex: "0 0 auto" }}>
      {initials(name)}
    </span>
  );
}

function Comments({ postId, canWrite, onAdded }: { postId: string; canWrite: boolean; onAdded: () => void }) {
  const [list, setList] = useState<PostComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    void fetchComments(postId)
      .then(setList)
      .catch(() => setList([]));
  }, [postId]);

  useEffect(load, [load]);

  async function submit() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await addComment(postId, draft);
      setDraft("");
      load();
      onAdded();
    } catch (err) {
      console.error("Unable to add the comment", err);
      setError(postErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      {list === null ? (
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Đang tải bình luận...</span>
      ) : list.length === 0 ? (
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Chưa có bình luận nào.</span>
      ) : (
        list.map((c) => (
          <div key={c.id} style={{ display: "flex", gap: 10 }}>
            <Avatar name={c.authorName} />
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "#fff" }}>
                {c.authorName} <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.45)" }}>· {timeAgo(c.createdAt)}</span>
              </span>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.74)", wordBreak: "break-word" }}>{c.text}</p>
            </div>
          </div>
        ))
      )}

      {canWrite ? (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            placeholder="Viết bình luận..."
            style={{ flex: 1, minWidth: 0, padding: "11px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)", color: "#fff", fontFamily: "inherit", fontSize: 14 }}
          />
          <button type="button" onClick={() => void submit()} disabled={!draft.trim() || busy} style={{ padding: "11px 18px", borderRadius: 999, border: "none", background: "var(--color-primary)", color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: draft.trim() && !busy ? "pointer" : "default", opacity: draft.trim() && !busy ? 1 : 0.5 }}>
            {busy ? "..." : "Gửi"}
          </button>
        </div>
      ) : null}
      {error ? <span style={{ fontSize: 12.5, color: "var(--error)" }}>{error}</span> : null}
    </div>
  );
}

export function CommunityTab({ userId, userName }: { userId: string | null; userName: string }) {
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) return;   // see the header note: anonymous SELECT cannot pass the policy
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchFeed(filter, userId);
        if (!cancelled) setPosts(data);
      } catch (err) {
        console.error("Unable to load the community feed", err);
        if (!cancelled) setPosts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter, userId, tick]);

  if (!userId) {
    return (
      <div style={{ ...card, gap: 16, minHeight: "32vh", justifyContent: "center" }}>
        <h2 style={{ margin: 0, fontSize: "clamp(20px, 2.2vw, 28px)", fontWeight: 600, color: "#fff", letterSpacing: "-0.015em" }}>
          Đăng nhập để xem cộng đồng
        </h2>
        <p style={{ margin: 0, maxWidth: 480, fontSize: 15.5, lineHeight: 1.65, color: "rgba(255,255,255,0.66)" }}>
          Bảng tin chỉ dành cho khách đã có tài khoản — cùng cộng đồng bạn thấy trong ứng dụng trên điện thoại.
        </p>
        <div style={{ display: "flex" }}>
          <LandingButton href="/dang-nhap">Đăng nhập</LandingButton>
        </div>
      </div>
    );
  }

  async function submitPost() {
    if (!draft.trim() || !userId || posting) return;
    setPosting(true);
    setError("");
    try {
      await createPost(userId, draft);
      setDraft("");
      // Say what actually happens next rather than letting the post seem to vanish.
      setNotice("Đã gửi. Bài của bạn đang chờ duyệt — bạn vẫn thấy nó, người khác thì chưa.");
      setTick((t) => t + 1);
    } catch (err) {
      console.error("Unable to create the post", err);
      setError(postErrorMessage(err));
    } finally {
      setPosting(false);
    }
  }

  async function like(post: CommunityPost) {
    if (!userId) return;
    // Optimistic: the counter is a denormalised column a trigger maintains, so
    // re-reading it is a round trip for something the click already implies.
    setPosts((cur) =>
      (cur ?? []).map((p) =>
        p.id === post.id ? { ...p, likedByMe: !p.likedByMe, likesCount: p.likesCount + (p.likedByMe ? -1 : 1) } : p,
      ),
    );
    try {
      await toggleLike(post.id, userId, post.likedByMe);
    } catch (err) {
      console.error("Unable to save the reaction", err);
      setTick((t) => t + 1); // put the truth back
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* --------------------------------------------------- composer */}
      {userId ? (
        <div style={{ ...card, gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar name={userName} />
            <span style={{ fontSize: 15.5, color: "rgba(255,255,255,0.72)" }}>Chia sẻ hành trình của bạn hôm nay...</span>
          </div>
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError("");
              setNotice("");
            }}
            rows={3}
            placeholder="Hôm nay bạn thấy thế nào?"
            style={{ width: "100%", resize: "vertical", padding: "12px 14px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)", color: "#fff", fontFamily: "inherit", fontSize: 15, lineHeight: 1.6, boxSizing: "border-box" }}
          />
          {error ? <span style={{ fontSize: 12.5, color: "var(--error)" }}>{error}</span> : null}
          {notice ? <span style={{ fontSize: 12.5, color: "#7FBFFF" }}>{notice}</span> : null}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <LandingButton onClick={() => void submitPost()} disabled={!draft.trim() || posting} style={{ height: 44 }}>
              {posting ? "Đang gửi..." : "Đăng bài"}
            </LandingButton>
          </div>
        </div>
      ) : null}

      {/* ----------------------------------------------------- filter */}
      <div style={{ display: "flex", gap: 12 }}>
        {([["all", "Tất cả"], ["official", "TheraHome"]] as const).map(([value, label]) => {
          const on = filter === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              style={{ padding: "10px 20px", borderRadius: 999, fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", color: on ? "#fff" : "rgba(255,255,255,0.7)", background: on ? "var(--color-primary)" : "rgba(255,255,255,0.05)", border: `1px solid ${on ? "var(--color-primary)" : "rgba(255,255,255,0.12)"}` }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------- feed */}
      {posts === null ? (
        <p style={{ margin: 0, color: "rgba(255,255,255,0.6)" }}>Đang tải bảng tin...</p>
      ) : posts.length === 0 ? (
        <p style={{ margin: 0, color: "rgba(255,255,255,0.6)" }}>Chưa có bài viết nào.</p>
      ) : (
        posts.map((p) => (
          <article key={p.id} style={card}>
            <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Avatar name={p.authorName} official={p.isOfficial} />
              <span style={{ fontSize: 15.5, fontWeight: 700, color: "#fff" }}>{p.isOfficial ? "TheraHome" : p.authorName}</span>
              {p.isOfficial ? (
                <span aria-label="Tài khoản chính thức" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 17, height: 17, borderRadius: 999, background: "var(--color-primary)", color: "#fff" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" aria-hidden="true"><path d="M5 12.5 10 17l9-10" /></svg>
                </span>
              ) : null}
              <span style={{ fontSize: 13.5, color: "rgba(255,255,255,0.5)" }}>· {timeAgo(p.createdAt)}</span>
              {p.mine && p.status !== "approved" ? (
                <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: "rgba(255,182,72,0.16)", border: "1px solid rgba(255,182,72,0.4)", color: "#FFC978" }}>
                  Chờ duyệt
                </span>
              ) : null}
            </span>

            {p.title ? <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.3, color: "#fff" }}>{p.title}</h3> : null}
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: "rgba(255,255,255,0.72)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{p.text}</p>

            {p.imageUrl || p.mediaUrls[0] ? (
              <SafeImg src={(p.imageUrl ?? p.mediaUrls[0])!} style={{ width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 16, display: "block", border: "1px solid rgba(255,255,255,0.07)" }} />
            ) : null}

            <div style={{ display: "flex", alignItems: "center", gap: 18, paddingTop: 4 }}>
              <button type="button" onClick={() => void like(p)} disabled={!userId} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: 0, background: "transparent", border: "none", fontFamily: "inherit", fontSize: 14, cursor: userId ? "pointer" : "default", color: p.likedByMe ? "#FF6B8A" : "rgba(255,255,255,0.62)" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill={p.likedByMe ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                  <path d="M12 20s-7-4.5-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.5 12 20 12 20z" />
                </svg>
                {p.likesCount}
              </button>
              <button type="button" onClick={() => setOpenComments(openComments === p.id ? null : p.id)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: 0, background: "transparent", border: "none", fontFamily: "inherit", fontSize: 14, cursor: "pointer", color: "rgba(255,255,255,0.62)" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                  <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" />
                </svg>
                {p.commentsCount}
              </button>
            </div>

            {openComments === p.id ? (
              <Comments postId={p.id} canWrite={!!userId} onAdded={() => setTick((t) => t + 1)} />
            ) : null}
          </article>
        ))
      )}
    </div>
  );
}

"use client";

// Content moderation queue — content_reports (posts + comments reported
// from the mobile app's overflow menus, see TheraHOME APP's
// useReportContent hook). Actions: hide (soft), delete (hard, reuses the
// same functions CommunityView uses), lock the author's account (reuses
// profiles.locked via updateAppUser, same mechanism UsersView's "Khóa tài
// khoản" already uses), and resolve/dismiss the report itself.
import { useEffect, useState } from "react";
import { REPORT_REASON_META } from "@/lib/adminMockData";
import {
  fetchContentReports,
  resolveContentReport,
  updateCommunityPost,
  hideCommunityComment,
  deleteCommunityPost,
  deleteCommunityComment,
  updateAppUser,
  type ContentReport,
} from "@/lib/db";
import { Badge, GhostBtn } from "@/components/ui/primitives";
import { TableShell } from "@/components/ui/TableShell";
import { pushToast } from "@/components/ui/Toast";

const STATUS_FILTERS = ["Tất cả", "Đang chờ", "Đã xử lý", "Đã bỏ qua"];

const STATUS_META: Record<ContentReport["status"], [string, string, string]> = {
  pending: ["Đang chờ", "#B9860B", "rgba(185,134,11,0.12)"],
  resolved: ["Đã xử lý", "#1E9E5E", "rgba(30,158,94,0.12)"],
  dismissed: ["Đã bỏ qua", "#8A93A3", "rgba(138,147,163,0.12)"],
};

function statusFromFilter(f: string): ContentReport["status"] | null {
  if (f === "Đang chờ") return "pending";
  if (f === "Đã xử lý") return "resolved";
  if (f === "Đã bỏ qua") return "dismissed";
  return null;
}

export function ReportsView() {
  const [reports, setReports] = useState<ContentReport[] | null>(null);
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS[0]);

  function reload() {
    fetchContentReports().then(setReports).catch(() => pushToast("Không thể tải danh sách báo cáo"));
  }
  useEffect(reload, []);

  async function hideContent(r: ContentReport) {
    try {
      if (r.contentType === "post") await updateCommunityPost(r.contentId, { hidden: true });
      else await hideCommunityComment(r.contentId, true);
      pushToast("Đã ẩn nội dung");
      reload();
    } catch {
      pushToast("Không thể ẩn nội dung (có thể đã bị xoá)");
    }
  }

  async function deleteContent(r: ContentReport) {
    if (!window.confirm("Xoá vĩnh viễn nội dung này?")) return;
    try {
      if (r.contentType === "post") await deleteCommunityPost(r.contentId);
      else await deleteCommunityComment(r.contentId);
      pushToast("Đã xoá nội dung");
      reload();
    } catch {
      pushToast("Không thể xoá nội dung");
    }
  }

  async function lockAuthor(r: ContentReport) {
    if (!r.contentAuthorId) return;
    if (!window.confirm("Khoá tài khoản của " + (r.contentAuthorName || "người dùng này") + "?")) return;
    try {
      await updateAppUser(r.contentAuthorId, { locked: true });
      pushToast("Đã khoá tài khoản " + (r.contentAuthorName || ""));
    } catch {
      pushToast("Không thể khoá tài khoản");
    }
  }

  async function setStatus(r: ContentReport, status: "resolved" | "dismissed") {
    try {
      await resolveContentReport(r.id, status);
      reload();
    } catch {
      pushToast("Không thể cập nhật báo cáo");
    }
  }

  if (!reports) return <div style={{ color: "var(--text-secondary)", padding: 20 }}>Đang tải...</div>;

  const targetStatus = statusFromFilter(statusFilter);
  const filtered = targetStatus ? reports.filter((r) => r.status === targetStatus) : reports;

  return (
    <TableShell
      subtitle="Nội dung bị người dùng báo cáo từ ứng dụng — xử lý, ẩn, xoá hoặc khoá tài khoản vi phạm."
      filterOptions={STATUS_FILTERS}
      filterValue={statusFilter}
      onFilterChange={setStatusFilter}
      columns={["Nội dung bị báo cáo", "Tác giả", "Người báo cáo", "Lý do", "Trạng thái", "Thao tác"]}
    >
      {filtered.length === 0 ? (
        <tr>
          <td colSpan={6} style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
            Không có báo cáo nào.
          </td>
        </tr>
      ) : null}
      {filtered.map((r) => {
        const [statusLabel, statusColor, statusBg] = STATUS_META[r.status];
        return (
          <tr key={r.id} style={{ borderTop: "1px solid var(--divider)" }}>
            <td style={{ padding: "14px 20px", maxWidth: 280 }}>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 3, textTransform: "uppercase" }}>
                {r.contentType === "post" ? "Bài viết" : "Bình luận"}
              </div>
              <div style={{ color: "var(--text-primary)" }}>
                {r.contentText ?? <i style={{ color: "var(--text-muted)" }}>(Nội dung đã bị xoá)</i>}
              </div>
            </td>
            <td style={{ padding: "14px 20px", color: "var(--text-secondary)" }}>{r.contentAuthorName || "—"}</td>
            <td style={{ padding: "14px 20px", color: "var(--text-secondary)" }}>{r.reporterName || "—"}</td>
            <td style={{ padding: "14px 20px", color: "var(--text-secondary)" }}>{REPORT_REASON_META[r.reason] || r.reason}</td>
            <td style={{ padding: "14px 20px" }}>
              <Badge color={statusColor} bg={statusBg}>{statusLabel}</Badge>
            </td>
            <td style={{ padding: "14px 20px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <GhostBtn onClick={() => hideContent(r)}>Ẩn</GhostBtn>
                <GhostBtn color="var(--error)" onClick={() => deleteContent(r)}>Xoá</GhostBtn>
                {r.contentAuthorId ? <GhostBtn color="var(--error)" onClick={() => lockAuthor(r)}>Khoá tài khoản</GhostBtn> : null}
                {r.status === "pending" ? (
                  <>
                    <GhostBtn onClick={() => setStatus(r, "resolved")}>Đã xử lý</GhostBtn>
                    <GhostBtn onClick={() => setStatus(r, "dismissed")}>Bỏ qua</GhostBtn>
                  </>
                ) : null}
              </div>
            </td>
          </tr>
        );
      })}
    </TableShell>
  );
}

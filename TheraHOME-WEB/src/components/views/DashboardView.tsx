"use client";

import { useEffect, useState } from "react";
import { fetchDashboardStats, type DashboardStats } from "@/lib/db";
import { StatCard, WeekChart } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

const QUICK_LINKS = [
  { id: "exercises", label: "Lộ trình", icon: "route" },
  { id: "products", label: "Sản phẩm", icon: "box" },
  { id: "notifications", label: "Thông báo", icon: "bell" },
];

export function DashboardView({ setActive }: { setActive: (id: string) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetchDashboardStats().then(setStats).catch(() => setStats(null));
  }, []);

  return (
    <div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard icon="users" label="Tổng người dùng" value={stats ? stats.totalUsers.toLocaleString("vi-VN") : "—"} tint="var(--color-primary-tint-10)" />
        <StatCard icon="trending-up" label="Tuân thủ trung bình" value={stats?.avgAdherence != null ? `${stats.avgAdherence}%` : "—"} tint="var(--color-primary-tint-10)" />
        <StatCard icon="message-square" label="Bài viết Cộng đồng" value={stats ? stats.communityPostsCount : "—"} tint="var(--color-primary-tint-10)" />
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
        <div style={{ flex: "1.3 1 380px", background: "#fff", borderRadius: 16, padding: 22, boxShadow: "var(--shadow-card)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF9F0A" }} />
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>Cần xử lý ngay</div>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px 0" }}>Không có việc gì cần xử lý gấp. 🎉</div>
        </div>
        <div style={{ flex: "1 1 280px", background: "#fff", borderRadius: 16, padding: 22, boxShadow: "var(--shadow-card)" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)", marginBottom: 14 }}>Truy cập nhanh</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {QUICK_LINKS.map((q) => (
              <button
                key={q.id}
                onClick={() => setActive(q.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--border-input)", background: "none", borderRadius: 10, padding: "10px 14px", fontFamily: "var(--font-family)", fontWeight: 600, fontSize: 13.5, color: "var(--text-primary)", cursor: "pointer" }}
              >
                <Icon name={q.icon} size={16} color="var(--color-primary)" />
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 22, boxShadow: "var(--shadow-card)", marginTop: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>Tuân thủ tuần này (toàn hệ thống)</div>
        <WeekChart data={stats?.weekAdherence ?? [0, 0, 0, 0, 0, 0, 0]} />
      </div>
    </div>
  );
}

"use client";

// ChatView reads/writes the mobile app's real chat_threads/chat_messages
// (sender_type='specialist') and tracks the specialist-presence Realtime
// channel — see src/lib/db.ts and CLAUDE.md.
import { AccessGate } from "@/components/AccessGate";
import { AppShell } from "@/components/shell/AppShell";
import { NAV_CARE } from "@/lib/adminMockData";
import { ChatView } from "@/components/views/ChatView";
import { UsersView } from "@/components/views/UsersView";
import { NotificationsAdminView } from "@/components/views/NotificationsAdminView";
import { ReportsView } from "@/components/views/ReportsView";
import { CommunityView } from "@/components/views/CommunityView";

export default function CarePage() {
  return (
    <AccessGate requiredRole="cskh">
      <AppShell badgeLabel="CSKH" userInitial="C" userRoleLabel="Chăm sóc khách hàng" navItems={NAV_CARE} initialActive="chat">
        {(active) => (
          <>
            {active === "chat" && <ChatView />}
            {active === "community" && <CommunityView pinOnly />}
            {active === "reports" && <ReportsView />}
            {active === "notifications" && <NotificationsAdminView />}
            {active === "users" && <UsersView role="care" />}
          </>
        )}
      </AppShell>
    </AccessGate>
  );
}

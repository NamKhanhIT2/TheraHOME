"use client";

import { AccessGate } from "@/components/AccessGate";
import { AppShell } from "@/components/shell/AppShell";
import { NAV_ADMIN } from "@/lib/adminMockData";
import { DashboardView } from "@/components/views/DashboardView";
import { UsersView } from "@/components/views/UsersView";
import { RoutineView } from "@/components/views/RoutineView";
import { ProductsView } from "@/components/views/ProductsView";
import { ActivationView } from "@/components/views/ActivationView";
import { AIPromptsView } from "@/components/views/AIPromptsView";
import { NotificationsAdminView } from "@/components/views/NotificationsAdminView";
import { UpsaleNotificationsView } from "@/components/views/UpsaleNotificationsView";
import { TheraAccountsView } from "@/components/views/TheraAccountsView";
import { ReportsView } from "@/components/views/ReportsView";

export default function AdminPage() {
  return (
    <AccessGate requiredRole="admin">
      <AppShell badgeLabel="Admin" userInitial="A" userRoleLabel="Admin" navItems={NAV_ADMIN} initialActive="dashboard">
        {(active, setActive) => (
          <>
            {active === "dashboard" && <DashboardView setActive={setActive} />}
            {active === "users" && <UsersView role="admin" />}
            {active === "exercises" && <RoutineView />}
            {active === "products" && <ProductsView />}
            {active === "activation" && <ActivationView />}
            {active === "ai" && <AIPromptsView />}
            {active === "notifications" && <NotificationsAdminView />}
            {active === "notifications-upsale" && <UpsaleNotificationsView />}
            {active === "thera-accounts" && <TheraAccountsView />}
            {active === "reports" && <ReportsView />}
          </>
        )}
      </AppShell>
    </AccessGate>
  );
}

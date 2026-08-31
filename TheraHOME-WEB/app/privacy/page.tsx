import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Chính sách quyền riêng tư · TheraHOME",
  description: "Chính sách quyền riêng tư của ứng dụng TheraHOME.",
};

export default function PrivacyPage() {
  return <LegalPage docKey="privacy" />;
}

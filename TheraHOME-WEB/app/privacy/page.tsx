import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { resolveLegalLanguage } from "@/lib/legalLanguage";

export const metadata: Metadata = {
  title: "Chính sách quyền riêng tư · Privacy Policy · TheraHOME",
  description: "Chính sách quyền riêng tư của ứng dụng TheraHOME — tiếng Việt, English, Bahasa Melayu.",
};

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LegalPage docKey="privacy" language={await resolveLegalLanguage(searchParams)} />;
}

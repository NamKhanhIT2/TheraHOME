import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { resolveLegalLanguage } from "@/lib/legalLanguage";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng · Terms of Use · TheraHOME",
  description: "Điều khoản sử dụng ứng dụng TheraHOME — tiếng Việt, English, Bahasa Melayu.",
};

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LegalPage docKey="terms" language={await resolveLegalLanguage(searchParams)} />;
}

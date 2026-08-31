import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng · TheraHOME",
  description: "Điều khoản sử dụng của ứng dụng TheraHOME.",
};

export default function TermsPage() {
  return <LegalPage docKey="terms" />;
}

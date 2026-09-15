// Public marketing site. Its own route group and layout so the dark landing
// chrome never touches /admin, /care or the auth screens, which stay on the
// app's light theme in the same Next app on the same domain.
//
// `.landing-root` is the scope every rule in landing.css hangs off — see the
// note at the top of that file for why it is not global.
import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "@/styles/landing.css";
import { LandingNav } from "@/components/landing/LandingNav";

// The design asks for an Apple-like stack: real SF Pro on Apple devices, Be
// Vietnam Pro everywhere else — both carry full Vietnamese diacritics. Loading
// it through next/font self-hosts the file and drops the render-blocking
// Google Fonts @import the design used.
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-be-vietnam",
});

export const metadata: Metadata = {
  title: "TheraHome — Chăm cột sống theo lộ trình",
  description:
    "TheraHome kết hợp thiết bị trị liệu, ứng dụng TheraAI và đội ngũ đồng hành, để việc phục hồi tại nhà có hướng đi rõ ràng thay vì làm theo cảm tính.",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`landing-root ${beVietnamPro.variable}`}>
      <LandingNav />
      <main>{children}</main>
    </div>
  );
}

// The auth screen deliberately sits OUTSIDE the (public) group: the design
// strips the site nav here down to a logo and a way home, so the screen is
// about one decision. Reusing (public)'s layout would put the full nav —
// including its own Đăng Ký / Đăng Nhập links — on top of the form.
import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "@/styles/landing.css";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-be-vietnam",
});

export const metadata: Metadata = {
  title: "Tài khoản TheraHome",
  robots: { index: false },
};

export default function AuthScreenLayout({ children }: { children: React.ReactNode }) {
  return <div className={`landing-root ${beVietnamPro.variable}`}>{children}</div>;
}

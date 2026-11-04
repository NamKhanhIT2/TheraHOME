import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { DangKySW } from "./dang-ky-sw";
import { ThanhTab } from "./thanh-tab";
import "./globals.css";

// next/font tự host lúc build: không gọi fonts.googleapis.com khi chạy, nên
// mất mạng vẫn đúng chữ Inter như app.
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  weight: ["200", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "TheraNECK+ · Lộ trình trị liệu",
  description: "Bài tập theo ngày cho cổ vai gáy cùng TheraHOME.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "TheraHOME", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#080D12",
  width: "device-width",
  initialScale: 1,
  // Cho phóng to: người đau cổ có thể cần chữ to hơn, khoá zoom là chặn đúng
  // người cần nó nhất.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className="min-h-dvh antialiased">
        <DangKySW />
        {/* pb-28 chừa chỗ cho thanh tab nổi, để nội dung cuối không bị che. */}
        <div className="pb-28">{children}</div>
        <ThanhTab />
      </body>
    </html>
  );
}

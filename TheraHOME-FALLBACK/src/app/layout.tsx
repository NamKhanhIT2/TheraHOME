import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { DangKySW } from "./dang-ky-sw";
import "./globals.css";

// next/font tự host font lúc build. Quan trọng với bản dự phòng: không phải
// gọi fonts.googleapis.com lúc chạy, nên mất mạng vẫn đúng chữ Inter như app.
const inter = Inter({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: "TheraHOME · Lộ trình trị liệu",
  description:
    "Toàn bộ bài tập theo ngày của lộ trình TheraNECK+, xem được cả khi ứng dụng gặp sự cố.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "TheraHOME",
    // "default" giữ chữ đen trên thanh trạng thái; nền trang sáng nên
    // "black-translucent" sẽ làm giờ và pin biến mất trên nền trắng.
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#007FD9",
  width: "device-width",
  initialScale: 1,
  // Trang đọc trên điện thoại, nhưng vẫn cho phóng to — người đau cổ có thể
  // cần chữ to hơn, khoá zoom là chặn đúng người cần nó nhất.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={`${inter.className} min-h-dvh antialiased`}>
        <DangKySW />

        <header className="an-toan-tren sticky top-0 z-10 bg-bg-app/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-xl items-center justify-between px-5 py-3">
            <Link href="/" className="text-[17px] font-bold tracking-tight">
              Thera<span className="text-primary">HOME</span>
            </Link>
            <span className="rounded-chip bg-primary-tint10 px-3 py-1.5 text-[12px] font-semibold text-primary">
              Bản dự phòng
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-xl px-5 pb-8">{children}</main>

        <footer className="an-toan-duoi mx-auto max-w-xl px-5 pb-6 text-[13px] leading-relaxed text-text-muted">
          Cần hỗ trợ:{" "}
          <a className="font-medium text-primary" href="tel:+84364263552">
            0364 263 552
          </a>
          <br />
          <a className="font-medium text-primary" href="mailto:support@therahomeai.com">
            support@therahomeai.com
          </a>
        </footer>
      </body>
    </html>
  );
}
